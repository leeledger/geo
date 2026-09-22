/**
 * 크롤러 분류 — AI · 검색 · 기타.
 *
 * 원본은 academy/lib/bots.ts 의 판별표 두 칸이다(「AI 학습·검색」 칸 / 「검색 색인」 칸).
 * web 은 Vercel 에서 web/ 만 올라가 그 파일을 못 읽는다. 그래서 봇 이름만 여기 베껴 둔다.
 * academy/scripts/case-report.mjs 가 같은 두 칸으로 가른다 — 원장 화면과 공개본의 「AI 방문」이 같은 정의다.
 * 어느 칸에도 없는 봇은 「기타」. AI 로 부풀리지 않는다.
 *
 * bots.ts 를 고치면 `node web/scripts/check-crawler-class.mjs` 로 두 목록이 같은지 본다.
 */

export const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Vertex", "Applebot-Extended",
  "meta-externalagent", "FacebookBot", "Bytespider", "CCBot", "Amazonbot", "YouBot", "cohere-ai", "Diffbot",
];

/** Applebot 은 Siri·Spotlight·Safari 검색용이라 여기다(2026-09-22 정정) */
export const SEARCH_BOTS = ["Applebot", "Googlebot", "Bingbot", "Yeti", "DuckDuckBot"];
