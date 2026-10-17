// Step 50 검증 (Step 49 104개 + 홈페이지 없는 진단 새 단정) — next build && next start 위에서 돈다.
//   node verify.mjs [base=http://localhost:3047] [out=handoff/research/step50] [mode=full|nullops]
// full: 47a(주소·canonical·JSON-LD·llms.txt·308) + 47b(문구·순서) + #film + Step 49(쉬운 말·메타 문구) 단정, 스크린샷 1440/390
// nullops: DATABASE_URL 을 못 쓰게 빌드한 서버에서 살아 있는 숫자 문장이 숨는지만 본다
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
const require = createRequire("C:/dev/AGO&GEO/tools/package.json");
const { chromium } = require("playwright");
const ts = createRequire("C:/dev/AGO&GEO/web/package.json")("typescript");

const BASE = process.argv[2] || "http://localhost:3047";
const OUT = process.argv[3] || "C:/dev/AGO&GEO/handoff/research/step50";
const MODE = process.argv[4] || "full";
const PROD = "https://cited.kr/";
const log = [];
let fails = 0;
const ok = (cond, msg) => { log.push((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };

/** 착수일 — page.tsx START 와 같은 값. 「N일차」를 여기서도 센다 */
const START = Date.parse("2026-09-05T00:00:00+09:00");
const caseDay = Math.max(1, Math.floor((Date.now() - START) / 86400000) + 1);

/** TS 파일 하나를 그대로 불러온다(import 없는 파일만) */
async function loadTs(path) {
  const src = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

/** 요청마다 다른 IP 로 보낸다 — /api/scan 5/분 · /api/lead 8/분 리밋에 검증이 걸리지 않게 */
let ipSeq = 0;
const nextIp = () => `10.50.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

/** Host 헤더를 바꿔 보낸다. 리다이렉트는 따라가지 않는다 */
function req(path, { host, method = "GET", body } = {}) {
  const u = new URL(path, BASE);
  return new Promise((res, rej) => {
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: { "x-forwarded-for": nextIp(), ...(host ? { Host: host } : {}), ...(body ? { "content-type": "application/json" } : {}) } }, (x) => {
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

/** 화면 글자 — 렌더된 것만(innerText: 접힌 details·닫힌 FAQ·숨은 탭 제외). skip 에 든 id 절은 뺀다 */
const screenText = (pg, skip = []) => pg.evaluate((skip) =>
  [...document.querySelector(".lp").children].filter((e) => !skip.includes(e.id)).map((e) => e.innerText).join("\n"), skip);

/** 한 번 끝까지 훑어 Count 애니메이션을 전부 끝낸다 */
async function scrollAll(pg, h) {
  for (let y = 0; y < (await pg.evaluate(() => document.body.scrollHeight)); y += Math.floor(h / 2)) {
    await pg.evaluate((y) => window.scrollTo(0, y), y);
    await pg.waitForTimeout(150);
  }
  await pg.waitForTimeout(1200);
}

const b = await chromium.launch();

if (MODE === "nullops") {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  const n = await p.evaluate(() => ({
    card3: [...document.querySelectorAll("#case .lp-cx-hd span")].filter((e) => e.textContent.includes("다녀간 AI·검색 봇")).length,
    proof: document.querySelectorAll(".lp-proof").length,
    txt: document.querySelector(".lp").textContent,
  }));
  ok(n.card3 === 0 && n.proof === 0 && !n.txt.includes("편입니다"), `[nullops] #case 카드 3·「편입니다」 숨김 · .lp-proof 0 (카드 3 ${n.card3} · proof ${n.proof})`);
  ok(!/\b0 → 0\b/.test(n.txt) && !/NaN|null|undefined/.test(n.txt), "[nullops] 지어낸 0·null 문자열 없음");
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

// ── Step 50 단위 (서버 없이) ──
/** import 가 있는 TS 파일 — ./x · @/lib/x 를 같은 방식으로 불러 data: 주소로 바꿔 끼운다 */
const tsCache = new Map();
async function tsUrl(file) {
  if (tsCache.has(file)) return tsCache.get(file);
  let js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = file.slice(0, file.lastIndexOf("/"));
  for (const m of [...js.matchAll(/from\s+"((?:\.\/|@\/lib\/)[^"]+)"/g)]) {
    // .mjs 는 그대로 file: 주소로(Step 55a — platform-hosts.mjs)
    if (m[1].endsWith(".mjs")) { js = js.replace(`"${m[1]}"`, `"${new URL(m[1].replace(/^@\/lib\//, "./"), `file:///${dir}/`).href}"`); continue; }
    const dep = m[1].startsWith("@/lib/") ? `C:/dev/AGO&GEO/web/lib/${m[1].slice(6)}.ts` : `${dir}/${m[1].slice(2)}.ts`;
    js = js.replace(`"${m[1]}"`, `"${await tsUrl(dep)}"`);
  }
  const url = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
  tsCache.set(file, url);
  return url;
}
const loadDeep = async (file) => import(await tsUrl(file));
const RB = await loadTs("C:/dev/AGO&GEO/web/lib/robots.ts");
const PC = await loadDeep("C:/dev/AGO&GEO/web/lib/platform-check.ts");
const NS = await loadTs("C:/dev/AGO&GEO/web/lib/no-site.ts");
const SC = await loadDeep("C:/dev/AGO&GEO/web/lib/scan.ts");
const UA = SC.UA;

// [50-R] robots 매처
{
  const v = (txt, bot, path) => RB.verdict(RB.parseRobots(txt), bot, path);
  const a = v("User-agent: *\nDisallow: /a\nAllow: /a/b", "X", "/a/b/c");
  const b2 = v("User-agent: *\nDisallow: /a\nAllow: /a/b", "X", "/a/x");
  ok(a.allowed && a.rule === "Allow: /a/b" && !b2.allowed && b2.rule === "Disallow: /a", `[50-R] 가장 긴 일치가 이김 (/a/b/c ${a.rule} · /a/x ${b2.rule})`);
  const t = v("User-agent: *\nDisallow: /p\nAllow: /p", "X", "/p/q");
  ok(t.allowed && t.rule === "Allow: /p", `[50-R] 같은 길이면 Allow (${t.rule})`);
  const s1 = v("User-agent: *\nDisallow: /*.pdf", "X", "/x/y.pdf"), s2 = v("User-agent: *\nDisallow: /*.pdf", "X", "/x/y.html");
  ok(!s1.allowed && s2.allowed, "[50-R] `*` 는 아무 글자 (/x/y.pdf 막힘 · /x/y.html 들어옴)");
  const d1 = v("User-agent: *\nDisallow: /\nAllow: /$", "X", "/"), d2 = v("User-agent: *\nDisallow: /\nAllow: /$", "X", "/a");
  ok(d1.allowed && !d2.allowed, `[50-R] \`$\` 끝 고정 — Disallow: / + Allow: /$ 에서 / 들어옴 · /a 막힘 (${d1.rule} · ${d2.rule})`);
  const mg = RB.parseRobots("User-agent: a\nDisallow: /x\n\nUser-agent: b\nDisallow: /\n\nUser-agent: a\nDisallow: /y");
  ok(!RB.verdict(mg, "a", "/x").allowed && !RB.verdict(mg, "a", "/y").allowed && RB.verdict(mg, "a", "/z").allowed && !RB.verdict(mg, "b", "/z").allowed, "[50-R] 같은 UA 그룹 합치기 (a: /x·/y 막힘, /z 들어옴)");
  const mu = RB.parseRobots("User-agent: a\nUser-agent: b\nDisallow: /");
  ok(!RB.verdict(mu, "a", "/").allowed && !RB.verdict(mu, "b", "/").allowed, "[50-R] 한 그룹에 UA 여럿");
  const uc = v("User-agent: GPTBOT\nDisallow: /", "GPTBot", "/");
  ok(!uc.allowed && uc.group === "own", `[50-R] UA 대소문자 무시 (group ${uc.group})`);
  const em = v("User-agent: *\nDisallow:", "X", "/a");
  ok(em.allowed && em.rule === null, "[50-R] 빈 Disallow 무시");
  const ex = RB.parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /private");
  const c1 = RB.verdict(ex, "ClaudeBot", "/p"), c2 = RB.verdict(ex, "GPTBot", "/p");
  ok(c1.allowed && c1.group === "own" && !c2.allowed && c2.group === "*", "[50-R] 명시 그룹이 있으면 `*` 무시 (ClaudeBot 들어옴 · GPTBot `*` 로 막힘)");
  const no = v("Sitemap: https://x/s.xml", "X", "/");
  ok(no.allowed && no.group === "none", "[50-R] 그룹 없음 → 허용");
}

// [50-C] classifyTarget
{
  const P = ["blog.naver.com/robotncoding", "m.blog.naver.com/robotncoding", "robotncoding.tistory.com", "instagram.com/cited.kr", "pf.kakao.com/_x", "naver.me/abc"];
  const got = P.map((x) => [x, PC.classifyTarget(x)]);
  ok(got.every(([, r]) => r.kind === "platform"), `[50-C] 플랫폼 ${got.map(([x, r]) => `${x}=${r.kind}${r.id ? "/" + r.id : ""}`).join(" ")}`);
  const E = ["blog.naver.com", "new.smartplace.naver.com/x", "https://blog.naver.com:8080/a", "", "asdf", "http://", "ftp://blog.naver.com/a"];
  const ge = E.map((x) => [x, PC.classifyTarget(x)]);
  ok(ge.every(([, r]) => r.kind === "error" && /[가-힣]/.test(r.msg)), `[50-C] 오류 ${ge.map(([x, r]) => `「${x}」=${r.kind}`).join(" ")}`);
  ok(PC.classifyTarget("new.smartplace.naver.com/x").msg.startsWith("스마트플레이스 관리 화면") && PC.classifyTarget("blog.naver.com").msg.startsWith("블로그·계정 주소 전체"), "[50-C] 스마트플레이스·뿌리 주소 문구");
  const S = ["blog.naver.com.evil.com", "cited.kr", "localhost.example"];
  ok(S.every((x) => PC.classifyTarget(x).kind === "site"), "[50-C] blog.naver.com.evil.com · cited.kr → site");
  const cr = PC.classifyTarget("https://x:y@blog.naver.com/a#h");
  ok(cr.kind === "platform" && cr.url === "https://blog.naver.com/a", `[50-C] 사용자 정보·# 버림 → ${cr.url}`);
}

// [50-A4] 규칙 파일을 못 받았을 때
{
  for (const st of [429, 503, 0]) {
    const h = PC.judgeHost("m.place.naver.com", null, st, "<html>Too Many</html>", "/x", "Yeti");
    const lines = PC.buildLines("네이버 플레이스", [h], { fetched: false, status: st, title: null, description: null, textLen: null, iframe: false });
    ok(h.robots === "fail" && h.bots.every((b) => b.allowed === null) && lines.some((l) => l === "m.place.naver.com의 봇 규칙을 확인하지 못했습니다. 잠시 뒤 다시 눌러 주세요.") && !lines.some((l) => l.includes("막아 두었습니다")),
      `[50-A4] ${st} → fail · allowed 전부 null · 「확인하지 못했습니다」 (${lines.join(" | ")})`);
  }
  const h = PC.judgeHost("x.tistory.com", null, 404, "", "/", null);
  const lines = PC.buildLines("티스토리", [h], { fetched: true, status: 200, title: "t", description: "d", textLen: 900, iframe: false });
  ok(h.robots === "none" && h.bots.every((b) => b.allowed === true) && lines.includes("x.tistory.com에는 봇 규칙 파일이 없습니다. 모든 봇이 들어올 수 있습니다.") && lines[0] === "티스토리는 확인한 AI·검색 봇 11개를 막지 않습니다.", `[50-A4] 404 → none · 모두 허용 (${lines.join(" | ")})`);
  const yeti = PC.judgeHost("blog.naver.com", "PC 주소", 200, "User-agent: Yeti\nDisallow: /", "/a", "Yeti");
  const yl = PC.buildLines("네이버 블로그", [yeti], { fetched: true, status: 200, title: "t", description: null, textLen: 100, iframe: true });
  ok(yeti.bots.find((b) => b.id === "Yeti").self && !yl.some((l) => l.includes("네이버 검색")) && yl.includes("글 본문이 안쪽 틀(iframe)로 따로 열립니다. 이 주소의 첫 화면에는 글자가 100자뿐입니다.") && yl.at(-1) === "이 규칙은 네이버 블로그가 정합니다. 사장님이 바꿀 수 있는 설정이 아닙니다.", `[50-A4] 자기 봇(Yeti) 문장에서 뺌 · iframe 문장 (${yl.join(" | ")})`);
}

// [50-S] safeFetch — 허용 밖 리다이렉트를 따라가지 않는다 · http 거절
{
  const fake = (plan) => {
    const calls = [];
    const f = async (url) => {
      calls.push(url);
      const p = plan[calls.length - 1];
      return new Response(p.body ?? "", { status: p.status, headers: p.location ? { location: p.location } : {} });
    };
    return { f, calls };
  };
  let k = fake([{ status: 302, location: "https://evil.example.com/x" }, { status: 200, body: "secret" }]);
  let r = await PC.safeFetch("https://naver.me/abc", k.f);
  ok(!r.ok && k.calls.length === 1 && !r.body, `[50-S] 허용 밖(evil.example.com)으로 리다이렉트 → 따라가지 않음 (요청 ${k.calls.length}번)`);
  k = fake([{ status: 302, location: "http://blog.naver.com/a" }]);
  r = await PC.safeFetch("https://naver.me/abc", k.f);
  ok(!r.ok && k.calls.length === 1, `[50-S] https → http 리다이렉트 거절 (요청 ${k.calls.length}번)`);
  k = fake([{ status: 302, location: "http://127.0.0.1:3047/" }]);
  r = await PC.safeFetch("https://naver.me/abc", k.f);
  ok(!r.ok && k.calls.length === 1, "[50-S] 로컬 주소로 리다이렉트 거절");
  k = fake([{ status: 200 }]);
  r = await PC.safeFetch("http://blog.naver.com/robotncoding", k.f);
  ok(!r.ok && k.calls.length === 0, `[50-S] http:// 대상 → 요청 0번`);
  r = await PC.safeFetch("https://example.com/", k.f);
  ok(!r.ok && k.calls.length === 0, "[50-S] 허용 목록 밖 대상 → 요청 0번");
  k = fake([{ status: 301, location: "https://blog.naver.com/abc" }, { status: 200, body: "<title>t</title>" }]);
  r = await PC.safeFetch("https://naver.me/abc", k.f);
  ok(r.ok && k.calls.length === 2 && r.url === "https://blog.naver.com/abc", `[50-S] 허용 안 리다이렉트는 따라감 (${r.url})`);
  k = fake([1, 2, 3, 4, 5].map(() => ({ status: 302, location: "https://blog.naver.com/loop" })));
  r = await PC.safeFetch("https://blog.naver.com/a", k.f);
  ok(!r.ok && k.calls.length === 4, `[50-S] 3홉에서 멈춤 (요청 ${k.calls.length}번)`);
  k = fake([{ status: 302, location: "https://evil.example.com/" }]);
  const cp = await PC.checkPlatform("naver_short", "https://naver.me/abc", k.f);
  ok(cp.hosts.length === 0 && cp.lines.length === 1 && cp.lines[0].startsWith("이 주소를 열어 보지 못했습니다.") && !("total" in cp), `[50-S] 짧은 주소가 밖으로 가면 확인 멈춤 (${cp.lines[0]})`);
}

// no-site 질문
{
  const q = NS.askQuestions("  로봇&코딩   학원 ", " 송파구", "코딩학원 ");
  ok(JSON.stringify(q) === JSON.stringify(["송파구 코딩학원 추천", "송파구에서 코딩학원 찾는데 어디가 좋아?", "로봇&코딩 학원 어떤 곳이야?"]), `[50-L0] askQuestions 템플릿·공백 정리 (${q.join(" / ")})`);
}

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
  const caseHtml = (await req("/case/academy.html")).body;
  const hit = ["대표가 운영", "직접 운영", "본인 학원", "남에게 팔기"].filter((w) => ll.body.includes(w) || caseHtml.includes(w));
  ok(hit.length === 0, `[원장 10/16] llms.txt·케이스 리포트에 학원 운영자 밝힘 0${hit.length ? " — " + hit.join(",") : ""}`);
}
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
ok(faqScreen.length === 11 && faqData.length === 11, `FAQ 화면 ${faqScreen.length} · JSON-LD ${faqData.length}`);
ok(JSON.stringify(faqScreen) === JSON.stringify(faqData), "FAQ 화면 질문·답 = JSON-LD 글자 그대로");
ok(faqScreen[0]?.[0] === "사이티드(Cited)는 무슨 회사인가요?" && faqScreen[0]?.[1] === site.CITED_ABOUT.join(" "), "FAQ 1 = 사이티드(Cited) 정의문");
ok(faqScreen[3]?.[1]?.endsWith(PILOT.after), "FAQ 4(비용) 끝 = PILOT.after");

// ── Step 48 · #film (D135–D138, D140) ──
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
  ok(!F?.lab && F?.h2 === "사이티드가 하는 일" && !F?.sub, `#film 제목만 (D140) (${F?.lab} | ${F?.h2} | ${F?.sub})`);
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
  startSub: document.querySelector("#start .lp-sub")?.textContent ?? "",
  heroAnchors: document.querySelectorAll('.lp-hero a[href^="#"]').length,
  proof: document.querySelectorAll(".lp-proof").length,
  caseLab: document.querySelector("#case .lp-lab")?.textContent ?? "",
  card3: [...document.querySelectorAll("#case .lp-cx")].find((e) => e.querySelector(".lp-cx-hd span")?.textContent.includes("다녀간 AI·검색 봇"))?.textContent ?? "",
  card1: [...document.querySelectorAll("#case .lp-cx")].find((e) => e.querySelector(".lp-cx-hd span")?.textContent.includes("이름 없이 찾는 검색어"))?.textContent ?? "",
}));
for (const [n, v] of [["hero lede", T.lede], ["#geo define", T.define], ["footer desc", T.foot], ["footer ©", T.bottom], ["title", head.title]]) ok(v.includes("사이티드(Cited)"), `「사이티드(Cited)」 in ${n}`);
ok(T.price.includes("39만원") && T.price.includes("절반") && T.price.includes("전액"), "#price sub 「39만원」·「전액」·「절반」 = PILOT price·refund[0]·refund[1]");
for (const bad of ["geo-rose-nine", "도입 사례", "크롤러 누적 방문", "채점 기준 바뀜", "대표가 운영", "직접 운영", "대표 학원"]) {
  const at = await p.evaluate((bad) => [...document.querySelectorAll(".lp *")].filter((e) => e.children.length === 0 && e.textContent.includes(bad)).map((e) => e.className || e.tagName), bad);
  ok(!T.all.includes(bad), `화면에 「${bad}」 0${at.length ? " — 남은 곳: " + at.join(", ") : ""}`);
}
const ORDER = ["film", "geo", "data", "case", "who", "services", "how", "why", "price", "diff", "nots", "faq", "guides", "start"];
ok(JSON.stringify(T.ids) === JSON.stringify(ORDER), `절 순서 ${T.ids.join(" › ")}`);
ok(!T.ids.includes("proof") && !(await p.$("#proof")), "#proof 없음");
ok(T.nav.includes("하는 일") && T.nav.includes("첫 적용 기록") && !T.nav.includes("GEO란") && !T.nav.includes("도입 사례"), `네비 ${T.nav.join(" · ")}`);
// 48:255 → 자가 확인 한 줄은 #start 부제로 옮겼다
ok(T.startSub.includes("「○○구 치과 추천해줘」"), "#start 부제에 자가 확인 「○○구 치과 추천해줘」");
// 48:256 → 히어로 링크 삭제
ok(T.heroAnchors === 0, `히어로 안 a[href^="#"] ${T.heroAnchors}개`);
// 48:257 → 증거 줄 삭제 · 같은 머리말은 #case 라벨(D122)
ok(T.proof === 0 && T.caseLab.includes("첫 적용 · 수도권 코딩·로봇 학원") && !T.caseLab.includes("운영"), `.lp-proof ${T.proof} · #case 라벨 「${T.caseLab}」`);
// 48:258 → 증거 칸 숫자는 #case 로
{
  const m = T.card3.match(/AI 가 읽을 수 있는 글은 (\d+)편입니다/);
  ok(T.caseLab.includes(`${caseDay}일차`) && !!m && Number(m[1]) > 0, `#case 라벨 「${caseDay}일차」 · 카드 3 「글은 ${m?.[1]}편」`);
}

// 48 D133 두 개 → 엔진 하나·측정일 칸은 없어졌고, #case 카드 1 정의문이 합계를 설명한다(D134)
{
  const vis = await screenText(p);
  ok(!/· (빙|네이버 웹문서|네이버 통합) · \d{1,2}\/\d{1,2} 측정/.test(vis), "화면에 「· 빙 · M/D 측정」 꼴 0");
  ok(T.card1.includes("검색엔진 한 곳 이상에서"), "#case 카드 1 정의문 「검색엔진 한 곳 이상에서」 유지 (D134)");
}

// keep-all
const wb = await p.evaluate(() => {
  const sels = [".lp-lede", ".lp-hero .formnote", "#geo .lp-define", "#geo .lp-note", "#data .lp-sub", "#data .lp-split-foot", "#case .lp-sub", "#case h2", "#who .lp-sub", ".lp-flow-panel p", "#how .lp-sub", "#why .lp-sub", "#price .lp-sub", ".lp-pcompare", "#nots .lp-sub", ".lp-faq-a p", "#start .lp-sub", "#film h2", ".lp-film-text li", ".lp-foot .desc", ".lp-foot .wm"];
  return sels.map((s) => [s, document.querySelector(s) ? getComputedStyle(document.querySelector(s)).wordBreak : "missing"]);
});
const notKeep = wb.filter(([, v]) => v !== "keep-all");
ok(notKeep.length === 0, `바뀐 한국어 블록 word-break: keep-all (${notKeep.map(([s, v]) => s + "=" + v).join(", ") || wb.length + "곳 전부"})`);

// ── Step 49 새 단정 ──
// 3. llms.txt 는 FAQ·가이드에만
{
  const vis = await screenText(p, ["faq", "guides"]);
  const n = vis.split("llms.txt").length - 1;
  ok(n === 0, `[49-3] #faq·#guides 밖 화면 글자에 「llms.txt」 ${n}`);
}
// 4. 서비스 카드 영어 라벨
{
  const vis = await screenText(p);
  const eng = ["Measurement", "Technical", "Placement", "Build", "Diagnosis"].filter((w) => vis.includes(w));
  const svcLatin = await p.evaluate(() => [...document.querySelectorAll(".lp-svc")].map((e) => e.innerText).join(" ").match(/[A-Za-z]+/g) ?? []);
  const latin = svcLatin.filter((w) => w !== "AI");
  const tags = await p.$$eval(".lp-svc .tag", (e) => e.length);
  ok(eng.length === 0 && latin.length === 0 && tags === 0, `[49-4] 영어 라벨 ${JSON.stringify(eng)} · .lp-svc 라틴 낱말(「AI」 제외) ${JSON.stringify(latin)} · .lp-svc .tag ${tags}`);
}
// 5. 업계 말
{
  const vis = await screenText(p);
  const faqAns = faqData.map((x) => x[1]).join("\n");
  const BAN = ["리포트", "크롤러", "이관", "정합성", "근거 콘텐츠", "대시보드", "구축", "7가지를 자동으로", "점수 제외", "10~30초"];
  const hit = BAN.filter((w) => vis.includes(w) || faqAns.includes(w)).map((w) => `${w}(화면 ${vis.split(w).length - 1}·FAQ ${faqAns.split(w).length - 1})`);
  ok(hit.length === 0, `[49-5] 화면·FAQ JSON-LD 에 업계 말 0${hit.length ? " — " + hit.join(", ") : ""}`);
}
// 6. 풀이는 처음 보이는 자리에 정확히 한 번
{
  const vis = await screenText(p);
  const G = [
    ["30일 파일럿", "(한 달 시범 계약)", /30일 파일럿/g],
    ["기술 세팅", "(AI가 읽게 손봄)", /기술 세팅/g],
    ["기준선 보고", "(시작 때 숫자)", /기준선 보고/g],
    ["봇", "(자동 방문 프로그램)", /(?<!로)봇/g],
    ["구조화 데이터", "(AI가 읽는 이름표)", /구조화 데이터/g],
  ];
  const bad = [];
  const at = [];
  for (const [w, g, re] of G) {
    const first = vis.search(re);
    const pair = vis.indexOf(w + g);
    const count = vis.split(w + g).length - 1;
    at.push(`${w}@${first}`);
    if (first < 0 || first !== pair || count !== 1) bad.push(`${w}: 첫 자리 ${first} · 풀이 자리 ${pair} · 풀이 ${count}번`);
  }
  ok(bad.length === 0, `[49-6] 풀이 5개 첫 자리·1번 (${bad.join(" | ") || at.join(" ")})`);
}
// 7. 메타 문구 0 (R2) — #film 포함, 접힌 details 제외
{
  const vis = await screenText(p);
  const META = ["초로", "소리가 있습니다", "아래 세 장", "아래에", "아래가", "위에서 본", "이렇게 적습니다", "정리했습니다", "따로 적었습니다", "실었습니다", "싣습니다", "이 페이지", "다음 표", "보여 드립니다"];
  const hit = META.filter((w) => vis.includes(w)).map((w) => {
    const i = vis.indexOf(w);
    return `${w}「…${vis.slice(Math.max(0, i - 20), i + 20).replace(/\s+/g, " ")}…」`;
  });
  ok(hit.length === 0, `[49-7] 메타 문구 0${hit.length ? " — " + hit.join(", ") : ""}`);
}
// 10. FAQ 를 하나씩 열어 화면에 보이는 답 = JSON-LD 답 (닫힌 답이 HTML 에만 맞는 게 아니라 펼쳐도 같은지)
{
  const shown = [];
  const n = await p.$$eval(".lp-faq-i", (e) => e.length);
  for (let i = 0; i < n; i++) {
    const it = (await p.$$(".lp-faq-i"))[i];
    const open = await it.evaluate((e) => !e.querySelector(".lp-faq-a").hidden);
    if (!open) await (await it.$("button")).click();
    await p.waitForTimeout(80);
    shown.push(await it.evaluate((e) => e.querySelector(".lp-faq-a p").innerText.replace(/\s+/g, " ").trim()));
  }
  const want = faqData.map((x) => x[1].replace(/\s+/g, " ").trim());
  const diff = want.map((w, i) => (w === shown[i] ? null : i + 1)).filter(Boolean);
  ok(shown.length === 11 && diff.length === 0 && want[3].includes("홈페이지 제작 250만원"), `[49-10] FAQ 펼친 화면 답 = JSON-LD 답 11개${diff.length ? " — 다름: " + diff.join(",") : ""} · FAQ 4(비용) 「홈페이지 제작 250만원」`);
}

// 시연 회귀
{
  await p.evaluate(() => window.scrollTo(0, 0));
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

// ── Step 50 API · DB ──
const ENV = Object.fromEntries(fs.readFileSync("C:/dev/AGO&GEO/web/.env.local", "utf8").split(/\r?\n/)
  .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"(.*)"$/, "$1").trim()]));
const { Pool } = createRequire("C:/dev/AGO&GEO/web/package.json")("pg");
const dsn = new URL(ENV.DATABASE_URL);
dsn.searchParams.delete("sslmode");
const db = new Pool({ connectionString: dsn.toString(), ssl: /localhost|127\.0\.0\.1/.test(ENV.DATABASE_URL) ? undefined : { rejectUnauthorized: true } });
/** 검증이 만든 행 — 끝에 id 로 지운다(운영 DB 에 시험 리드·진단을 남기지 않는다) */
const madeLeads = [];
const madeScans = [];
async function cleanup() {
  if (madeLeads.length) await db.query("delete from geo.leads where id = any($1::uuid[])", [madeLeads]).then((r) => log.push(`note: 시험 리드 ${r.rowCount}행 삭제 (${madeLeads.length}건 만듦)`));
  if (madeScans.length) await db.query("delete from geo.scans where id = any($1::uuid[])", [madeScans]).then((r) => log.push(`note: 시험 진단 ${r.rowCount}행 삭제 (${madeScans.length}건 만듦)`));
  madeLeads.length = 0; madeScans.length = 0;
}
const post = async (path, obj) => { const r = await req(path, { method: "POST", body: JSON.stringify(obj) }); let j = null; try { j = JSON.parse(r.body); } catch {} return { status: r.status, j }; };

/** 같은 순간의 robots 를 검증이 직접 받아 robots.ts 로 계산한 값 */
async function liveVerdicts(host, path) {
  let status = 0, body = "";
  try {
    const r = await fetch(`https://${host}/robots.txt`, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    status = r.status; body = r.ok ? await r.text() : "";
  } catch {}
  const st = RB.robotsState(status, body);
  return Object.fromEntries(SC.BOTS.map((b) => [b.id, st.robots === "fail" ? null : st.robots === "none" ? true : RB.verdict(st.groups, b.id, path).allowed]));
}
function compareBots(name, resp, live) {
  const diff = [];
  for (const h of resp.hosts) for (const b of h.bots) if (live[h.host]?.[b.id] !== b.allowed) diff.push(`${h.host}/${b.id} 응답 ${b.allowed} · 실측 ${live[h.host]?.[b.id]}`);
  ok(diff.length === 0, `${name} 봇 판정 = 그 순간 실측 robots (${resp.hosts.map((h) => `${h.host}: 막힘 ${h.bots.filter((b) => b.allowed === false).map((b) => b.id).join(",") || "없음"}`).join(" | ")})${diff.length ? " — 다름: " + diff.join(", ") : ""}`);
  const blocked = [...new Set(resp.hosts.flatMap((h) => h.bots.filter((b) => b.allowed === false && !b.self).map((b) => b.plain)))];
  const miss = blocked.filter((p) => !resp.lines[0].includes(p));
  ok(blocked.length === 0 ? /막지 않습니다/.test(resp.lines[0]) : miss.length === 0, `${name} lines[0] 이 막힌 봇 ${blocked.length}개를 빠짐없이 담음${miss.length ? " — 빠짐: " + miss.join(",") : ""} (${resp.lines[0]})`);
}

// [50-A1] 네이버 블로그
{
  const { status, j } = await post("/api/scan", { domain: "blog.naver.com/robotncoding" });
  const live = { "blog.naver.com": await liveVerdicts("blog.naver.com", "/robotncoding"), "m.blog.naver.com": await liveVerdicts("m.blog.naver.com", "/robotncoding") };
  ok(status === 200 && j?.kind === "platform" && !("total" in j) && !("grade" in j), `[50-A1] blog.naver.com/robotncoding → ${status} kind ${j?.kind} · total·grade 필드 없음`);
  ok(j?.hosts?.length === 2 && j.hosts[0].label === "PC 주소" && j.hosts[1].label === "모바일 주소" && j.hosts.every((h) => h.robots === "ok"), `[50-A1] 호스트 2개 PC·모바일 (${j?.hosts?.map((h) => `${h.host} ${h.robots} ${h.status}`).join(" | ")})`);
  if (j?.hosts) compareBots("[50-A1]", j, live);
  ok(j?.hosts?.every((h) => h.bots.find((b) => b.id === "Yeti")?.self) && !j.lines.some((l) => l.includes("네이버 검색")), "[50-A1] Yeti 는 self · 문장에 「네이버 검색」 없음");
  log.push(`note: [50-A1] lines = ${j?.lines?.join(" | ")}`);
}
// [50-A2] 인스타그램
{
  const { status, j } = await post("/api/scan", { domain: "www.instagram.com/instagram/" });
  const live = { "www.instagram.com": await liveVerdicts("www.instagram.com", "/instagram/") };
  ok(status === 200 && j?.kind === "platform" && !("total" in j) && j.hosts?.length === 1, `[50-A2] www.instagram.com/instagram/ → ${status} kind ${j?.kind} · 호스트 ${j?.hosts?.length}`);
  if (j?.hosts) compareBots("[50-A2]", j, live);
  ok(!!j?.page?.title, `[50-A2] page.title 「${j?.page?.title}」`);
  log.push(`note: [50-A2] lines = ${j?.lines?.join(" | ")}`);
}
// [50-A3] 잡주소 · 홈페이지 회귀
{
  const bad = [];
  for (const d of ["asdf", "http://", "blog.naver.com", "localhost", "127.0.0.1"]) {
    const { status, j } = await post("/api/scan", { domain: d });
    bad.push(`${d}=${status} 「${j?.error}」`);
    ok(status === 400 && /[가-힣]/.test(j?.error ?? "") && !/Error|undefined|null/.test(j?.error ?? ""), `[50-A3] 「${d}」 → ${status} 사람 말 오류 「${j?.error}」`);
  }
  const { status, j } = await post("/api/scan", { domain: "cited.kr" });
  if (j?.scanId) madeScans.push(j.scanId);
  ok(status === 200 && j?.kind === "site" && typeof j.total === "number" && !!j.grade, `[50-A3] cited.kr → kind ${j?.kind} · total ${j?.total} · grade ${j?.grade}`);
}
// [50-L1] 주소 없음 접수
const stamp = `STEP50-VERIFY-${Date.now()}`;
let nsLeadId = null;
{
  const { status, j } = await post("/api/lead", { source: "no_site", company: stamp, area: "송파구", industry: "코딩학원", email: "step50-verify@example.com", phone: "010-0000-0000", concerns: ["가짜 질문"] });
  nsLeadId = j?.id ?? null;
  if (nsLeadId) madeLeads.push(nsLeadId);
  const row = nsLeadId ? (await db.query("select source, concerns, wants, site, scan_id, company from geo.leads where id = $1", [nsLeadId])).rows[0] : null;
  const want = NS.askQuestions(stamp, "송파구", "코딩학원").join(" / ");
  ok(status === 200 && row?.source === "no_site" && row.concerns === want && row.wants === "AI 답 확인 요청" && row.site === null && row.scan_id === null, `[50-L1] no_site → ${status} · source ${row?.source} · concerns = askQuestions (가짜 무시) 「${row?.concerns}」`);
  for (const miss of ["company", "area", "industry"]) {
    const body = { source: "no_site", company: stamp, area: "송파구", industry: "코딩학원", email: "step50-verify@example.com", [miss]: "  " };
    const r = await post("/api/lead", body);
    if (r.j?.id) madeLeads.push(r.j.id);
    ok(r.status === 400 && r.j?.error === "상호·지역·업종을 적어 주세요.", `[50-L1] ${miss} 빈칸 → ${r.status} 「${r.j?.error}」`);
  }
}
// [50-L3] platform_check · 이상한 source
{
  const { status, j } = await post("/api/lead", { source: "platform_check", email: "step50-verify@example.com", company: stamp + "-P", site: "https://blog.naver.com/robotncoding" });
  if (j?.id) madeLeads.push(j.id);
  const row = j?.id ? (await db.query("select source, site, wants from geo.leads where id = $1", [j.id])).rows[0] : null;
  ok(status === 200 && row?.source === "platform_check" && row.site === "https://blog.naver.com/robotncoding" && row.wants === "블로그·SNS 할 일", `[50-L3] platform_check → source ${row?.source} · site ${row?.site} · wants ${row?.wants}`);
  const odd = await post("/api/lead", { source: "admin", email: "step50-verify@example.com", company: stamp + "-X" });
  if (odd.j?.id) madeLeads.push(odd.j.id);
  const r2 = odd.j?.id ? (await db.query("select source from geo.leads where id = $1", [odd.j.id])).rows[0] : null;
  ok(odd.status === 200 && r2?.source === "contact", `[50-L3] source "admin" → 옛 규칙 source ${r2?.source}`);
}
// [50-L2] /admin 카드
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await c.newPage();
  await pg.goto(`${BASE}/admin/enter?key=${encodeURIComponent(ENV.ADMIN_TOKEN)}&to=/admin`, { waitUntil: "networkidle" });
  const card = await pg.evaluate((stamp) => [...document.querySelectorAll(".ld-card")].find((e) => e.querySelector(".h")?.textContent === stamp)?.innerText ?? null, stamp);
  const qs = NS.askQuestions(stamp, "송파구", "코딩학원");
  ok(!!card && card.includes("주소 없음 · AI 답 확인 요청") && qs.every((q) => card.includes(q)), `[50-L2] /admin 카드 이름표 「주소 없음 · AI 답 확인 요청」 · 질문 3개 (${card?.replace(/\s+/g, " ").slice(0, 160)})`);
  const pcard = await pg.evaluate((stamp) => [...document.querySelectorAll(".ld-card")].find((e) => e.querySelector(".h")?.textContent === stamp + "-P")?.innerText ?? null, stamp);
  ok(!!pcard && pcard.includes("블로그·SNS 진단 뒤"), "[50-L2] platform_check 카드 이름표 「블로그·SNS 진단 뒤」");
  await c.close();
}
await cleanup();
{
  const left = (await db.query("select count(*)::int n from geo.leads where company like 'STEP50-VERIFY-%'")).rows[0].n;
  ok(left === 0, `[50-L2] 시험 리드 남은 행 ${left}`);
}

/** #case 카드 1 — ops.ts 를 쓰지 않고 같은 뜻의 SQL 로 따로 센다 */
async function rivalFromDb() {
  const c = (await db.query("select id, schema_name from geo.clients where status <> 'ended' order by started_on, id limit 1")).rows[0];
  const S = c.schema_name;
  const { rows } = await db.query(`
    select count(*) filter (where w)::int won, count(*)::int total from (
      select query, bool_or(hit) w from ${S}.serp_checks
       where client_id = $1 and day = (select max(day) from ${S}.serp_checks where client_id = $1)
         and coalesce(nullif(kind, ''), '-') <> '색인' and query !~* '^site:'
         and case when nullif(kind, '') is not null then kind = '경쟁'
                  else lower(regexp_replace(query, '\\s', '', 'g')) !~ '(로봇앤코딩|로봇&코딩|로봇코딩|robotncoding)' end
       group by query) x`, [c.id]);
  return rows[0];
}

// 9. 서비스 이름 파급
{
  const r = await req("/services/build");
  const h1 = r.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? "";
  ok(r.status === 200 && h1.includes("홈페이지 제작") && !ll.body.includes("사이트 구축"), `[49-9] /services/build ${r.status} · h1 「${h1}」 · llms.txt 「사이트 구축」 ${ll.body.split("사이트 구축").length - 1}`);
}

/** 숫자 비교용 화면 글자 — 살아 있는 값(Count 칸·DB 에서 매일 바뀌는 값)은 비운다 */
async function liveFreeNumbers(pg) {
  await pg.evaluate(() => {
    for (const e of document.querySelectorAll(".lp-proof, #case .lp-cx-hd b, .lp-log .dim")) e.textContent = "";
  });
  const t = (await screenText(pg))
    .replace(/\d+일차/g, "")
    .replace(/\d{1,2}\/\d{1,2} 측정/g, "")
    .replace(/검색 \d+개입니다/g, "")
    .replace(/글은 \d+편입니다/g, "");
  return new Set(t.match(/\d+/g) ?? []);
}

// ── 스크린샷 1440·390 · 히어로 글자 수 · 숫자 보존 ──
const heroLens = [];
let localNums = null;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const pg = await c.newPage();
  await pg.goto(BASE + "/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${OUT}/${w}-hero.png` });
  // 1. 히어로 글자 수 — 업종 3개 1회차
  const inds = await pg.$$(".lp-ind");
  for (let i = 0; i < inds.length; i++) {
    await inds[i].click();
    await pg.waitForTimeout(150);
    const n = await pg.evaluate(() => document.querySelector(".lp-hero").innerText.replace(/\s/g, "").length);
    heroLens.push([`${w}/${i + 1}`, n]);
  }
  await inds[0].click();
  if (w === 1440) {
    // 2. 히어로 행동은 진단 하나
    const H = await pg.evaluate(() => {
      const subs = document.querySelectorAll('.lp-hero button[type="submit"]');
      return {
        subs: subs.length,
        bottom: subs[0] ? subs[0].getBoundingClientRect().bottom + window.scrollY : null,
        gone: document.querySelectorAll(".lp-herohint, .lp-herolinks, .lp-proof").length,
      };
    });
    ok(H.subs === 1 && H.gone === 0 && H.bottom !== null && H.bottom <= 900, `[49-2] 히어로 submit ${H.subs}개 · herohint·herolinks·proof ${H.gone} · submit 아래끝 ${Math.round(H.bottom)}px ≤ 900`);
  }
  await scrollAll(pg, h);
  if (w === 1440) {
    // 48:333 → 히어로 칸 대신 #case 카드 1 — 애니메이션이 끝난 숫자 = 서버 HTML 의 숫자
    const html = (await req("/")).body;
    const ssr = html.match(/이름 없이 찾는 검색어 · 착수 때 → 지금<\/span><b>([\s\S]*?)<\/b>/)?.[1]?.replace(/<!--[\s\S]*?-->|<[^>]+>/g, "") ?? null;
    const shown = await pg.evaluate(() => [...document.querySelectorAll("#case .lp-cx-hd")].find((e) => e.textContent.includes("이름 없이 찾는 검색어"))?.querySelector("b")?.textContent ?? null);
    ok(!!ssr && shown === ssr && /^0 → \d+ \/ \d+$/.test(shown), `#case 카드 1 숫자(애니메이션 뒤) = 서버 HTML (${shown} | ${ssr})`);
    // [50-K] 같은 숫자를 DB 에서 따로 센 값과 대조
    const k = await rivalFromDb();
    ok(shown === `0 → ${k.won} / ${k.total}`, `[50-K] #case 카드 1 「${shown}」 = DB 따로 센 값 0 → ${k.won} / ${k.total}`);
    // D132 — 붙은 절끼리 배경이 같지 않다(히어로·푸터 포함)
    const bgs = await pg.evaluate(() => [document.querySelector(".lp-hero"), ...document.querySelectorAll(".lp > section[id]"), document.querySelector(".lp-foot")]
      .map((e) => [e.id || e.className.split(" ")[0], getComputedStyle(e).backgroundColor]));
    const same = bgs.slice(1).filter((x, i) => x[1] === bgs[i][1]).map((x) => x[0]);
    ok(same.length === 0, `붙은 절 배경 모두 다름${same.length ? " — 겹침: " + same.join(",") : ""} (${bgs.map((x) => x[0] + "=" + x[1].replace(/\s/g, "")).join(" › ")})`);
  }
  // 붙박이 네비가 절 위를 덮어 찍히지 않게 절 사진에서만 숨긴다
  await pg.addStyleTag({ content: "nav.lp-nav{visibility:hidden!important}" });
  for (const id of ["case", "services", "how", "why", "price", "start"]) {
    const el = await pg.$("#" + id);
    await el.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(300);
    await el.screenshot({ path: `${OUT}/${w}-${id}.png` });
  }
  const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw[0] <= sw[1], `[${w}] 가로 넘침 없음 (scrollWidth ${sw[0]} ≤ ${sw[1]})`);
  if (w === 1440) localNums = await liveFreeNumbers(pg);
  await c.close();
}
{
  const max = Math.max(...heroLens.map((x) => x[1]));
  ok(max <= 400, `[49-1] 히어로 글자(공백 뺌) 최댓값 ${max} ≤ 400 (${heroLens.map((x) => x.join("=")).join(" ")})`);
}

// ── Step 50 화면 — 세 길 (1440·390) ──
const errs50 = [];
const shot = async (pg, w, state) => {
  const el = await pg.$("header.lp-hero");
  await el.screenshot({ path: `${OUT}/${w}-${state}.png` });
};
const FORBID = ["robots", "llms", "JSON-LD", "SSR", "User-agent", "sitemap", "크롤러", "치명"];
let failShot = "안 나옴";
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.route("**/api/{scan,lead}", (r) => r.continue({ headers: { ...r.request().headers(), "x-forwarded-for": nextIp() } }));
  const pg = await c.newPage();
  pg.on("pageerror", (e) => errs50.push(`pageerror: ${e.message}`));
  pg.on("console", (m) => { if (m.type() === "error") errs50.push(`console: ${m.text().slice(0, 200)}`); });
  await pg.goto(BASE + "/", { waitUntil: "networkidle" });
  await pg.addStyleTag({ content: "nav.lp-nav{visibility:hidden!important}" });
  const scan = async (d) => {
    await pg.fill("#dom-hero", d);
    const resp = pg.waitForResponse((r) => r.url().endsWith("/api/scan"), { timeout: 60000 });
    await pg.click("#dom-hero ~ button");
    const j = await (await resp).json().catch(() => null);
    await pg.waitForSelector(".lp-hero .err, .lp-hero .result", { timeout: 30000 });
    await pg.waitForTimeout(300);
    return j;
  };

  // A — 홈페이지
  const a = await scan("cited.kr");
  if (a?.scanId) madeScans.push(a.scanId);
  const A = await pg.evaluate(() => document.querySelector(".lp-hero .result")?.innerText ?? "");
  const hit = FORBID.filter((x) => A.toLowerCase().includes(x.toLowerCase()));
  ok(/\/ 100/.test(A) && hit.length === 0, `[50-U ${w}] 결과 A 에 ${FORBID.join("·")} 0회${hit.length ? " — 있음: " + hit.join(",") : ""}`);
  if (w === 1440) {
    const rows = await pg.$$eval(".lp-hero .result .rrow .l", (e) => e.map((x) => x.textContent));
    ok(rows.length === 6 && !rows.some((r) => /llms/i.test(r)), `[50-U] 결과 A 행 6개 · 가중치 0 행 빠짐 (${rows.join(" · ")})`);
    log.push(`note: 결과 A 할 일 = ${await pg.$$eval(".lp-hero .fix", (e) => e.map((x) => x.innerText.replace(/\s+/g, " ")).join(" | "))}`);
  }
  await shot(pg, w, "A");

  // B — 네이버 블로그 · 인스타그램
  for (const [state, d] of [["B-naver", "blog.naver.com/robotncoding"], ["B-instagram", "www.instagram.com/instagram/"]]) {
    const j = await scan(d);
    const B = await pg.evaluate(() => document.querySelector(".lp-hero .result.pres")?.innerText ?? "");
    const lines = j?.lines ?? [];
    ok(!!B && !B.includes("/ 100") && !B.includes("위험") && lines.every((l) => B.includes(l)) && /\d{1,2}\/\d{1,2} \d{2}:\d{2} 확인/.test(B), `[50-U ${w}] ${state}: 점수·「위험」 없음 · lines ${lines.length}줄 화면에 그대로 · KST 확인 시각`);
    if (w === 1440 && state === "B-naver") {
      const yeti = await pg.evaluate(() => [...document.querySelectorAll(".pbot")].find((e) => e.querySelector("span").textContent === "네이버 검색")?.querySelector("b").textContent);
      ok(yeti === "네이버 블로그 자체 검색 — 이 규칙으로 판단 못 함", `[50-U] 네이버 검색 줄 「${yeti}」`);
      const kst = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(new Date(j.checkedAt));
      ok(B.includes(kst.replace(/(\d+)\/(\d+)/, "$1/$2") + " "), `[50-U] 확인 날짜가 서울 날짜 (${kst})`);
    }
    await shot(pg, w, state);
  }

  // 확인 못 함 — 실측에서 나오면 찍는다(네이버 플레이스는 우리 UA 에 429 를 준 적이 있다)
  if (w === 1440) {
    const j = await scan("m.place.naver.com/place/11111111");
    if (j?.lines?.some((l) => l.includes("확인하지 못했습니다"))) { await shot(pg, w, "B-fail"); failShot = `찍음 (${w}-B-fail.png · ${j.hosts.map((h) => h.host + " " + h.status).join(", ")})`; }
    else failShot = `안 나옴 (${j?.hosts?.map((h) => h.host + " " + h.robots + " " + h.status).join(", ") ?? j?.error})`;
  }

  // 오류 — 잡주소
  await scan("asdf");
  const err = await pg.textContent(".lp-hero .err");
  ok(err === "주소를 다시 확인해 주세요. (예: blog.naver.com/아이디)", `[50-U ${w}] 잡주소 오류 「${err}」`);
  await shot(pg, w, "error");

  // C — 주소 없음
  const linkWb = await pg.evaluate(() => getComputedStyle(document.querySelector(".lp-hero .linkbtn")).wordBreak);
  await pg.click(".lp-hero .linkbtn");
  await pg.fill('.lp-hero [aria-label="상호"]', stamp);
  await pg.fill('.lp-hero [aria-label="지역"]', "송파구");
  await pg.fill('.lp-hero [aria-label="업종"]', "코딩학원");
  await pg.click('.lp-hero .ns-make button[type="submit"]');
  await pg.waitForSelector(".lp-hero .ns-q");
  const qs = await pg.$$eval(".lp-hero .ns-q .q", (e) => e.map((x) => x.textContent));
  const copies = await pg.$$eval(".lp-hero .ns-copy", (e) => e.length);
  ok(JSON.stringify(qs) === JSON.stringify(NS.askQuestions(stamp, "송파구", "코딩학원")) && copies === 3, `[50-U ${w}] 길 C 질문 3개 = askQuestions · 복사 버튼 ${copies}`);
  if (w === 1440) {
    const wb = [[".linkbtn", linkWb], ...await pg.evaluate(() => [".ns-q li", ".ns-how", ".lead .leadsub"].map((s) => [s, document.querySelector(".lp-hero " + s) ? getComputedStyle(document.querySelector(".lp-hero " + s)).wordBreak : "missing"]))];
    const bad = wb.filter(([, v]) => v !== "keep-all");
    ok(bad.length === 0, `[50-U] 새 블록 word-break keep-all (${bad.map((x) => x.join("=")).join(", ") || wb.length + "곳"})`);
  }
  await shot(pg, w, "C-questions");
  await pg.fill('.lp-hero .ns [aria-label="이메일"]', "step50-verify@example.com");
  const lr = pg.waitForResponse((r) => r.url().endsWith("/api/lead"));
  await pg.click('.lp-hero .ns .lead button[type="submit"]');
  const lj = await (await lr).json().catch(() => null);
  if (lj?.id) madeLeads.push(lj.id);
  await pg.waitForSelector(".lp-hero .ns .leaddone");
  const done = await pg.textContent(".lp-hero .ns .leaddone");
  ok(done === "접수됐습니다. step50-verify@example.com 로 보내 드립니다." && !/일 안에|시간 안에|내일|오늘/.test(done), `[50-U ${w}] 길 C 접수 「${done}」 · 기한 약속 없음`);
  await shot(pg, w, "C-done");

  // B 패널 keep-all (블로그 결과를 다시 띄워 본다 — 1440 만)
  if (w === 1440) {
    await scan("blog.naver.com/robotncoding");
    const wb = await pg.evaluate(() => [".pres-lines p", ".pbot", ".pres .leadsub"].map((s) => [s, getComputedStyle(document.querySelector(".lp-hero " + s)).wordBreak]));
    ok(wb.every(([, v]) => v === "keep-all"), `[50-U] 결과 B word-break keep-all (${wb.map((x) => x.join("=")).join(", ")})`);
  }
  const vis = await screenText(pg);
  ok(!vis.includes("주소만 넣으면"), `[50-U ${w}] 화면에 「주소만 넣으면」 0회`);
  await c.close();
}
log.push(`note: 「확인하지 못했습니다」 화면 — ${failShot}`);
await cleanup();
{
  const l = (await db.query("select count(*)::int n from geo.leads where company like 'STEP50-VERIFY-%' or email = 'step50-verify@example.com'")).rows[0].n;
  ok(l === 0, `[50-L] 끝난 뒤 시험 리드 ${l}행`);
}
{
  const bad = errs50.filter((e) => !/status of 400/.test(e));
  ok(bad.length === 0, `[50] 세 길 화면 콘솔 오류 0 (일부러 낸 400 제외) ${bad.join(" | ")}`);
}
// 8. 숫자 새로 안 생김 — 운영 cited.kr 화면 숫자 ⊆
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await c.newPage();
  let prodNums = null;
  try {
    await pg.goto(PROD, { waitUntil: "networkidle", timeout: 60000 });
    await scrollAll(pg, 900);
    prodNums = await liveFreeNumbers(pg);
  } catch (e) { log.push("note: 운영 화면을 못 읽음 " + e.message); }
  const extra = prodNums ? [...localNums].filter((n) => !prodNums.has(n)) : ["운영 화면 못 읽음"];
  ok(prodNums !== null && extra.length === 0, `[49-8] Step 49 화면 숫자 ${localNums.size}종 ⊆ 운영 ${prodNums?.size ?? "?"}종 (살아 있는 값 뺌)${extra.length ? " — 새 숫자: " + extra.join(",") : ""}`);
  await c.close();
}

await b.close();
await db.end();
const unexpected = [...errs.slice(0, errsBeforeScan), ...errs.slice(errsBeforeScan).filter((e) => !/status of 400/.test(e))];
ok(unexpected.length === 0, `콘솔 오류 0 (ScanForm 일부러 낸 400 제외) ${unexpected.join(" | ")}`);
fs.writeFileSync(`${OUT}/assertions.txt`, log.join("\n") + `\n\n${fails ? fails + " FAIL" : "ALL PASS"}\n`);
console.log(log.join("\n"));
console.log(fails ? `${fails} FAIL` : "ALL PASS");
process.exit(fails ? 1 : 0);
