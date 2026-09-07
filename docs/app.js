const CATEGORY_ORDER = ["AI", "부동산", "금융", "콘텐츠"];
const CATEGORY_EMOJI = { AI: "🤖", 부동산: "🏢", 금융: "💰", 콘텐츠: "🎬" };
const HOME_ITEMS_PER_CATEGORY = 6;

const app = document.getElementById("app");
let DATA = { items: [] };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function groupByCategory(items) {
  const map = new Map(CATEGORY_ORDER.map((c) => [c, []]));
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category).push(item);
  }
  return map;
}

function imageOrPlaceholder(item, className) {
  if (item.image) {
    return `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;placeholder&quot;>${CATEGORY_EMOJI[item.category] || "📰"}</div>'" />`;
  }
  return `<div class="${className || ""} placeholder">${CATEGORY_EMOJI[item.category] || "📰"}</div>`;
}

function articleHref(item) {
  return `#/article/${encodeURIComponent(item.id)}`;
}

// ---------- Views ----------

function renderHome() {
  const grouped = groupByCategory(DATA.items);
  const columns = CATEGORY_ORDER.map((category) => {
    const list = (grouped.get(category) || []).slice(0, HOME_ITEMS_PER_CATEGORY);
    const cards = list.length
      ? list.map((item) => `
        <a class="mini-card" href="${articleHref(item)}">
          ${imageOrPlaceholder(item)}
          <span class="title">${escapeHtml(item.title)}</span>
        </a>`).join("")
      : `<p class="empty">수집된 기사가 없습니다.</p>`;
    return `
      <section class="category-column">
        <div class="category-column-header">
          <h2>${CATEGORY_EMOJI[category] || ""} ${escapeHtml(category)}</h2>
          <a href="#/category/${encodeURIComponent(category)}">더보기</a>
        </div>
        ${cards}
      </section>`;
  }).join("");

  app.innerHTML = `<div class="category-grid">${columns}</div>`;
}

function renderCategory(category) {
  const list = DATA.items.filter((item) => item.category === category);
  const cards = list.length
    ? list.map((item) => `
      <a class="article-card" href="${articleHref(item)}">
        ${imageOrPlaceholder(item)}
        <div class="body">
          <span class="title">${escapeHtml(item.title)}</span>
          ${item.summary ? `<span class="summary">${escapeHtml(item.summary)}</span>` : ""}
          <span class="meta">${escapeHtml(item.source)} · ${formatDate(item.pubDate)}</span>
        </div>
      </a>`).join("")
    : `<p class="empty">이 카테고리에는 아직 수집된 기사가 없습니다.</p>`;

  app.innerHTML = `
    <div class="page-title">
      <a class="back-link" href="#/">← 홈</a>
      <h1>${CATEGORY_EMOJI[category] || ""} ${escapeHtml(category)}</h1>
    </div>
    <div class="article-list">${cards}</div>`;
}

function renderArticle(id) {
  const item = DATA.items.find((i) => i.id === id);
  if (!item) {
    app.innerHTML = `
      <div class="page-title"><a class="back-link" href="#/">← 홈</a></div>
      <p class="empty">기사를 찾을 수 없습니다. 목록에서 삭제되었거나 만료된 기사일 수 있어요.</p>`;
    return;
  }
  const paragraphs = (item.paragraphs && item.paragraphs.length)
    ? item.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")
    : (item.summary ? `<p>${escapeHtml(item.summary)}</p>` : `<p class="empty">본문 요약을 가져오지 못했습니다. 아래 원문 링크에서 확인해주세요.</p>`);

  app.innerHTML = `
    <div class="page-title">
      <a class="back-link" href="#/category/${encodeURIComponent(item.category)}">← ${escapeHtml(item.category)}</a>
    </div>
    <article class="article-detail">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />` : ""}
      <h1>${escapeHtml(item.title)}</h1>
      <div class="meta">${escapeHtml(item.source)} · ${formatDate(item.pubDate)}</div>
      ${paragraphs}
      <a class="source-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">원문에서 전체 기사 보기 →</a>
    </article>`;
}

// ---------- Router ----------

function route() {
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);

  window.scrollTo(0, 0);

  if (parts.length === 0) return renderHome();
  if (parts[0] === "category" && parts[1]) return renderCategory(decodeURIComponent(parts[1]));
  if (parts[0] === "article" && parts[1]) return renderArticle(decodeURIComponent(parts[1]));
  return renderHome();
}

async function init() {
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    DATA = await res.json();
    const updatedEl = document.getElementById("updated-at");
    if (updatedEl && DATA.updatedAt) {
      updatedEl.textContent = `마지막 업데이트: ${formatDate(DATA.updatedAt)} (KST) · 총 ${DATA.items.length}건`;
    }
  } catch (err) {
    app.innerHTML = `<p class="empty">뉴스 데이터를 불러오지 못했습니다.</p>`;
    console.error(err);
    return;
  }
  route();
}

window.addEventListener("hashchange", route);
init();
