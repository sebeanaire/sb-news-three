import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import Parser from "rss-parser";
import { FEEDS, ROUTED_FEEDS, CATEGORY_ORDER, CATEGORY_KEYWORDS } from "./feeds.mjs";

const DATA_FILE = new URL("../data/news.json", import.meta.url);
const DOCS_DATA_FILE = new URL("../docs/data.json", import.meta.url);
const RETENTION_DAYS = 4;
const SCRAPE_CONCURRENCY = 4;

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
};

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(str) {
  return String(str)
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripHtml(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

const JUNK_PATTERNS = [
  /무단\s*전재/, /저작권/, /구독/, /Powered by/i, /@[\w.-]+\.[a-z]{2,}/i,
  /Google\s*검색/i, /구글\s*검색/, /쿠키/, /캡처\s*공유/, /AI\s*학습/, /기자\s*=/, /앨리스가/,
  /연합뉴스만의/, /특별한\s*뉴스\s*서비스/, /제보(는|하기)/, /카카오톡\s*채널/,
  /window\[/, /function\s*\(/, /googletag/, /taboola/i, /dable/i, /메뉴\s*열기/,
  /더보기\s*더보기/, /많이\s*본\s*뉴스/, /오래\s*머문\s*뉴스/, /뉴스레터/, /앱설치|APP설치/i,
  /재판매\s*및?\s*DB\s*금지/, /=연합뉴스\)/, /\[.*제공\]/, /^\(.*=.*\)/,
];

function isJunk(text) {
  if (!text || text.length < 25 || text.length > 400) return true;
  return JUNK_PATTERNS.some((re) => re.test(text));
}

function firstImageFromHtml(html) {
  const m = String(html || "").match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return m ? m[1] : null;
}

function imageFromItem(item) {
  if (item.enclosure?.url && /^https?:\/\//.test(item.enclosure.url)) return item.enclosure.url;
  const media = item.mediaContent?.[0]?.$?.url || item.mediaThumbnail?.[0]?.$?.url;
  if (media) return media;
  const fromContent = firstImageFromHtml(item.content || item["content:encoded"]);
  if (fromContent) return fromContent;
  return null;
}

function summaryFromItem(item) {
  const snippet = stripHtml(item.contentSnippet || item.summary || "");
  if (!isJunk(snippet)) return snippet.slice(0, 160);
  return null;
}

function stripNonContentTags(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

function extractParagraphs(html) {
  const cleaned = stripNonContentTags(html);
  const paras = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((t) => !isJunk(t));
  return paras.slice(0, 6);
}

function metaContent(html, prop) {
  const re = new RegExp(`(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : null;
}

async function scrapeArticle(url) {
  try {
    const html = await fetchText(url);
    const image = metaContent(html, "og:image");
    const paragraphs = extractParagraphs(html);
    let summary = null;
    if (paragraphs.length) summary = paragraphs[0].slice(0, 160);
    if (!summary) {
      const desc = metaContent(html, "og:description") || metaContent(html, "description");
      if (desc && !isJunk(desc)) summary = desc.slice(0, 160);
    }
    return { image, summary, paragraphs };
  } catch (err) {
    console.warn(`[warn] 본문 스크랩 실패 (${url}): ${err.message}`);
    return { image: null, summary: null, paragraphs: [] };
  }
}

async function mapLimit(list, limit, fn) {
  const results = new Array(list.length);
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      results[idx] = await fn(list[idx], idx);
    }
  }
  await Promise.all(new Array(Math.min(limit, list.length)).fill(0).map(worker));
  return results;
}

function categoryFromKeywords(title) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => title.includes(kw))) return category;
  }
  return null;
}

function normalizeItem(feed, item, category) {
  const link = item.link || item.guid || "";
  const pubDate = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null);
  return {
    id: link || `${feed.name}:${item.title}`,
    title: stripHtml(item.title || ""),
    link,
    source: feed.name,
    category,
    pubDate: pubDate || new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    image: imageFromItem(item),
    summary: summaryFromItem(item),
    paragraphs: extractParagraphs(item.content || item["content:encoded"] || ""),
  };
}

async function fetchFeedItems(feed) {
  try {
    const xml = await fetchText(feed.url);
    const parsed = await parser.parseString(xml);
    return (parsed.items || []).map((item) => normalizeItem(feed, item, feed.category));
  } catch (err) {
    console.warn(`[warn] ${feed.name} 수집 실패: ${err.message}`);
    return [];
  }
}

async function fetchRoutedFeedItems(feed) {
  try {
    const xml = await fetchText(feed.url);
    const parsed = await parser.parseString(xml);
    const items = [];
    for (const item of parsed.items || []) {
      const title = stripHtml(item.title || "");
      const category = categoryFromKeywords(title);
      if (!category) continue;
      items.push(normalizeItem(feed, item, category));
    }
    return items;
  } catch (err) {
    console.warn(`[warn] ${feed.name} 수집 실패: ${err.message}`);
    return [];
  }
}

async function loadExisting() {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { items: [] };
  }
}

async function main() {
  const existing = await loadExisting();
  const existingById = new Map(existing.items.map((i) => [i.id, i]));

  const [fixedResults, routedResults] = await Promise.all([
    Promise.all(FEEDS.map(fetchFeedItems)),
    Promise.all(ROUTED_FEEDS.map(fetchRoutedFeedItems)),
  ]);
  const freshItems = [...fixedResults.flat(), ...routedResults.flat()];

  const needsScrape = [];
  for (const item of freshItems) {
    if (existingById.has(item.id)) continue;
    if (!item.image || !item.summary) needsScrape.push(item);
  }

  await mapLimit(needsScrape, SCRAPE_CONCURRENCY, async (item) => {
    if (!item.link) return;
    const scraped = await scrapeArticle(item.link);
    if (!item.image && scraped.image) item.image = scraped.image;
    if (!item.summary && scraped.summary) item.summary = scraped.summary;
    if (!item.paragraphs.length && scraped.paragraphs.length) item.paragraphs = scraped.paragraphs;
  });

  let newCount = 0;
  for (const item of freshItems) {
    if (!existingById.has(item.id)) {
      existingById.set(item.id, item);
      newCount++;
    }
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const merged = [...existingById.values()]
    .filter((item) => new Date(item.pubDate).getTime() >= cutoff)
    .filter((item) => CATEGORY_ORDER.includes(item.category))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  await mkdir(new URL("../data", import.meta.url), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify({ items: merged }, null, 2), "utf-8");

  await mkdir(new URL("../docs", import.meta.url), { recursive: true });
  await writeFile(
    DOCS_DATA_FILE,
    JSON.stringify({ updatedAt: new Date().toISOString(), items: merged }, null, 2),
    "utf-8"
  );

  console.log(`수집 완료: 총 ${merged.length}건 (신규 ${newCount}건, 스크랩 ${needsScrape.length}건)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
