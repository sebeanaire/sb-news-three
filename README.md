# sb-news-three

AI · 부동산 · 금융 · 콘텐츠 뉴스를 RSS로 3시간마다 자동 수집해서, 사진(이미지) + 제목 + 요약 카드로 보여주는 정적 뉴스 사이트입니다.

## 화면 구성

- **홈** — 카테고리(AI / 부동산 / 금융 / 콘텐츠)별로 4개 컬럼이 나란히 보이고, 각 기사는 사진 + 제목만 표시됩니다.
- **카테고리 전체 보기** — 홈에서 "더보기"를 누르면 해당 카테고리의 모든 기사를 사진 + 제목 + 요약으로 볼 수 있습니다.
- **기사 상세** — 카드를 클릭하면 사진, 제목, 본문 요약(여러 문단)을 사이트 안에서 바로 보여주고, 하단의 "원문에서 전체 기사 보기" 버튼으로 원문 기사로 이동할 수 있습니다.

## 구성

- `scripts/feeds.mjs` — 수집 대상 RSS 피드 목록과 카테고리(고정/키워드 분류) 정의
- `scripts/collect.mjs` — 피드 수집 → 이미지/요약/본문 문단 추출(og:image, 본문 스크래핑 포함) → `data/news.json`, `docs/data.json` 갱신
- `docs/` — Vercel에 배포되는 정적 사이트(순수 HTML/CSS/JS, 빌드 도구 없음)
- `.github/workflows/collect.yml` — 3시간마다 `scripts/collect.mjs`를 실행해 데이터를 갱신하고 커밋

## 로컬 실행

```bash
npm install
node scripts/collect.mjs   # data/news.json, docs/data.json 갱신
python -m http.server 8000 --directory docs   # 로컬에서 미리보기
```

## 배포

Vercel 프로젝트가 이 저장소(main 브랜치)에 연결되어 있고, `vercel.json`의 `outputDirectory`가 `docs`로 설정되어 있어 별도 빌드 없이 정적 파일을 그대로 서빙합니다. GitHub Actions가 주기적으로 `docs/data.json`을 갱신·커밋하면 Vercel이 자동으로 재배포합니다.
