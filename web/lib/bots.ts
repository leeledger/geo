/**
 * AI 크롤러 판별.
 *
 * 검색엔진 봇(Googlebot 등)도 함께 본다. 구글 AI 개요는 검색 색인을 쓰므로
 * Googlebot 방문이 곧 AI 노출의 전제가 된다.
 * 목록은 각 사가 공개한 User-agent 문자열 기준이다.
 */
export type Bot = { bot: string; vendor: string };

const TABLE: [RegExp, string, string][] = [
  // ── AI 학습·검색
  [/GPTBot/i,                 "GPTBot",            "openai"],
  [/OAI-SearchBot/i,          "OAI-SearchBot",     "openai"],
  [/ChatGPT-User/i,           "ChatGPT-User",      "openai"],
  [/ClaudeBot/i,              "ClaudeBot",         "anthropic"],
  [/Claude-SearchBot/i,       "Claude-SearchBot",  "anthropic"],
  [/Claude-User/i,            "Claude-User",       "anthropic"],
  [/anthropic-ai/i,           "anthropic-ai",      "anthropic"],
  [/PerplexityBot/i,          "PerplexityBot",     "perplexity"],
  [/Perplexity-User/i,        "Perplexity-User",   "perplexity"],
  [/Google-Extended/i,        "Google-Extended",   "google"],
  [/Google-CloudVertexBot/i,  "Vertex",            "google"],
  [/Applebot-Extended/i,      "Applebot-Extended", "apple"],
  [/meta-externalagent/i,     "meta-externalagent","meta"],
  [/FacebookBot/i,            "FacebookBot",       "meta"],
  [/Bytespider/i,             "Bytespider",        "bytedance"],
  [/CCBot/i,                  "CCBot",             "commoncrawl"],
  [/Amazonbot/i,              "Amazonbot",         "amazon"],
  [/YouBot/i,                 "YouBot",            "you"],
  [/cohere-ai/i,              "cohere-ai",         "cohere"],
  [/Diffbot/i,                "Diffbot",           "diffbot"],
  // ── 검색 색인 (AI 답변의 전제)
  // Applebot 은 Siri·Spotlight·Safari 검색용이다. AI 학습 허용은 Applebot-Extended 토큰이 따로 한다(2026-09-22 정정).
  // Applebot-Extended 가 위 칸에서 먼저 걸리므로 순서를 바꿔도 판별은 같다
  [/Applebot/i,               "Applebot",          "apple"],
  [/Googlebot/i,              "Googlebot",         "google"],
  [/bingbot|BingPreview/i,    "Bingbot",           "microsoft"],
  [/Yeti/i,                   "Yeti",              "naver"],
  [/DuckDuckBot/i,            "DuckDuckBot",       "duckduckgo"],
];

export function identify(ua: string | null): Bot | null {
  if (!ua) return null;
  for (const [re, bot, vendor] of TABLE) {
    if (re.test(ua)) return { bot, vendor };
  }
  return null;
}
