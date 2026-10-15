// Step 48 검증 (Step 47 74개 + #film) — next build && next start 위에서 돈다.
//   node verify.mjs [base=http://localhost:3047] [out=handoff/research/step48] [mode=full|nullops]
// full: 47a(주소·canonical·JSON-LD·llms.txt·308) + 47b(문구·순서) 단정, 스크린샷 1440/390
// nullops: DATABASE_URL 을 못 쓰게 빌드한 서버에서 증거 칸이 숨는지만 본다
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
const require = createRequire("C:/dev/AGO&GEO/tools/package.json");
const { chromium } = require("playwright");
const ts = createRequire("C:/dev/AGO&GEO/web/package.json")("typescript");

const BASE = process.argv[2] || "http://localhost:3047";
const OUT = process.argv[3] || "C:/dev/AGO&GEO/handoff/research/step48";
const MODE = process.argv[4] || "full";
const log = [];
let fails = 0;
const ok = (cond, msg) => { log.push((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };

/** TS 파일 하나를 그대로 불러온다(import 없는 파일만) */
async function loadTs(path) {
  const src = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

/** Host 헤더를 바꿔 보낸다. 리다이렉트는 따라가지 않는다 */
function req(path, { host, method = "GET", body } = {}) {
  const u = new URL(path, BASE);
  return new Promise((res, rej) => {
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: { ...(host ? { Host: host } : {}), ...(body ? { "content-type": "application/json" } : {}) } }, (x) => {
      let d = ""; x.setEncoding("utf8"); x.on("data", (c) => (d += c)); x.on("end", () => res({ status: x.statusCode, location: x.headers.location, type: x.headers["content-type"], body: d }));
    });
    r.on("error", rej);
    if (body) r.write(body);
    r.end();
  });
}

/** 바이너리(영상·포스터) — 본문은 버리고 상태·헤더·받은 바이트 수만 */
function bin(path, headers = {}) {
  const u = new URL(path, BASE);
  return new Promise((res, rej) => {
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, headers }, (x) => {
      let n = 0; x.on("data", (c) => (n += c.length)); x.on("end", () => res({ status: x.statusCode, h: x.headers, n }));
    });
    r.on("error", rej);
    r.end();
  });
}

const sameUrl =(a, b) => { try { return new URL(a).href === new URL(b).href; } catch { return false; } };

const b = await chromium.launch();

if (MODE === "nullops") {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  const cells = await p.$$eval(".lp-proof .lp-pb .lp-pb-k", (els) => els.map((e) => e.textContent.trim()));
  ok(cells.length === 1 && cells[0] === "착수일부터 센 날", `[nullops] 히어로 증거 칸이 「일차」 하나만 남음 (${JSON.stringify(cells)})`);
  const txt = await p.$eval(".lp", (e) => e.textContent);
  ok(!/\b0 → 0\b/.test(txt) && !/NaN|null|undefined/.test(txt), "[nullops] 지어낸 0·null 문자열 없음");
  await p.screenshot({ path: `${OUT}/nullops-1440-hero.png` });
  await b.close();
  fs.writeFileSync(`${OUT}/assertions-nullops.txt`, log.join("\n") + `\n\n${fails ? fails + " FAIL" : "ALL PASS"}\n`);
  console.log(log.join("\n")); console.log(fails ? `${fails} FAIL` : "ALL PASS");
  process.exit(fails ? 1 : 0);
}

// ── clean() ──
const site = await loadTs("C:/dev/AGO&GEO/web/lib/site.ts");
ok(site.cleanSiteUrl("\uFEFFhttps://cited.kr/\r\n") === "https://cited.kr", "clean(): BOM + 끝 / + 줄바꿈 → https://cited.kr");
ok(site.cleanSiteUrl("nope") === "https://cited.kr", "clean(): 「nope」 → 기본값");
ok(site.cleanSiteUrl("") === "https://cited.kr" && site.cleanSiteUrl(undefined) === "https://cited.kr", "clean(): 빈 값 → 기본값");
ok(site.cleanSiteUrl("ftp://cited.kr") === "https://cited.kr", "clean(): https·http 아닌 것 → 기본값");
ok(site.cleanSiteUrl("https://cited.kr") === "https://cited.kr", "clean(): 정상 값은 그대로");

// ── PILOT 대조 ──
const { PILOT } = await loadTs("C:/dev/AGO&GEO/web/lib/services.ts");
ok(PILOT.price === "390,000원" && Number(PILOT.price.replace(/\D/g, "")) / 10000 === 39, `PILOT.price ${PILOT.price} = 화면 「39만원」`);
ok(/50%/.test(PILOT.refund[1]) && /기준선 보고 전/.test(PILOT.refund[1]), `PILOT.refund[1] 에 기준선 보고 전 50% (${PILOT.refund[1]})`);
ok(/착수 전/.test(PILOT.refund[0]) && /모두/.test(PILOT.refund[0]), `PILOT.refund[0] 착수 전 전액 (${PILOT.refund[0]})`);

// ── 308 ──
const OLD = "geo-rose-nine.vercel.app";
for (const [path, want] of [["/", "https://cited.kr/"], ["/case/academy.html", "https://cited.kr/case/academy.html"], ["/admin/ops?key=x", "https://cited.kr/admin/ops?key=x"], ["/apifoo", "https://cited.kr/apifoo"], ["/geo/geo-cost", "https://cited.kr/geo/geo-cost"]]) {
  const r = await req(path, { host: OLD });
  ok(r.status === 308 && r.location === want, `옛 호스트 ${path} → ${r.status} ${r.location}`);
}
for (const [path, method] of [["/api", "GET"], ["/api/lead", "POST"], ["/api/llm", "GET"], ["/api/scan?url=x", "GET"]]) {
  const r = await req(path, { host: OLD, method, body: method === "POST" ? "{}" : undefined });
  ok(r.status !== 308 && !r.location, `옛 호스트 ${method} ${path} → ${r.status} (308 아님)`);
}
{
  const r = await req("/");
  ok(r.status === 200 && !r.location, `localhost / → ${r.status} (리다이렉트 없음)`);
}

// ── sitemap · robots · llms.txt ──
const sm = await req("/sitemap.xml");
const rb = await req("/robots.txt");
const ll = await req("/llms.txt");
for (const [n, r] of [["sitemap.xml", sm], ["robots.txt", rb], ["llms.txt", ll]]) {
  ok(r.status === 200 && r.body.includes("https://cited.kr") && !r.body.includes("geo-rose-nine"), `${n}: cited.kr 있음 · geo-rose-nine 0`);
}
ok(/^text\/plain; charset=utf-8/i.test(ll.type || ""), `llms.txt content-type ${ll.type}`);
ok(ll.body.startsWith("# 사이티드(Cited)\n\n" + site.CITED_ABOUT.join(" ")), "llms.txt 머리 = 사이티드(Cited) + 정의문");
ok(ll.body.includes(PILOT.price) && PILOT.refund.every((x) => ll.body.includes(x)) && ll.body.includes(PILOT.after), "llms.txt 가격·환불·월 구독이 PILOT 과 같음");
ok(ll.body.includes("https://cited.kr/#start") && ll.body.includes("https://cited.kr/case/academy.html") && !ll.body.includes("도입 사례"), "llms.txt 연락·전체 기록 주소 · 「도입 사례」 0");
ok(!fs.existsSync("C:/dev/AGO&GEO/web/public/llms.txt"), "public/llms.txt 삭제됨");
{
  const before = fs.readFileSync(`${OUT}/robots-before.txt`, "utf8").replace(/\r/g, "").trim().split("\n");
  const now = rb.body.replace(/\r/g, "").trim().split("\n");
  const diff = [];
  for (let i = 0; i < Math.max(before.length, now.length); i++) if (before[i] !== now[i]) diff.push(`${before[i]} ⇒ ${now[i]}`);
  ok(before.length === now.length && diff.length === 1 && /^Sitemap:/.test(before[before.length - 1]) && diff[0].startsWith("Sitemap:"), `robots.txt 전·후 차이는 Sitemap 줄 하나 (${diff.join(" | ")})`);
}

// ── 하위 페이지 canonical ──
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const svc1 = locs.find((u) => /\/services\/[^/]+$/.test(u));
const geo1 = locs.find((u) => /\/geo\/[^/]+$/.test(u));
for (const full of ["https://cited.kr/services", svc1, "https://cited.kr/geo", geo1]) {
  const path = new URL(full).pathname;
  const html = (await req(path)).body;
  const c = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  ok(c === `https://cited.kr${path}`, `${path} canonical = ${c}`);
}

// ── 랜딩 (브라우저) ──
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
p.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 200)}`); });
await p.goto(BASE + "/", { waitUntil: "networkidle" });

const head = await p.evaluate(() => ({
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
  ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
  ogSite: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
  ogLocale: document.querySelector('meta[property="og:locale"]')?.getAttribute("content"),
  title: document.title,
  desc: document.querySelector('meta[name="description"]')?.getAttribute("content"),
  robots: [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content).join(" | "),
  ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
}));
ok(sameUrl(head.canonical, "https://cited.kr/"), `/ canonical = ${head.canonical} (env 없이 빌드 · Next 가 루트의 끝 / 를 뗀다, URL 로는 같음)`);
ok(sameUrl(head.ogUrl, "https://cited.kr/"), `og:url = ${head.ogUrl}`);
ok(head.title === site.SITE_TITLE && head.ogTitle === site.SITE_TITLE, `title·og:title = 3-1 (${head.title})`);
ok(head.desc === site.SITE_DESCRIPTION, "description = 3-1");
ok(head.ogSite === "사이티드(Cited)" && head.ogLocale === "ko_KR", `og:site_name ${head.ogSite} · og:locale ${head.ogLocale}`);
ok(!/noindex/.test(head.robots), `ALLOW_INDEX=true 빌드에 noindex 없음 (robots meta: ${head.robots || "없음"})`);

let parsed = [];
try { parsed = head.ld.map((t) => JSON.parse(t)); ok(parsed.length > 0, `JSON-LD ${parsed.length}개 전부 JSON.parse`); }
catch (e) { ok(false, "JSON-LD 파싱 실패 " + e.message); }
const graph = parsed.flatMap((x) => x["@graph"] ?? [x]);
const org = graph.find((x) => x["@type"] === "Organization");
const svc = graph.find((x) => x["@type"] === "Service");
const faqLd = graph.find((x) => x["@type"] === "FAQPage");
ok(org?.url === "https://cited.kr" && org?.name === "사이티드(Cited)" && !("sameAs" in org), `Organization url ${org?.url} · name ${org?.name} · sameAs 없음`);
ok(JSON.stringify(org?.alternateName) === JSON.stringify(["사이티드", "Cited"]) && org?.description === site.CITED_ABOUT[0], "Organization alternateName · description = FAQ 1 첫 문장");
ok(svc?.name === "AI 답변 노출 대행(GEO)" && svc?.offers?.price === "390000" && svc?.offers?.priceCurrency === "KRW" && svc?.offers?.url === "https://cited.kr/#price" && svc?.offers?.name === PILOT.name, `Service·Offer ${JSON.stringify(svc?.offers)}`);

const faqScreen = await p.$$eval(".lp-faq-i", (els) => els.map((e) => [e.querySelector("button span").textContent, e.querySelector(".lp-faq-a p").textContent]));
const faqData = (faqLd?.mainEntity ?? []).map((q) => [q.name, q.acceptedAnswer.text]);
ok(faqScreen.length === 10 && faqData.length === 10, `FAQ 화면 ${faqScreen.length} · JSON-LD ${faqData.length}`);
ok(JSON.stringify(faqScreen) === JSON.stringify(faqData), "FAQ 화면 질문·답 = JSON-LD 글자 그대로");
ok(faqScreen[0]?.[0] === "사이티드(Cited)는 무슨 회사인가요?" && faqScreen[0]?.[1] === site.CITED_ABOUT.join(" "), "FAQ 1 = 사이티드(Cited) 정의문");
ok(faqScreen[2]?.[1]?.endsWith(PILOT.after), "FAQ 3 끝 = PILOT.after");

// ── Step 48 · #film (D135–D138) ──
{
  const F = await p.evaluate(() => {
    const s = document.querySelector("#film");
    const v = s?.querySelector("video");
    return s && v ? {
      bg: s.className, lab: s.querySelector(".lp-lab")?.textContent, h2: s.querySelector("h2")?.textContent, sub: s.querySelector(".lp-sub")?.textContent,
      preload: v.getAttribute("preload"), autoplay: v.hasAttribute("autoplay") || v.autoplay, controls: v.hasAttribute("controls"), inline: v.hasAttribute("playsinline"),
      poster: v.getAttribute("poster"), w: v.getAttribute("width"), h: v.getAttribute("height"),
      src: [...v.querySelectorAll("source")].map((x) => [x.getAttribute("src"), x.getAttribute("type")]),
      fallback: v.querySelector("a")?.getAttribute("href"), fallbackText: v.textContent.trim(),
      ar: getComputedStyle(v).aspectRatio, cssW: v.getBoundingClientRect().width, cssH: v.getBoundingClientRect().height,
      net: v.networkState, buffered: v.buffered.length,
      summary: s.querySelector("details summary")?.textContent, open: s.querySelector("details")?.open,
      lines: [...s.querySelectorAll("details li")].map((li) => li.textContent),
      custom: s.querySelectorAll("button").length,
      prev: s.previousElementSibling?.className, next: s.nextElementSibling?.id,
    } : null;
  });
  ok(!!F, "#film 있음");
  ok(F?.bg.includes("lp-ground") && /lp-hero/.test(F?.prev ?? "") && F?.next === "geo", `#film 배경 lp-ground · 히어로 바로 뒤 · 다음 절 #geo (${F?.prev} › ${F?.bg} › ${F?.next})`);
  ok(F?.lab === "45초로 보기" && F?.h2 === "사이티드가 하는 일을 45초로" && F?.sub === "소리가 있습니다. 영상 속 숫자와 가격은 아래 본문과 같은 근거에서 가져왔습니다.", `#film 라벨·제목·부제 (${F?.lab} | ${F?.h2} | ${F?.sub})`);
  ok(F?.preload === "none" && F?.autoplay === false, `video preload=${F?.preload} · autoplay ${F?.autoplay}`);
  ok(F?.controls && F?.inline && F?.custom === 0, "기본 컨트롤 · playsinline · 커스텀 재생 버튼 0");
  ok(F?.net !== 2 && F?.buffered === 0, `로드 뒤 영상을 받지 않음 (networkState ${F?.net}, buffered ${F?.buffered})`);
  ok(F?.w === "1920" && F?.h === "1080" && /16\s*\/\s*9/.test(F?.ar ?? "") && Math.abs(F.cssW / F.cssH - 16 / 9) < 0.01, `width/height 1920×1080 · aspect-ratio ${F?.ar} · 화면 ${F?.cssW}×${F?.cssH}`);
  ok(JSON.stringify(F?.src) === JSON.stringify([["/media/cited-promo.mp4", "video/mp4"]]) && F?.poster === "/media/cited-promo-poster.jpg", `source ${JSON.stringify(F?.src)} · poster ${F?.poster}`);
  ok(F?.fallback === "/media/cited-promo.mp4" && F?.fallbackText.includes("영상을 재생할 수 없으면") && F?.fallbackText.includes("파일로 보기"), "video 안 대체 링크 「파일로 보기」");
  ok(F?.summary === "영상 속 문장 그대로 보기" && F?.open === false, "details 접힘 · summary 「영상 속 문장 그대로 보기」");
  ok(F?.lines.length === 7, `details 문구 ${F?.lines.length}줄`);
  // 문구는 원본 HTML 에서 옮긴 것 — 원본의 숫자·핵심 구절이 그대로 들어 있는지 대조
  const src = fs.readFileSync("C:/dev/AGO&GEO/academy/public/youtube/motion/cited-promo.html", "utf8");
  const joined = F?.lines.join(" ") ?? "";
  const phrases = ["두세 개만 부릅니다.", "답변 문장 안의 이름.", "소프트웨어 회사 34곳 · 회사당 15회", "비교 글 14개 중 0개에 이름", "비교 글 14개 중 9개에 이름", "전부 미노출.", "「무선 인터넷과 남녀 구분 화장실을 제공합니다」", "질문 20개를", "봇 접근 · 색인 등록 · 구조화 데이터", "39만원", "노출·순위·문의는 보장하지 않습니다.", "AI 답변에 이름이 불리게."];
  const miss = phrases.filter((x) => !src.includes(x) || !joined.includes(x));
  ok(miss.length === 0, `details 문구 = 원본 HTML 구절 ${phrases.length}개 대조${miss.length ? " — 빠짐: " + miss.join(", ") : ""}`);
  const nums = (t) => (t.match(/\d+/g) ?? []).sort().join(",");
  const srcNums = new Set(src.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, " ").match(/\d+/g));
  const extra = (joined.match(/\d+/g) ?? []).filter((n) => !srcNums.has(n));
  ok(extra.length === 0, `details 숫자가 전부 원본 화면 글자에 있음 (${nums(joined)})${extra.length ? " — 없는 숫자: " + extra.join(",") : ""}`);

  const vids = graph.filter((x) => x["@type"] === "VideoObject");
  const v = vids[0];
  ok(vids.length === 1, `JSON-LD VideoObject ${vids.length}개`);
  ok(v?.contentUrl?.startsWith(site.SITE_URL + "/") && v?.thumbnailUrl?.startsWith(site.SITE_URL + "/") && v.contentUrl.endsWith("/media/cited-promo.mp4") && v.thumbnailUrl.endsWith("/media/cited-promo-poster.jpg"), `VideoObject contentUrl ${v?.contentUrl} · thumbnailUrl ${v?.thumbnailUrl} (SITE_URL ${site.SITE_URL})`);
  ok(v?.name === F?.h2 && v?.uploadDate === "2026-10-15" && v?.duration === "PT45S" && v?.inLanguage === "ko" && !!v?.description, `VideoObject name·uploadDate·duration·inLanguage (${v?.name} · ${v?.uploadDate} · ${v?.duration} · ${v?.inLanguage})`);
  ok(v?.publisher?.["@id"] === org?.["@id"] && Object.keys(v.publisher).length === 1, `VideoObject publisher → ${v?.publisher?.["@id"]} (Organization 참조)`);

  const po = await bin("/media/cited-promo-poster.jpg");
  ok(po.status === 200 && /image\/jpeg/.test(po.h["content-type"] ?? "") && po.n > 0, `poster ${po.status} ${po.h["content-type"]} ${po.n}B`);
  const mp = await bin("/media/cited-promo.mp4");
  const size = fs.statSync("C:/dev/AGO&GEO/web/public/media/cited-promo.mp4").size;
  ok(mp.status === 200 && mp.h["content-type"] === "video/mp4" && mp.n === size, `mp4 ${mp.status} ${mp.h["content-type"]} ${mp.n}B (파일 ${size}B)`);
  const rg = await bin("/media/cited-promo.mp4", { Range: "bytes=0-1023" });
  ok(rg.status === 206 && rg.n === 1024 && rg.h["content-range"] === `bytes 0-1023/${size}`, `Range bytes=0-1023 → ${rg.status} ${rg.h["content-range"]} ${rg.n}B`);
}

const T = await p.evaluate(() => ({
  lede: document.querySelector(".lp-lede")?.textContent ?? "",
  define: document.querySelector("#geo .lp-define")?.textContent ?? "",
  foot: document.querySelector(".lp-foot .desc")?.textContent ?? "",
  bottom: document.querySelector(".lp-foot .bottom")?.textContent ?? "",
  price: document.querySelector("#price .lp-sub")?.textContent ?? "",
  all: document.querySelector(".lp")?.textContent ?? "",
  nav: [...document.querySelectorAll("nav .links a")].map((a) => a.textContent),
  ids: [...document.querySelectorAll(".lp > section[id]")].map((s) => s.id),
  hint: document.querySelector(".lp-hero .lp-herohint")?.textContent ?? "",
  links: [...document.querySelectorAll(".lp-herolinks a")].map((a) => [a.textContent, a.getAttribute("href")]),
  proofH: document.querySelector(".lp-proof-h")?.textContent ?? "",
  cells: [...document.querySelectorAll(".lp-proof .lp-pb-k")].map((e) => e.textContent),
}));
for (const [n, v] of [["hero lede", T.lede], ["#geo define", T.define], ["footer desc", T.foot], ["footer ©", T.bottom], ["title", head.title]]) ok(v.includes("사이티드(Cited)"), `「사이티드(Cited)」 in ${n}`);
ok(T.price.includes("39만원") && T.price.includes("절반") && T.price.includes("전액"), "#price sub 「39만원」·「전액」·「절반」 = PILOT price·refund[0]·refund[1]");
for (const bad of ["geo-rose-nine", "도입 사례", "크롤러 누적 방문", "채점 기준 바뀜"]) {
  const at = await p.evaluate((bad) => [...document.querySelectorAll(".lp *")].filter((e) => e.children.length === 0 && e.textContent.includes(bad)).map((e) => e.className || e.tagName), bad);
  ok(!T.all.includes(bad), `화면에 「${bad}」 0${at.length ? " — 남은 곳: " + at.join(", ") : ""}`);
}
const ORDER = ["film", "geo", "data", "case", "who", "services", "how", "why", "price", "diff", "nots", "faq", "guides", "start"];
ok(JSON.stringify(T.ids) === JSON.stringify(ORDER), `절 순서 ${T.ids.join(" › ")}`);
ok(!T.ids.includes("proof") && !(await p.$("#proof")), "#proof 없음");
ok(T.nav.includes("하는 일") && T.nav.includes("첫 적용 기록") && !T.nav.includes("GEO란") && !T.nav.includes("도입 사례"), `네비 ${T.nav.join(" · ")}`);
ok(T.hint.includes("「○○구 치과 추천해줘」"), "히어로 폼 아래 자가 확인 한 줄");
ok(JSON.stringify(T.links) === JSON.stringify([["30일 파일럿 39만원 보기 →", "#price"], ["대표 학원에 먼저 해 본 기록 →", "#case"]]), "히어로 링크 두 개");
ok(T.proofH.includes("첫 적용 · 사이티드 대표가 운영하는 학원"), "증거 줄 머리");
ok(!T.cells.includes("크롤러 누적 방문") && T.cells[0] === "착수일부터 센 날", `증거 칸 ${T.cells.join(" / ")}`);

// D133 — 히어로 경쟁 검색어 칸은 DB 의 그날 마지막 줄 엔진 하나·측정일을 단다. 같은 줄을 DB 에서 직접 읽어 대조
{
  const { Pool } = createRequire("C:/dev/AGO&GEO/web/package.json")("pg");
  const env = fs.readFileSync("C:/dev/AGO&GEO/web/.env.local", "utf8");
  const pool = new Pool({ connectionString: env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, ""), ssl: { rejectUnauthorized: false } });
  const [c] = (await pool.query(`select id, schema_name from geo.clients where status <> 'ended' order by started_on, id limit 1`)).rows;
  const S = c.schema_name;
  const [{ d }] = (await pool.query(`select max(day)::text d from ${S}.serp_checks where client_id = ${c.id}`)).rows;
  const [last] = (await pool.query(`select engine from ${S}.serp_checks where client_id = ${c.id} and day = $1 and kind = '경쟁' order by checked_at desc limit 1`, [d])).rows;
  const per = (await pool.query(`select query, bool_or(hit) won from ${S}.serp_checks where client_id = ${c.id} and day = $1 and kind = '경쟁' and engine = $2 group by query`, [d, last.engine])).rows;
  await pool.end();
  const NAME = { bing: "빙", naver: "네이버 웹문서", naver_all: "네이버 통합" };
  const wantLabel = `학원 이름 없이 친 검색어에 노출 · ${NAME[last.engine] ?? last.engine} · ${Number(d.slice(5, 7))}/${d.slice(8, 10)} 측정`;
  const won = per.filter((r) => r.won).length;
  const tile = await p.evaluate(() => {
    const e = [...document.querySelectorAll(".lp-proof .lp-pb")].find((x) => x.textContent.includes("학원 이름 없이"));
    return e ? { k: e.querySelector(".lp-pb-k").textContent, total: e.querySelector(".lp-pb-v > span").textContent } : null;
  });
  ok(tile?.k === wantLabel, `히어로 칸 라벨 = DB 마지막 줄 엔진·측정일 (${tile?.k} | 기대 ${wantLabel})`);
  ok(tile?.total === `/ ${per.length}`, `히어로 칸 분모 = 그 엔진 하나의 경쟁 검색어 수 (${tile?.total} | 기대 / ${per.length}, 이긴 것 ${won})`);
  globalThis.__wantWon = won;
}

// keep-all
const wb = await p.evaluate(() => {
  const sels = [".lp-lede", ".lp-herohint", ".lp-proof-h", "#geo .lp-define", "#geo .lp-note", "#data .lp-sub", "#data .lp-split-foot", "#case .lp-sub", "#case h2", "#who .lp-sub", "#services .lp-sub", "#how .lp-sub", "#why .lp-sub", "#price .lp-sub", ".lp-pcompare", "#nots .lp-sub", ".lp-faq-a p", "#start .lp-sub", "#film .lp-sub", ".lp-film-text li", ".lp-foot .desc", ".lp-foot .wm"];
  return sels.map((s) => [s, document.querySelector(s) ? getComputedStyle(document.querySelector(s)).wordBreak : "missing"]);
});
const notKeep = wb.filter(([, v]) => v !== "keep-all");
ok(notKeep.length === 0, `바뀐 한국어 블록 word-break: keep-all (${notKeep.map(([s, v]) => s + "=" + v).join(", ") || wb.length + "곳 전부"})`);

// 시연 회귀
{
  const q0 = await p.textContent(".lp-q");
  const inds = await p.$$(".lp-ind");
  await inds[1].click();
  await p.waitForTimeout(200);
  const q1 = await p.textContent(".lp-q");
  ok(inds.length > 1 && q0 !== q1, `업종 버튼: 질문 바뀜 (${q0} → ${q1})`);
  const engs = await p.$$(".lp-eng");
  await engs[1].click();
  await p.waitForTimeout(200);
  ok((await engs[1].getAttribute("aria-selected")) === "true", "엔진 탭: 두 번째 선택됨");
  await p.click(".lp-ask");
  await p.waitForTimeout(200);
  ok((await p.textContent(".lp-round")).includes("2"), `「같은 질문 다시 묻기」: ${await p.textContent(".lp-round")}`);
}
// ScanForm — 일부러 틀린 주소를 넣어 /api/scan 이 400 을 돌려준다. 그 콘솔 오류는 의도한 것이라 여기서 끊는다.
const errsBeforeScan = errs.length;
{
  await p.fill("#dom-hero", "nope");
  await p.click("#dom-hero ~ button");
  const m = await p.waitForSelector(".lp-hero .err, .lp-hero .result", { timeout: 20000 }).then((e) => e.textContent()).catch(() => null);
  ok(!!m, `ScanForm(dom-hero) 제출 → ${m}`);
}
await ctx.close();

// ── 스크린샷 1440·390 ──
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const pg = await c.newPage();
  await pg.goto(BASE + "/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${OUT}/${w}-hero.png` });
  // 숫자(Count)는 화면에 들어올 때 0 에서 올라간다. 한 번 끝까지 훑어 전부 켠 뒤 찍는다.
  for (let y = 0; y < (await pg.evaluate(() => document.body.scrollHeight)); y += Math.floor(h / 2)) {
    await pg.evaluate((y) => window.scrollTo(0, y), y);
    await pg.waitForTimeout(150);
  }
  await pg.waitForTimeout(1200);
  await (await pg.$(".lp-proof")).screenshot({ path: `${OUT}/${w}-hero-proof.png` });
  if (w === 1440) {
    const cell = await pg.evaluate(() => [...document.querySelectorAll(".lp-proof .lp-pb")].find((e) => e.textContent.includes("학원 이름 없이"))?.querySelector(".lp-pb-v b")?.textContent ?? null);
    ok(cell === `0 → ${globalThis.__wantWon}`, `히어로 칸 숫자(애니메이션 뒤) = 그 엔진 하나만의 이긴 수 (${cell})`);
    // D132 — 붙은 절끼리 배경이 같지 않다(히어로·푸터 포함)
    const bgs = await pg.evaluate(() => [document.querySelector(".lp-hero"), ...document.querySelectorAll(".lp > section[id]"), document.querySelector(".lp-foot")]
      .map((e) => [e.id || e.className.split(" ")[0], getComputedStyle(e).backgroundColor]));
    const same = bgs.slice(1).filter((x, i) => x[1] === bgs[i][1]).map((x) => x[0]);
    ok(same.length === 0, `붙은 절 배경 모두 다름${same.length ? " — 겹침: " + same.join(",") : ""} (${bgs.map((x) => x[0] + "=" + x[1].replace(/\s/g, "")).join(" › ")})`);
  }
  // 붙박이 네비가 절 위를 덮어 찍히지 않게 절 사진에서만 숨긴다
  await pg.addStyleTag({ content: "nav.lp-nav{visibility:hidden!important}" });
  for (const id of ["film", "geo", "data", "case", "price", "faq", "start"]) {
    const el = await pg.$("#" + id);
    await el.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(300);
    await el.screenshot({ path: `${OUT}/${w}-${id}.png` });
  }
  const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw[0] <= sw[1], `[${w}] 가로 넘침 없음 (scrollWidth ${sw[0]} ≤ ${sw[1]})`);
  await c.close();
}

await b.close();
const unexpected = [...errs.slice(0, errsBeforeScan), ...errs.slice(errsBeforeScan).filter((e) => !/status of 400/.test(e))];
ok(unexpected.length === 0, `콘솔 오류 0 (ScanForm 일부러 낸 400 제외) ${unexpected.join(" | ")}`);
fs.writeFileSync(`${OUT}/assertions.txt`, log.join("\n") + `\n\n${fails ? fails + " FAIL" : "ALL PASS"}\n`);
console.log(log.join("\n"));
console.log(fails ? `${fails} FAIL` : "ALL PASS");
process.exit(fails ? 1 : 0);
