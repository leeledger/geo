/**
 * GEO 진단 엔진 — probe/src/scan.js 를 서버에서 재사용 가능한 순수 함수로 이식.
 *
 * 원본과의 차이: 파일을 쓰지 않고 결과 객체만 돌려준다. CLI 출력 없음.
 * 검사하는 것은 전부 "코드로 확인 가능한 사실"이다.
 * 브랜드 권위·E-E-A-T 같은 판단 항목은 점수에 넣지 않는다 — 점수로 위장한 감상은 팔 수 없다.
 */

const UA = "Mozilla/5.0 (compatible; siteband-scan/0.1; +diagnostics)";

export type Note = { pri: 1 | 2 | 3; msg: string };
export type BotResult = { id: string; label: string; weight: number; allowed: boolean; explicit: boolean };
export type ScanResult = {
  origin: string;
  scannedAt: string;
  total: number;
  grade: "우수" | "보통" | "미흡" | "위험";
  checks: Record<string, any>;
  weights: { key: string; weight: number; label: string; score: number }[];
  pages: { url: string; ok: boolean; textLen?: number; status?: number }[];
  notes: Note[];
  error?: string;
};

async function get(url: string, timeoutMs = 15000) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status, body: res.ok ? await res.text() : "" };
  } catch {
    return { ok: false, status: 0, body: "" };
  }
}

const stripTags = (h: string) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
   .replace(/<style[\s\S]*?<\/style>/gi, " ")
   .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
   .replace(/<[^>]+>/g, " ")
   .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/\s+/g, " ").trim();

const blocks = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((m) => stripTags(m[1])).filter(Boolean);

function jsonLd(html: string) {
  const out: any[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch { out.push({ __invalid: true }); }
  }
  return out;
}

function ldTypes(nodes: any[]) {
  const types = new Set<string>();
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    const t = n["@type"];
    if (typeof t === "string") types.add(t);
    if (Array.isArray(t)) t.forEach((x: any) => typeof x === "string" && types.add(x));
    if (n["@graph"]) walk(n["@graph"]);
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
  };
  nodes.forEach(walk);
  return types;
}

type RobotGroup = { agents: string[]; rules: { type: string; path: string }[] };

function parseRobots(txt: string): RobotGroup[] {
  const groups: RobotGroup[] = [];
  let cur: RobotGroup | null = null;
  for (const line of txt.split(/\r?\n/)) {
    const s = line.replace(/#.*$/, "").trim();
    if (!s) continue;
    const i = s.indexOf(":");
    if (i < 0) continue;
    const k = s.slice(0, i).trim().toLowerCase();
    const v = s.slice(i + 1).trim();
    if (k === "user-agent") {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
    } else if ((k === "allow" || k === "disallow") && cur) {
      cur.rules.push({ type: k, path: v });
    }
  }
  return groups;
}

/** 명시 그룹이 있으면 그것만 본다(표준 동작). 루트 전면 차단만 '차단'으로 센다. */
function botAllowed(groups: RobotGroup[], bot: string) {
  const b = bot.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(b));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const g = specific ?? wildcard;
  if (!g) return { allowed: true, explicit: false };
  const blanket = g.rules.some((r) => r.type === "disallow" && r.path === "/");
  return { allowed: !blanket, explicit: Boolean(specific) };
}

const BOTS = [
  { id: "OAI-SearchBot",   label: "ChatGPT 검색",      weight: 3 },
  { id: "ChatGPT-User",    label: "ChatGPT 사용자요청", weight: 3 },
  { id: "PerplexityBot",   label: "Perplexity",       weight: 3 },
  { id: "Perplexity-User", label: "Perplexity 사용자", weight: 2 },
  { id: "ClaudeBot",       label: "Claude",           weight: 3 },
  { id: "Googlebot",       label: "구글 색인",         weight: 3 },
  { id: "Bingbot",         label: "Bing/Copilot",     weight: 2 },
  { id: "Yeti",            label: "네이버",            weight: 2 },
  { id: "GPTBot",          label: "OpenAI 학습",       weight: 1 },
  { id: "Google-Extended", label: "Gemini 학습",       weight: 1 },
  { id: "CCBot",           label: "Common Crawl",     weight: 1 },
];

export const SITE_LABELS: Record<string, string> = {
  crawler: "AI 크롤러 접근", ssr: "본문 추출 가능성", schema: "구조화 데이터",
  chunk: "인용 가능한 문단", patterns: "AI 친화 패턴", llmstxt: "llms.txt", sitemap: "sitemap.xml",
};

const WEIGHTS: [string, number][] = [
  ["crawler", 25], ["ssr", 20], ["schema", 20], ["chunk", 15],
  ["patterns", 10], ["llmstxt", 7], ["sitemap", 3],
];

export function normalizeTarget(raw: string): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    // 사설망·로컬 차단 (SSRF 방어)
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) return null;
    return u.origin;
  } catch { return null; }
}

export async function scanSite(rawTarget: string, maxPages = 5): Promise<ScanResult> {
  const origin = normalizeTarget(rawTarget);
  if (!origin) {
    return {
      origin: rawTarget, scannedAt: new Date().toISOString(), total: 0, grade: "위험",
      checks: {}, weights: [], pages: [], notes: [], error: "올바른 주소가 아닙니다",
    };
  }

  const checks: Record<string, any> = {};
  const notes: Note[] = [];

  /* 1) AI 크롤러 접근 */
  const rb = await get(`${origin}/robots.txt`);
  if (!rb.ok) {
    checks.crawler = { score: 60, bots: [] as BotResult[], noRobots: true };
    notes.push({ pri: 2, msg: "robots.txt 가 없습니다. AI 크롤러를 User-agent 별로 명시 허용하세요." });
  } else {
    const groups = parseRobots(rb.body);
    const bots: BotResult[] = BOTS.map((b) => ({ ...b, ...botAllowed(groups, b.id) }));
    const totalW = bots.reduce((s, b) => s + b.weight, 0);
    const gotW = bots.reduce((s, b) => s + (b.allowed ? b.weight * (b.explicit ? 1 : 0.85) : 0), 0);
    const blocked = bots.filter((b) => !b.allowed);
    checks.crawler = { score: Math.round((gotW / totalW) * 100), bots, blocked: blocked.map((b) => b.id) };
    if (blocked.length)
      notes.push({ pri: 1, msg: `robots.txt 가 ${blocked.map((b) => b.id).join(", ")} 를 차단합니다. 이게 막히면 나머지 작업이 전부 무의미합니다.` });
    else if (!bots.some((b) => b.explicit))
      notes.push({ pri: 2, msg: "AI 크롤러가 * 규칙으로만 허용됩니다. User-agent 별로 명시하면 의도가 분명해집니다." });
  }

  /* 2) llms.txt */
  const lt = await get(`${origin}/llms.txt`);
  if (!lt.ok) {
    checks.llmstxt = { score: 0, exists: false };
    notes.push({ pri: 2, msg: "llms.txt 가 없습니다. AI가 그대로 인용할 브랜드 설명문을 길이별로 넣으세요." });
  } else {
    const bytes = new TextEncoder().encode(lt.body).length;
    const sections = (lt.body.match(/^##\s+/gm) || []).length;
    const hasEntity = /엔티티|entity/i.test(lt.body);
    checks.llmstxt = {
      score: Math.min(100, (bytes > 800 ? 50 : 25) + Math.min(30, sections * 5) + (hasEntity ? 20 : 0)),
      exists: true, bytes, sections,
    };
    if (bytes < 800) notes.push({ pri: 3, msg: "llms.txt 가 너무 짧습니다. 회사 소개가 아니라 인용용 설명문을 담으세요." });
  }

  /* 3) 페이지 수집 */
  const sm = await get(`${origin}/sitemap.xml`);
  let urls: string[] = [];
  if (sm.ok) {
    urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (urls.length && urls[0].endsWith(".xml")) {
      const sub = await get(urls[0]);
      if (sub.ok) urls = [...sub.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    }
  }
  checks.sitemap = { score: sm.ok ? 100 : 0, exists: sm.ok, urls: urls.length };
  if (!sm.ok) notes.push({ pri: 3, msg: "sitemap.xml 이 없습니다. 색인이 안 되면 검색층에서 탈락합니다." });

  const skip = /\/(privacy|terms|policy|약관|login|signup|cart)\b/i;
  const picked = urls.filter((u) => !skip.test(u) && !u.endsWith(".xml") && u.startsWith(origin)).slice(0, maxPages - 1);
  const pageUrls = [...new Set([origin, ...picked])].slice(0, maxPages);

  /* 4) 페이지 분석 (동시) */
  const pages = await Promise.all(pageUrls.map(async (u) => {
    const r = await get(u);
    if (!r.ok) return { url: u, ok: false as const, status: r.status };
    const html = r.body;
    const text = stripTags(html);
    const ld = jsonLd(html);
    const paras = blocks(html, "p").filter((t) => t.length > 20);
    const items = blocks(html, "li").filter((t) => t.length > 10);
    const headings = [...blocks(html, "h1"), ...blocks(html, "h2"), ...blocks(html, "h3")];
    return {
      url: u, ok: true as const,
      textLen: text.length,
      textRatio: html.length ? text.length / html.length : 0,
      ldCount: ld.length,
      ldInvalid: ld.filter((x: any) => x.__invalid).length,
      types: [...ldTypes(ld)],
      paras: paras.length, items: items.length,
      inBand: paras.filter((t) => t.length >= 80 && t.length <= 400).length,
      tooLong: paras.filter((t) => t.length > 800).length,
      qHeadings: headings.filter((h) => /[?？]|무엇|어떻게|왜|얼마|어디|언제|인가요|하나요|할까/.test(h)).length,
      vague: (text.match(/(?:^|[.!?]\s+)(우리는|저희는|저희가|당사는|본 서비스는|이 서비스는|여기서는|우리가)/g) || []).length,
      nums: (text.match(/\d+(?:[.,]\d+)?\s*(?:%|원|만원|개|회|건|년|월|일|배|시간|분)/g) || []).length,
      hasTable: /<table[\s>]/i.test(html),
      hasList: /<[ou]l[\s>]/i.test(html),
      hasMeta: Boolean(/<title[^>]*>[^<]+<\/title>/i.test(html) && /<meta[^>]+name=["']description["']/i.test(html)),
    };
  }));

  const ok = pages.filter((p): p is Extract<typeof p, { ok: true }> => p.ok);
  const avg = (f: (p: any) => number) => (ok.length ? ok.reduce((s, p) => s + f(p), 0) / ok.length : 0);

  /* 4a) SSR */
  const avgLen = avg((p) => p.textLen);
  const ratio = avg((p) => p.textRatio);
  const thin = ok.filter((p) => p.textLen < 1200).length;
  let ssr = 100;
  if (avgLen < 600) ssr = 10; else if (avgLen < 1200) ssr = 35; else if (avgLen < 2500) ssr = 70;
  if (ratio < 0.02) ssr = Math.min(ssr, 30);
  checks.ssr = { score: ssr, avgTextLen: Math.round(avgLen), thinPages: thin, totalPages: ok.length };
  if (ok.length && thin > ok.length / 2)
    notes.push({ pri: 1, msg: `${thin}/${ok.length} 페이지가 자바스크립트 없이는 본문이 거의 없습니다. AI 크롤러도 같은 것을 봅니다 — 서버 렌더링(SSR)이 필요합니다.` });

  /* 4b) 스키마 */
  const withLd = ok.filter((p) => p.ldCount > 0).length;
  const allTypes = new Set(ok.flatMap((p) => p.types));
  const want = ["Organization", "WebSite", "Article", "FAQPage", "BreadcrumbList", "Product", "HowTo", "LocalBusiness"];
  const hit = want.filter((t) => allTypes.has(t));
  const invalid = ok.reduce((s, p) => s + p.ldInvalid, 0);
  const cover = ok.length ? withLd / ok.length : 0;
  checks.schema = {
    score: Math.max(0, Math.round(cover * 55 + Math.min(45, hit.length * 9) - invalid * 10)),
    pagesWithLd: withLd, totalPages: ok.length, types: [...allTypes], invalid,
  };
  if (ok.length && !withLd) notes.push({ pri: 1, msg: "JSON-LD 구조화 데이터가 한 페이지에도 없습니다. Organization·Article·FAQPage 부터 넣으세요." });
  else if (ok.length && !allTypes.has("FAQPage") && !allTypes.has("HowTo"))
    notes.push({ pri: 2, msg: "FAQPage / HowTo 스키마가 없습니다. 질문-답변 형태가 AI 인용에 가장 잘 걸립니다." });
  if (invalid) notes.push({ pri: 2, msg: `JSON-LD ${invalid}건이 파싱에 실패합니다 — 있으나 마나입니다.` });

  /* 4c) 청크 (한국어는 글자 수 기준) */
  const totalParas = ok.reduce((s, p) => s + p.paras, 0);
  const band = ok.reduce((s, p) => s + p.inBand, 0);
  const long = ok.reduce((s, p) => s + p.tooLong, 0);
  const vague = ok.reduce((s, p) => s + p.vague, 0);
  const bandRate = totalParas ? band / totalParas : 0;
  const longRate = totalParas ? long / totalParas : 0;
  checks.chunk = {
    score: totalParas < 5 ? 10 : Math.max(0, Math.round(bandRate * 85 + 15 - longRate * 60 - Math.min(20, vague * 2))),
    paragraphs: totalParas, listItems: ok.reduce((s, p) => s + p.items, 0),
    inBand: band, bandRate: +(bandRate * 100).toFixed(1), vagueSubjects: vague,
  };
  if (ok.length && totalParas < 5) notes.push({ pri: 1, msg: "산문 문단이 거의 없습니다. AI가 떼어갈 문장 자체가 없다는 뜻입니다." });
  else if (bandRate < 0.35 && totalParas > 10)
    notes.push({ pri: 2, msg: `문단의 ${(bandRate * 100).toFixed(0)}%만 인용하기 좋은 길이입니다. 한 문단 = 한 주제, 80~400자로 쪼개세요.` });
  if (vague > 5) notes.push({ pri: 2, msg: `"우리는·저희는" 같은 대명사 주어가 ${vague}회 나옵니다. AI가 문장만 떼어가면 주어가 사라집니다 — 브랜드명을 문장 안에 넣으세요.` });

  /* 4d) 패턴 */
  const qh = ok.reduce((s, p) => s + p.qHeadings, 0);
  const nums = ok.reduce((s, p) => s + p.nums, 0);
  const tables = ok.filter((p) => p.hasTable).length;
  const lists = ok.filter((p) => p.hasList).length;
  const metas = ok.filter((p) => p.hasMeta).length;
  checks.patterns = {
    score: Math.min(100, Math.round(
      Math.min(30, qh * 6) + Math.min(30, nums * 1.5) + (tables ? 15 : 0) +
      (lists / Math.max(1, ok.length)) * 10 + (metas / Math.max(1, ok.length)) * 15)),
    questionHeadings: qh, numericFacts: nums, pagesWithTable: tables,
  };
  if (ok.length && qh === 0) notes.push({ pri: 2, msg: "질문형 제목이 하나도 없습니다. 사람이 AI에게 묻는 문장을 그대로 제목으로 쓰세요." });
  if (ok.length && nums < 5) notes.push({ pri: 3, msg: "수치가 거의 없습니다. AI는 숫자·조건이 붙은 문장을 인용합니다." });

  const total = Math.round(WEIGHTS.reduce((s, [k, w]) => s + (checks[k]?.score ?? 0) * w, 0) / 100);
  const grade = total >= 80 ? "우수" : total >= 60 ? "보통" : total >= 40 ? "미흡" : "위험";

  return {
    origin, scannedAt: new Date().toISOString(), total, grade, checks,
    weights: WEIGHTS.map(([key, weight]) => ({ key, weight, label: SITE_LABELS[key], score: checks[key]?.score ?? 0 })),
    pages: pages.map((p) => ({ url: p.url, ok: p.ok, textLen: (p as any).textLen, status: (p as any).status })),
    notes: notes.sort((a, b) => a.pri - b.pri),
  };
}
