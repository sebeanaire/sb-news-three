export const CATEGORY_ORDER = ["AI", "부동산", "금융", "콘텐츠"];

export const CATEGORY_EMOJI = {
  AI: "🤖",
  부동산: "🏢",
  금융: "💰",
  콘텐츠: "🎬",
};

// 카테고리가 고정된 피드
export const FEEDS = [
  { name: "AI타임스", url: "https://www.aitimes.com/rss/allArticle.xml", category: "AI" },
  { name: "블로터", url: "https://www.bloter.net/rss/allArticle.xml", category: "콘텐츠" },
  { name: "미디어오늘", url: "https://www.mediatoday.co.kr/rss/allArticle.xml", category: "콘텐츠" },
];

// 종합 경제/산업 피드 — 제목 키워드로 부동산/금융 카테고리를 분류해서 사용
export const ROUTED_FEEDS = [
  { name: "연합뉴스 경제", url: "https://www.yna.co.kr/rss/economy.xml" },
  { name: "연합뉴스 산업", url: "https://www.yna.co.kr/rss/industry.xml" },
];

export const CATEGORY_KEYWORDS = {
  부동산: ["부동산", "아파트", "분양", "전세", "월세", "재건축", "재개발", "주택", "청약", "임대", "집값", "오피스텔", "LH", "건설사", "미분양"],
  금융: ["금리", "증권", "주가", "코스피", "코스닥", "펀드", "은행", "대출", "채권", "환율", "금융위", "금융감독원", "카드사", "보험", "IPO", "상장", "증시", "국고채", "달러", "코인", "가상자산"],
};
