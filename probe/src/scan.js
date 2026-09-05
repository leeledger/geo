/**
 * GEO 진단기 — 도메인 하나를 받아 "AI가 이 사이트를 읽고 인용할 수 있는가"를 점수로 낸다.
 * API 키 불필요. 의존성 0. Node 22+.
 *
 *   node src/scan.js georank.co.kr
 *   node src/scan.js https://example.com --pages 8
 *   node src/scan.js example.com --json > report.json
 *
 * 검사하는 것은 전부 "코드로 확인 가능한 사실"이다.
 * 판단이 섞이는 항목(E-E-A-T, 브랜드 권위)은 넣지 않았다 — 점수로 위장한 감상은 팔 수 없다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./store.js";
import { detectPlatform, platformAdvice, CAP_LABEL, PUBLISH_LABEL } from "./platform.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = parseArgs(process.argv.slice(2));
const rawTarget = args._[0];
if (!rawTarget) {
  console.error("사용법: node src/scan.js <도메인> [--pages N] [--json]");
  process.exit(1);
}
const origin = new URL(rawTarget.startsWith("http") ? rawTarget : `https://${rawTarget}`).origin;
const MAX_PAGES = Number(args.pages ?? 6);
const UA = "Mozilla/5.0 (compatible; geo-scan/0.1; +diagnostics)";

async function get(url, timeoutMs = 20000) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const headers = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { ok: res.ok, status: res.status, body: res.ok ? await res.text() : "", url: res.url, headers };
  } catch (e) {
    return { ok: false, status: 0, body: "", error: e.message, headers: {} };
  }
}

/* ───────────────────────── HTML 유틸 (의존성 없이) ───────────────────────── */

const stripTags = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
   .replace(/<style[\s\S]*?<\/style>/gi, " ")
   .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
   .replace(/<[^>]+>/g, " ")
   .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/\s+/g, " ").trim();

const blocks = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((m) => stripTags(m[1])).filter(Boolean);

function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch { /* 깨진 JSON-LD 도 정보다 — 아래에서 센다 */ out.push({ __invalid: true }); }
  }
  return out;
}

function ldTypes(nodes) {
  const types = new Set();
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    const t = n["@type"];
    if (typeof t === "string") types.add(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
    if (n["@graph"]) walk(n["@graph"]);
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
  };
  nodes.forEach(walk);
  return types;
}

/* ───────────────────────── robots.txt 파서 ───────────────────────── */

function parseRobots(txt) {
  const groups = [];
  let cur = null;
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

// 특정 봇에게 "/" 가 허용되는가. 명시 그룹이 있으면 그것만 본다(표준 동작).
function botAllowed(groups, bot) {
  const b = bot.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(b));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const g = specific ?? wildcard;
  if (!g) return { allowed: true, basis: "규칙 없음" };
  // 루트를 막는 Disallow 가 있는가
  const blocksRoot = g.rules.some((r) => r.type === "disallow" && (r.path === "/" || r.path === ""));
  const blanketDisallow = g.rules.some((r) => r.type === "disallow" && r.path === "/");
  return {
    allowed: !blanketDisallow,
    basis: specific ? "명시 그룹" : "* 그룹",
    explicit: Boolean(specific),
  };
}

const BOTS = [
  // 답변·인용에 직접 관여 (가중 높음)
  { id: "OAI-SearchBot",  label: "ChatGPT 검색",     weight: 3 },
  { id: "ChatGPT-User",   label: "ChatGPT 사용자요청", weight: 3 },
  { id: "PerplexityBot",  label: "Perplexity",       weight: 3 },
  { id: "Perplexity-User",label: "Perplexity 사용자", weight: 2 },
  { id: "ClaudeBot",      label: "Claude",           weight: 3 },
  { id: "Googlebot",      label: "구글 색인",         weight: 3 },
  { id: "Bingbot",        label: "Bing/Copilot",     weight: 2 },
  { id: "Yeti",           label: "네이버",            weight: 2 },
  // 학습 데이터 (장기)
  { id: "GPTBot",         label: "OpenAI 학습",       weight: 1 },
  { id: "Google-Extended",label: "Gemini 학습",       weight: 1 },
  { id: "CCBot",          label: "Common Crawl",     weight: 1 },
];

/* ───────────────────────── 검사 ───────────────────────── */

// apex 만 시도하면 www 로만 서비스하는 사이트를 "본문 0자"로 오진한다.
// 국내 사이트 다수가 그렇다. 잘못된 진단을 고객에게 보내면 신뢰가 끝난다.
async function resolveOrigin(o) {
  const u = new URL(o);
  const cands = u.hostname.startsWith("www.")
    ? [o, `${u.protocol}//${u.hostname.replace(/^www\./, "")}`]
    : [o, `${u.protocol}//www.${u.hostname}`];
  for (const c of cands) {
    const r = await get(c, 12000);
    if (r.ok && r.body.length > 0) return { origin: c, ok: true };
  }
  return { origin: o, ok: false };
}

const resolved = await resolveOrigin(origin);
if (!resolved.ok) {
  console.error(`
✗ ${origin} 에 접속하지 못했습니다 (apex·www 모두 실패). 진단을 건너뜁니다.`);
  process.exit(2);
}
const base = resolved.origin;

const checks = {};
const notes = [];

console.error(`대상: ${origin}\n`);

// 1) robots.txt / AI 크롤러 접근성
{
  const r = await get(`${base}/robots.txt`);
  if (!r.ok) {
    checks.crawler = { score: 60, detail: "robots.txt 없음 — 기본적으로 전부 허용이지만 명시적 신호가 없다", bots: [] };
    notes.push({ pri: 2, msg: "robots.txt 를 만들고 AI 크롤러를 User-agent 별로 명시 허용하세요" });
  } else {
    const groups = parseRobots(r.body);
    const bots = BOTS.map((b) => ({ ...b, ...botAllowed(groups, b.id) }));
    const totalW = bots.reduce((s, b) => s + b.weight, 0);
    const gotW = bots.reduce((s, b) => s + (b.allowed ? b.weight * (b.explicit ? 1 : 0.85) : 0), 0);
    const blocked = bots.filter((b) => !b.allowed);
    checks.crawler = { score: Math.round((gotW / totalW) * 100), bots, blocked: blocked.map((b) => b.id) };
    if (blocked.length)
      notes.push({ pri: 1, msg: `robots.txt 가 ${blocked.map((b) => b.id).join(", ")} 를 차단합니다. 이게 막히면 나머지 작업이 전부 무의미합니다` });
    else if (!bots.some((b) => b.explicit))
      notes.push({ pri: 2, msg: "AI 크롤러가 * 규칙으로만 허용됩니다. User-agent 별로 명시하면 의도가 분명해집니다" });
  }
}

// 2) llms.txt
{
  const r = await get(`${base}/llms.txt`);
  if (!r.ok) {
    checks.llmstxt = { score: 0, exists: false };
    notes.push({ pri: 2, msg: "llms.txt 가 없습니다. AI가 그대로 인용할 브랜드 설명문을 길이별로 넣으세요" });
  } else {
    const bytes = Buffer.byteLength(r.body);
    const sections = (r.body.match(/^##\s+/gm) || []).length;
    const hasEntity = /엔티티|entity|Entity Definition/i.test(r.body);
    const score = Math.min(100, (bytes > 800 ? 50 : 25) + Math.min(30, sections * 5) + (hasEntity ? 20 : 0));
    checks.llmstxt = { score, exists: true, bytes, sections, hasEntity };
    if (bytes < 800) notes.push({ pri: 3, msg: "llms.txt 가 너무 짧습니다. 회사 소개가 아니라 인용용 설명문(짧은/중간/긴 버전)을 담으세요" });
  }
}

// 3) 페이지 수집 — sitemap 우선, 없으면 홈 링크
let pageUrls = [origin];
{
  const sm = await get(`${base}/sitemap.xml`);
  let urls = [];
  if (sm.ok) {
    urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    // 인덱스 사이트맵이면 첫 하위 것 하나만 더 판다
    if (urls.length && urls[0].endsWith(".xml")) {
      const sub = await get(urls[0]);
      if (sub.ok) urls = [...sub.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    }
  }
  const skip = /\/(privacy|terms|policy|약관|login|signup|cart)\b/i;
  const picked = urls.filter((u) => !skip.test(u) && !u.endsWith(".xml")).slice(0, MAX_PAGES - 1);
  pageUrls = [...new Set([base, ...picked])].slice(0, MAX_PAGES);
  checks.sitemap = { score: sm.ok ? 100 : 0, exists: sm.ok, urls: urls.length };
  if (!sm.ok) notes.push({ pri: 3, msg: "sitemap.xml 이 없습니다. 색인이 안 되면 검색층에서 탈락합니다" });
}

// 3b) 운영 형태 감지
const homeRes = await get(base);
const platform = homeRes.ok ? detectPlatform(homeRes.body, homeRes.headers, base) : null;
if (platform) notes.push(platformAdvice(platform));

// 4) 페이지별 분석 — SSR / 스키마 / 청크 / AI 친화 패턴
const pages = [];
for (const u of pageUrls) {
  const r = await get(u);
  if (!r.ok) { pages.push({ url: u, ok: false, status: r.status }); continue; }
  const html = r.body;
  const text = stripTags(html);
  const ld = jsonLd(html);
  const types = ldTypes(ld);

  // 한국어는 어절 수가 영어 단어 수보다 훨씬 적게 나온다. 글자 수로 잰다.
  // 자기완결 청크로 좋은 길이 = 대략 80~400자. 800자를 넘으면 한 문단에 주제가 섞인 것.
  const paras = blocks(html, "p").filter((t) => t.length > 20);   // 산문 문단만
  const items = blocks(html, "li").filter((t) => t.length > 10);  // 리스트는 따로 (그 자체로 인용 친화)
  const inBand = paras.filter((t) => t.length >= 80 && t.length <= 400).length;
  const tooLong = paras.filter((t) => t.length > 800).length;

  const headings = [...blocks(html, "h1"), ...blocks(html, "h2"), ...blocks(html, "h3")];
  const qHeadings = headings.filter((h) => /[?？]|무엇|어떻게|왜|얼마|어디|언제|인가요|하나요|할까/.test(h)).length;

  // 대명사 주어 — 문장만 떼어가면 지시 대상이 사라진다
  const vague = (text.match(/(?:^|[.!?]\s+)(우리는|저희는|저희가|당사는|본 서비스는|이 서비스는|여기서는|우리가)/g) || []).length;

  const hasNumbers = (text.match(/\d+(?:[.,]\d+)?\s*(?:%|원|만원|개|회|건|년|월|일|배|시간|분)/g) || []).length;

  pages.push({
    url: u, ok: true,
    textLen: text.length,
    htmlLen: html.length,
    textRatio: html.length ? text.length / html.length : 0,
    ldCount: ld.length,
    ldInvalid: ld.filter((x) => x.__invalid).length,
    types: [...types],
    paras: paras.length, items: items.length, inBand, tooLong,
    headings: headings.length, qHeadings,
    vague, hasNumbers,
    hasTable: /<table[\s>]/i.test(html),
    hasList: /<[ou]l[\s>]/i.test(html),
    lang: (html.match(/<html[^>]+lang=["']([^"']+)/i) || [])[1] ?? null,
    title: (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() ?? null,
    desc: (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] ?? null,
  });
  process.stderr.write(".");
}
process.stderr.write("\n\n");

const okPages = pages.filter((p) => p.ok);
const avg = (f) => (okPages.length ? okPages.reduce((s, p) => s + f(p), 0) / okPages.length : 0);

// 4a) SSR / 본문 추출 가능성
{
  const thin = okPages.filter((p) => p.textLen < 1200).length;
  const avgLen = avg((p) => p.textLen);
  const ratio = avg((p) => p.textRatio);
  let score = 100;
  if (avgLen < 600) score = 10;
  else if (avgLen < 1200) score = 35;
  else if (avgLen < 2500) score = 70;
  if (ratio < 0.02) score = Math.min(score, 30);
  checks.ssr = { score, avgTextLen: Math.round(avgLen), textRatio: +ratio.toFixed(4), thinPages: thin, totalPages: okPages.length };
  if (thin > okPages.length / 2)
    notes.push({ pri: 1, msg: `${thin}/${okPages.length} 페이지가 JS 없이는 본문이 거의 없습니다. AI 크롤러도 같은 것을 봅니다 — 서버 렌더링(SSR)이 필요합니다` });
}

// 4b) 구조화 데이터
{
  const withLd = okPages.filter((p) => p.ldCount > 0).length;
  const allTypes = new Set(okPages.flatMap((p) => p.types));
  const want = ["Organization", "WebSite", "Article", "FAQPage", "BreadcrumbList", "Product", "HowTo", "LocalBusiness"];
  const hit = want.filter((t) => allTypes.has(t));
  const invalid = okPages.reduce((s, p) => s + p.ldInvalid, 0);
  const cover = okPages.length ? withLd / okPages.length : 0;
  const score = Math.max(0, Math.round(cover * 55 + Math.min(45, hit.length * 9) - invalid * 10));
  checks.schema = { score, pagesWithLd: withLd, totalPages: okPages.length, types: [...allTypes], matched: hit, invalid };
  if (!withLd) notes.push({ pri: 1, msg: "JSON-LD 구조화 데이터가 한 페이지에도 없습니다. Organization·Article·FAQPage 부터 넣으세요" });
  else if (!allTypes.has("FAQPage") && !allTypes.has("HowTo"))
    notes.push({ pri: 2, msg: "FAQPage / HowTo 스키마가 없습니다. 질문-답변 형태가 AI 인용에 가장 잘 걸립니다" });
  if (invalid) notes.push({ pri: 2, msg: `JSON-LD ${invalid}건이 파싱 실패합니다 — 있으나 마나입니다` });
}

// 4c) 청크·인용 가능성
{
  const totalParas = okPages.reduce((s, p) => s + p.paras, 0);
  const totalItems = okPages.reduce((s, p) => s + p.items, 0);
  const band = okPages.reduce((s, p) => s + p.inBand, 0);
  const long = okPages.reduce((s, p) => s + p.tooLong, 0);
  const vague = okPages.reduce((s, p) => s + p.vague, 0);
  const bandRate = totalParas ? band / totalParas : 0;
  const longRate = totalParas ? long / totalParas : 0;
  // 문단이 아예 없는 사이트(이미지·테이블로만 된 페이지)는 인용될 문장 자체가 없다
  const score = totalParas < 5
    ? 10
    : Math.max(0, Math.round(bandRate * 85 + 15 - longRate * 60 - Math.min(20, vague * 2)));
  checks.chunk = { score, paragraphs: totalParas, listItems: totalItems, inBand: band, bandRate: +(bandRate * 100).toFixed(1), tooLong: long, vagueSubjects: vague };
  if (totalParas < 5) notes.push({ pri: 1, msg: "산문 문단이 거의 없습니다. AI가 떼어갈 문장 자체가 없다는 뜻입니다" });
  if (bandRate < 0.35 && totalParas > 10)
    notes.push({ pri: 2, msg: `문단의 ${(bandRate * 100).toFixed(0)}%만 인용하기 좋은 길이입니다. 한 문단 = 한 주제, 40~80단어로 쪼개세요` });
  if (vague > 5)
    notes.push({ pri: 2, msg: `"우리는·저희는" 같은 대명사 주어가 ${vague}회 나옵니다. AI가 문장만 떼어가면 주어가 사라집니다 — 브랜드명을 문장 안에 넣으세요` });
}

// 4d) AI 친화 패턴
{
  const qh = okPages.reduce((s, p) => s + p.qHeadings, 0);
  const nums = okPages.reduce((s, p) => s + p.hasNumbers, 0);
  const tables = okPages.filter((p) => p.hasTable).length;
  const lists = okPages.filter((p) => p.hasList).length;
  const meta = okPages.filter((p) => p.title && p.desc).length;
  const score = Math.min(100, Math.round(
    Math.min(30, qh * 6) + Math.min(30, nums * 1.5) +
    (tables ? 15 : 0) + (lists / Math.max(1, okPages.length)) * 10 +
    (meta / Math.max(1, okPages.length)) * 15
  ));
  checks.patterns = { score, questionHeadings: qh, numericFacts: nums, pagesWithTable: tables, pagesWithList: lists, pagesWithMeta: meta };
  if (qh === 0) notes.push({ pri: 2, msg: "질문형 제목이 하나도 없습니다. 사람이 AI에게 묻는 문장을 그대로 제목으로 쓰세요" });
  if (nums < 5) notes.push({ pri: 3, msg: "수치가 거의 없습니다. AI는 숫자·조건이 붙은 문장을 인용합니다" });
}

/* ───────────────────────── 점수 합산 ───────────────────────── */

const WEIGHTS = [
  ["crawler",  25, "AI 크롤러 접근"],
  ["ssr",      20, "본문 추출 가능성"],
  ["schema",   20, "구조화 데이터"],
  ["chunk",    15, "인용 가능한 문단"],
  ["patterns", 10, "AI 친화 패턴"],
  ["llmstxt",   7, "llms.txt"],
  ["sitemap",   3, "sitemap.xml"],
];
const total = Math.round(WEIGHTS.reduce((s, [k, w]) => s + (checks[k]?.score ?? 0) * w, 0) / 100);
const grade = total >= 80 ? "우수" : total >= 60 ? "보통" : total >= 40 ? "미흡" : "위험";

if (args.json) {
  console.log(JSON.stringify({ origin, scanned_at: new Date().toISOString(), total, grade, platform, checks, pages, notes }, null, 2));
  process.exit(0);
}

const bar = (v) => "█".repeat(Math.round(v / 5)).padEnd(20, "·");
const L = [];
const say = (s = "") => { L.push(s); console.log(s); };

say(`${"═".repeat(62)}`);
say(`  GEO 진단  ${origin}`);
say(`  종합 ${total}/100  ·  ${grade}`);
say(`${"═".repeat(62)}\n`);

for (const [k, w, label] of WEIGHTS) {
  const c = checks[k];
  say(`  ${label.padEnd(18)} ${String(c?.score ?? 0).padStart(3)}  ${bar(c?.score ?? 0)}  가중 ${w}%`);
}

if (platform) {
  say(`
── 운영 형태 ${"─".repeat(46)}`);
  say(`  ${platform.kind} · ${platform.name}   (${platform.evidence})`);
  say(`  루트파일 ${CAP_LABEL[platform.rootFile]} · 스키마 ${CAP_LABEL[platform.schema]} · 발행 ${PUBLISH_LABEL[platform.publish]} · 작업주체 ${platform.owner}`);
}

say(`\n── AI 크롤러 ${"─".repeat(46)}`);
if (checks.crawler.bots?.length) {
  for (const b of checks.crawler.bots) {
    const mark = b.allowed ? (b.explicit ? "✓ 명시허용" : "· 기본허용") : "✗ 차단";
    say(`  ${b.label.padEnd(18)} ${b.id.padEnd(18)} ${mark}`);
  }
} else say(`  ${checks.crawler.detail}`);

say(`\n── 본문 추출 ${"─".repeat(46)}`);
say(`  검사 페이지 ${checks.ssr.totalPages}개 · 평균 본문 ${checks.ssr.avgTextLen}자 · 본문/HTML 비율 ${(checks.ssr.textRatio * 100).toFixed(1)}%`);
say(`  JS 없이 본문이 빈약한 페이지 ${checks.ssr.thinPages}개`);

say(`\n── 구조화 데이터 ${"─".repeat(42)}`);
say(`  JSON-LD 있는 페이지 ${checks.schema.pagesWithLd}/${checks.schema.totalPages}`);
say(`  발견 타입: ${checks.schema.types.length ? checks.schema.types.join(", ") : "없음"}`);

say(`\n── 문단 구조 ${"─".repeat(46)}`);
say(`  산문 문단 ${checks.chunk.paragraphs}개 중 인용하기 좋은 길이(80~400자) ${checks.chunk.inBand}개 (${checks.chunk.bandRate}%)`);
say(`  리스트 항목 ${checks.chunk.listItems}개`);
say(`  너무 긴 문단 ${checks.chunk.tooLong}개 · 대명사 주어 ${checks.chunk.vagueSubjects}회`);

say(`\n── 콘텐츠 패턴 ${"─".repeat(44)}`);
say(`  질문형 제목 ${checks.patterns.questionHeadings}개 · 수치 표현 ${checks.patterns.numericFacts}개 · 표 있는 페이지 ${checks.patterns.pagesWithTable}개`);

say(`\n${"━".repeat(62)}`);
say(`  먼저 고칠 것`);
say(`${"━".repeat(62)}`);
const ranked = notes.sort((a, b) => a.pri - b.pri).slice(0, 5);
if (!ranked.length) say(`  즉시 고칠 항목이 없습니다.`);
ranked.forEach((n, i) => {
  const tag = n.pri === 1 ? "치명" : n.pri === 2 ? "중요" : "권장";
  say(`  ${i + 1}. [${tag}] ${n.msg}`);
});
say("");
say(`  검사 항목은 전부 코드로 확인 가능한 사실입니다.`);
say(`  브랜드 권위·E-E-A-T 같은 판단 항목은 점수에 넣지 않았습니다.`);
say("");

const outDir = path.resolve(ROOT, "data/scans");
fs.mkdirSync(outDir, { recursive: true });
const slug = origin.replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]/gi, "_");
fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify({ origin, scanned_at: new Date().toISOString(), total, grade, platform, checks, pages, notes }, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, `${slug}.txt`), L.join("\n"), "utf8");
console.log(`저장: data/scans/${slug}.json\n`);
