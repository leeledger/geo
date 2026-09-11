/**
 * AI·검색 크롤러 판별 — 사이티드 크롤러 기록용.
 *
 * 사람 방문은 판별하지 않는다(null). 목록은 각 사가 공개한 User-agent 문자열 기준이다.
 * 검색엔진 봇도 같이 본다. 구글 AI 개요·Copilot·네이버 AI 브리핑은 검색 색인을 쓰므로
 * 색인 크롤러 방문이 곧 AI 노출의 전제가 된다.
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
  [/Applebot/i,               "Applebot",          "apple"],
  [/meta-externalagent/i,     "meta-externalagent","meta"],
  [/FacebookBot/i,            "FacebookBot",       "meta"],
  [/Bytespider/i,             "Bytespider",        "bytedance"],
  [/CCBot/i,                  "CCBot",             "commoncrawl"],
  [/Amazonbot/i,              "Amazonbot",         "amazon"],
  [/YouBot/i,                 "YouBot",            "you"],
  [/cohere-ai/i,              "cohere-ai",         "cohere"],
  [/Diffbot/i,                "Diffbot",           "diffbot"],
  // ── 검색 색인 (AI 답변의 전제)
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
