// 네이버 자동 다시 로그인(Step 52) 시험 — DB·네트워크 없음. 저장값은 임시 폴더에 카나리아 비번으로 만든다.
// 로그인 화면은 ctx.route 로 채운 가짜다. 실제 네이버에는 아무 요청도 안 간다.
//   node scripts/test-auto-login.mjs
// 브라우저 시나리오는 자식 프로세스(--child)로 돌리고, 부모가 그 출력·상태 파일·바뀐 로그에서 카나리아를 찾는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOOLS = path.join(ROOT, "tools");
const 자식 = process.argv.includes("--child");

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) 통과++; else { 실패++; console.log(`✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };

if (!자식) {
  // ─────────────────────────────────────────── 준비: 임시 저장값(카나리아)
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), "auto-login-test-"));
  process.env.AUTO_LOGIN_SECRETS_DIR = 폴더;
  const 핵 = `CANARY-${crypto.randomBytes(8).toString("hex")}`;
  const 카나리아 = `${핵}&'"%한글`;
  const 아이디 = "force11test";
  // 시험용 저장값 — 비대화형. 비번은 base64 로 스크립트에 넣는다(따옴표·& 를 안 깨뜨리게). 운영 저장은 save-login 의 Get-Credential 이 한다
  const 만들기 = (name, u, p) => {
    const b = Buffer.from(p, "utf8").toString("base64");
    const 경로 = path.join(폴더, `${name}.xml`).replace(/'/g, "''");
    try {
      execFileSync(A.POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", [
        "$ErrorActionPreference = 'Stop'",
        `$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b}'))`,
        "$s = ConvertTo-SecureString -String $p -AsPlainText -Force",
        `New-Object System.Management.Automation.PSCredential('${u}', $s) | Export-Clixml -LiteralPath '${경로}'`,
      ].join("; ")], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch { console.log("시험 저장값을 못 만들었습니다(PowerShell)"); process.exit(1); }
  };
  const A = await import("../../tools/auto-login.mjs");
  만들기("naver", 아이디, 카나리아);
  fs.writeFileSync(path.join(폴더, "broken.xml"), "<Objs><깨진");

  // ─────────────────────────────────────────── 저장소에 안 들어감
  const git = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  for (const f of ["tools/.secrets/naver.xml", "tools/.secrets/naver.state.json", "tools/.secrets/shots/x.png"]) {
    봄(`git check-ignore ${f}`, git(["check-ignore", "-q", f]).status === 0);
  }
  봄("git ls-files tools/.secrets 빈 출력", git(["ls-files", "tools/.secrets"]).stdout.trim() === "");
  봄("check-ignore 는 루트 .gitignore 줄", /^\.gitignore:\d+:tools\/\.secrets\//.test(git(["check-ignore", "-v", "tools/.secrets/naver.xml"]).stdout.trim()));

  // ─────────────────────────────────────────── 복호화
  {
    const v = A.복호화("naver");
    봄("복호화 왕복 — 카나리아 그대로", v.p === 카나리아 && v.u === 아이디);
  }
  for (const name of ["broken", "없는이름"]) {
    let e = null;
    try { A.복호화(name); } catch (x) { e = x; }
    봄(`복호화 실패(${name}) → 고정 문구 하나`, e?.message === "저장된 로그인 값을 못 읽음" && e.cause === undefined && Object.keys(e).length === 0
      && !/Clixml|powershell|Exception|깨진/i.test(String(e.stack)), String(e?.message));
  }
  봄("저장값있음", A.저장값있음("naver") && !A.저장값있음("없는이름"));

  // ─────────────────────────────────────────── 시도가능·자동로그인할까
  const H = 3600 * 1000, 지금 = Date.parse("2026-10-17T12:40:00+09:00");
  const 빈 = { lastAttemptAt: null, lastResult: null, blocked: false, bad: false };
  봄("시도가능 — 처음", A.시도가능(빈, 지금));
  봄("시도가능 — 19시간59분 false", !A.시도가능({ ...빈, lastAttemptAt: 지금 - (20 * H - 60000) }, 지금));
  봄("시도가능 — 20시간 true", A.시도가능({ ...빈, lastAttemptAt: 지금 - 20 * H }, 지금));
  봄("시도가능 — blocked false", !A.시도가능({ ...빈, blocked: true }, 지금));
  봄("시도가능 — bad false", !A.시도가능({ ...빈, bad: true }, 지금));
  const 까닭 = (...a) => A.자동로그인할까(...a).까닭;
  봄("자동로그인할까 — 고객 프로필", 까닭(".browser-profile-docttak", true, 빈, 지금) === "고객 프로필");
  봄("자동로그인할까 — 고객 프로필 절대경로", 까닭(path.join(TOOLS, ".browser-profile-docttak"), true, 빈, 지금) === "고객 프로필");
  봄("자동로그인할까 — 저장값 없음", 까닭(".browser-profile", false, 빈, 지금) === "저장값 없음");
  봄("자동로그인할까 — 20시간 안", 까닭(".browser-profile", true, { ...빈, lastAttemptAt: 지금 - H }, 지금) === "20시간 안");
  봄("자동로그인할까 — 막힘", 까닭(".browser-profile", true, { ...빈, blocked: true }, 지금) === "막힘");
  봄("자동로그인할까 — 비번틀림", 까닭(".browser-profile", true, { ...빈, bad: true, blocked: true }, 지금) === "비번틀림");
  봄("자동로그인할까 — 함", A.자동로그인할까(".browser-profile", true, 빈, 지금).할까 === true);

  // ─────────────────────────────────────────── 상태 파일
  A.상태쓰기("naver", { lastAttemptAt: 지금, lastResult: "캡차", blocked: true, 엉뚱: 카나리아 });
  봄("상태쓰기 — 네 칸만", JSON.stringify(Object.keys(JSON.parse(fs.readFileSync(path.join(폴더, "naver.state.json"), "utf8")))) === '["lastAttemptAt","lastResult","blocked","bad"]');
  A.상태쓰기("naver", { blocked: false });
  봄("상태쓰기 — 덮어쓰기는 준 칸만", A.상태읽기("naver").lastResult === "캡차" && A.상태읽기("naver").blocked === false && A.상태읽기("naver").lastAttemptAt === 지금);
  봄("상태읽기 — 없으면 빈 상태", JSON.stringify(A.상태읽기("없는이름")) === JSON.stringify(빈));

  // ─────────────────────────────────────────── 출력 읽기 · 남은 날
  const 출력 = "글 제목\n네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).\n자동 로그인 멈춤: 캡차 · 화면 C:\\dev\\x\\naver-20261017-1240.png\r\n에디터 프레임을 못 찾았습니다.";
  봄("멈춤줄 — 근거 한 줄", A.멈춤줄(출력) === "자동 로그인 멈춤: 캡차 · 화면 C:\\dev\\x\\naver-20261017-1240.png", String(A.멈춤줄(출력)));
  봄("멈춤줄 — 같은 출력에 /로그인이 필요/ 여전히", /로그인이 필요/.test(출력));
  봄("멈춤줄 — 안 함 줄", A.멈춤줄("x\n자동 로그인 안 함: 20시간 안\n") === "자동 로그인 안 함: 20시간 안");
  봄("멈춤줄 — 없음 null", A.멈춤줄("네이버 로그인이 필요합니다.") === null && A.멈춤줄(undefined) === null);
  봄("남은날줄", A.남은날줄("a\nNID_AUT 남은 12일\n") === 12 && A.남은날줄("NID_AUT 남은 날 모름") === null);
  const 초 = Math.floor(지금 / 1000);
  봄("세션남은일 — 2.5일 → 2", A.세션남은일([{ name: "NID_AUT", expires: 초 + 2.5 * 86400 }], 지금) === 2);
  봄("세션남은일 — 세션만·없음 null", A.세션남은일([{ name: "NID_AUT", expires: -1 }], 지금) === null && A.세션남은일([], 지금) === null);

  // 세션경고 — 가짜 q
  const 가짜 = () => { const 로그 = []; return { 로그, q: async (s, p = []) => { 로그.push([s, p]); return []; } }; };
  {
    let g = 가짜();
    let r = await A.세션경고(g.q, 2, false, "2026-10-17 12:40");
    봄("N=2·저장값 없음 → soon 올림", r === "올림" && g.로그.length === 1 && /insert into geo\.agent_tasks/.test(g.로그[0][0]) && /'naver-session-soon'/.test(g.로그[0][0])
      && g.로그[0][1][0] === "네이버 블로그 로그인이 2일 뒤 풀립니다" && /node tools\/save-login\.mjs naver/.test(g.로그[0][1][1]));
    g = 가짜();
    r = await A.세션경고(g.q, 2, true, "2026-10-17 12:40");
    봄("N=2·저장값 있음 → 안 올림", r === "그대로" && g.로그.length === 0);
    g = 가짜();
    r = await A.세션경고(g.q, 10, false, "2026-10-17 12:40");
    봄("N=10 → soon 완료(근거 붙임)", r === "완료" && /update geo\.agent_tasks set status='완료'/.test(g.로그[0][0]) && /dedupe_key='naver-session-soon' and status='사람 대기'/.test(g.로그[0][0])
      && g.로그[0][1][0] === "2026-10-17 12:40 NID_AUT 남은 10일");
  }

  // 세션 경고 일감은 login- 으로 시작하지 않는다 — 현황판이 쓸 수 없는 「로그인 창 열기」 버튼을 붙이지 않게(D185)
  {
    const ts = createRequire(new URL("../../web/package.json", import.meta.url))("typescript");
    const 글 = fs.readFileSync(new URL("../../web/lib/todo-text.ts", import.meta.url), "utf8")
      .replace('import { plain, WORKFLOW_PLAIN } from "./agents";', "const plain = (s) => s; const WORKFLOW_PLAIN = {};");
    const 임시 = path.join(os.tmpdir(), `todo-text-al-${process.pid}.mjs`);
    fs.writeFileSync(임시, ts.transpileModule(글, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
    try {
      const { todoText } = await import(pathToFileURL(임시).href);
      const g = 가짜();
      await A.세션경고(g.q, 2, false, "2026-10-17 12:40");
      const 키 = /values \(1, 'deliver', 'human', '([^']+)'/.exec(g.로그[0][0])?.[1] ?? null;
      const x = todoText({ agent: "deliver", kind: "human", dedupe: 키, title: g.로그[0][1][0], detail: g.로그[0][1][1], error: "", evidence: "", link: null, payload: { sticky: true } });
      봄("세션 경고 일감 키는 naver-session-soon", 키 === "naver-session-soon", String(키));
      봄("todo-text — naver-session-soon 에 로그인 창 버튼 없음", x.action?.type !== "login" && !/로그인 창이 뜹니다/.test(x.why ?? ""), JSON.stringify(x.action));
      봄("todo-text — 대조: login-naver 는 로그인 버튼", todoText({ agent: "deliver", kind: "human", dedupe: "login-naver", title: "t", detail: "d", error: "", evidence: "", link: null, payload: { sticky: true } }).action?.type === "login");
    } finally { fs.rmSync(임시, { force: true }); }
  }

  // ─────────────────────────────────────────── 끼운 자리(원문)
  const nbp = fs.readFileSync(path.join(TOOLS, "naver-blog-post.mjs"), "utf8");
  const la = fs.readFileSync(path.join(TOOLS, "local-agent.mjs"), "utf8");
  봄("naver-blog-post — 기존 줄 글자 그대로", nbp.includes(`console.log("네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).");`));
  봄("naver-blog-post — 프로필열기 · 학원 프로필 비교 하나", /await 프로필열기\(path\.resolve\(process\.cwd\(\), PROFILE\)/.test(nbp) && /if \(PROFILE === "\.browser-profile"\)/.test(nbp));
  봄("local-agent — 멈춤줄을 근거로", /사람로그인\("naver", "네이버 블로그", 멈춤 \?/.test(la));
  봄("local-agent — 자동 로그인 안내 문장", la.includes("저장된 로그인 값이 있으면 먼저 혼자 다시 로그인해 보고, 막혔을 때만 이 일감이 뜹니다."));

  // ─────────────────────────────────────────── 브라우저 시나리오(자식) + 유출
  const 로그전 = new Map(fs.readdirSync(TOOLS).filter((f) => f.endsWith(".log")).map((f) => [f, fs.statSync(path.join(TOOLS, f)).size]));
  const c = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--child"], {
    cwd: path.join(ROOT, "academy"), encoding: "utf8", timeout: 10 * 60000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, AUTO_LOGIN_SECRETS_DIR: 폴더, TEST_CANARY_B64: Buffer.from(카나리아, "utf8").toString("base64"), TEST_ID: 아이디 },
  });
  const 자식출력 = `${c.stdout ?? ""}${c.stderr ?? ""}`;
  for (const l of 자식출력.split(/\r?\n/)) if (/^✗ /.test(l)) console.log(l);
  const m = /^자식 (\d+) 통과 · (\d+) 실패$/m.exec(c.stdout ?? "");
  봄("자식 시나리오 끝까지 돎", Boolean(m), 끝줄(자식출력));
  if (m) { 통과 += Number(m[1]); 실패 += Number(m[2]); }

  const 샘 = (글) => {
    const s = String(글 ?? "");
    const 찾음 = [];
    if (s.includes(핵)) 찾음.push("원문");
    if (s.includes(encodeURIComponent(카나리아))) 찾음.push("URL 인코딩");
    for (const t of s.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? []) {
      if (Buffer.from(t, "base64").toString("utf8").includes(핵)) { 찾음.push("base64"); break; }
    }
    for (const b of [Buffer.from(카나리아).toString("base64"), Buffer.from(JSON.stringify({ u: 아이디, p: 카나리아 })).toString("base64")]) if (s.includes(b)) 찾음.push("base64 그대로");
    return 찾음;
  };
  봄("유출 — 자식 stdout+stderr(반환 객체 포함)", 샘(자식출력).length === 0 && /결과 /.test(자식출력), 샘(자식출력).join(","));
  const 상태파일 = fs.readdirSync(폴더).filter((f) => f.endsWith(".state.json"));
  봄("유출 — state.json", 상태파일.length >= 1 && 상태파일.every((f) => 샘(fs.readFileSync(path.join(폴더, f), "utf8")).length === 0));
  const 바뀐로그 = fs.readdirSync(TOOLS).filter((f) => f.endsWith(".log") && fs.statSync(path.join(TOOLS, f)).size !== (로그전.get(f) ?? 0));
  봄("유출 — 시험 중 바뀐 tools/*.log", 바뀐로그.every((f) => {
    const b = fs.readFileSync(path.join(TOOLS, f));
    return 샘(b.subarray(Math.min(로그전.get(f) ?? 0, b.length)).toString("utf8")).length === 0;
  }), 바뀐로그.join(","));

  fs.rmSync(폴더, { recursive: true, force: true });
  console.log(`\n${통과} 통과 · ${실패} 실패`);
  if (실패) process.exitCode = 1;
}

function 끝줄(s) { return String(s).trim().split(/\r?\n/).slice(-3).join(" | ").slice(-300); }

if (자식) {
  const { chromium } = await import("../../tools/node_modules/playwright/index.mjs");
  const A = await import("../../tools/auto-login.mjs");
  const 카나리아 = Buffer.from(process.env.TEST_CANARY_B64, "base64").toString("utf8");
  const 아이디 = process.env.TEST_ID;
  const 폴더 = A.비밀폴더();

  // 실제 nid 화면을 본뜬 꼴(input#id · input#pw · input#keep[name=nvlong] + label · button#log.login). 숨은 캡차 틀이 늘 있다
  const 로그인화면 = ({ 위 = "", 막음 = false, 비번형 = "password" } = {}) => `<!doctype html><html><head><meta charset="utf-8"></head><body>
${위}
<form id="frmNIDLogin" method="POST" action="https://nid.naver.com/nidlogin.login" ${막음 ? 'onsubmit="event.preventDefault()"' : ""}>
  <input type="text" id="id" name="id" placeholder="아이디">
  <input type="${비번형}" id="pw" name="pw" placeholder="비밀번호">
  <input type="checkbox" id="keep" name="nvlong" class="input_keep" value="on"><label for="keep">로그인 상태 유지</label>
  <button type="submit" id="log.login" class="btn_login">로그인</button>
  ${위.includes('id="captcha"') ? "" : '<div id="captcha" style="display:none"><img id="captchaimg"></div>'}
</form>
<script>window.__keys = 0; window.__clicks = 0;
addEventListener("keydown", () => window.__keys++, true); addEventListener("input", () => window.__keys++, true);
document.getElementById("log.login").addEventListener("click", () => window.__clicks++);</script></body></html>`;
  const 글화면 = (글) => `<!doctype html><html><head><meta charset="utf-8"></head><body><p>${글}</p></body></html>`;
  const 블로그로 = `<!doctype html><html><body><script>location.href = "https://blog.naver.com/force11?Redirect=Write"</script></body></html>`;
  const 캡차틀 = '<div id="captcha"><img id="captchaimg" width="200" height="60" alt="">자동입력 방지문자를 입력해 주세요</div>';
  const 년 = () => Math.floor(Date.now() / 1000) + 365 * 86400;

  const 시나리오 = [
    { 이름: "성공", 기대: { ok: true }, post: async (ctx) => { await ctx.addCookies([{ name: "NID_AUT", value: "t", domain: ".naver.com", path: "/", expires: 년() }]); return 블로그로; } },
    { 이름: "세션만", 기대: { 사유: "모르는화면", blocked: true }, post: async (ctx) => { await ctx.addCookies([{ name: "NID_AUT", value: "t", domain: ".naver.com", path: "/" }]); return 블로그로; } },
    { 이름: "캡차", 기대: { 사유: "캡차", blocked: true }, post: async () => 로그인화면({ 위: 캡차틀 }) },
    // 네이버는 비번이 틀리면 캡차를 같이 띄운다 — 비번틀림(bad)이어야 옛 비번으로 다시 안 친다
    { 이름: "비번틀림+캡차", 기대: { 사유: "비번틀림", bad: true }, post: async () => 로그인화면({ 위: `${캡차틀}<div id="err_common">비밀번호를 잘못 입력했습니다.</div>` }) },
    { 이름: "2단계", 기대: { 사유: "2단계", blocked: true }, post: async () => 글화면("2단계 인증 알림을 보냈습니다. 휴대전화에서 확인해 주세요.") },
    { 이름: "새기기", 기대: { 사유: "새기기", blocked: true }, post: async () => 글화면("새로운 기기(브라우저)에서 로그인하려면 확인이 필요합니다.") },
    { 이름: "보호조치", 기대: { 사유: "보호조치", blocked: true }, post: async () => 글화면("회원님의 아이디를 보호조치 했습니다.") },
    { 이름: "비번틀림", 기대: { 사유: "비번틀림", bad: true }, post: async () => 로그인화면({ 위: '<div id="err_common">아이디(로그인 전용 아이디) 또는 비밀번호를 잘못 입력했습니다.</div>' }) },
    { 이름: "모르는화면", 기대: { 사유: "모르는화면", blocked: true }, post: async () => 글화면("잠시 후 다시 시도해 주세요.") },
    { 이름: "시간초과", 기대: { 사유: "시간초과" }, 첫화면: 로그인화면({ 막음: true }) },
    { 이름: "처음부터 캡차", 기대: { 사유: "캡차", blocked: true, 안침: true }, 첫화면: 로그인화면({ 위: 캡차틀 }) },
    // #pw 가 글자가 보이는 칸이면 비번을 안 친다(스크린샷에 찍힌다)
    { 이름: "비번 칸이 글자칸", 기대: { 사유: "모르는화면", blocked: true, 안침: true }, 첫화면: 로그인화면({ 비번형: "text" }) },
    { 이름: "칸 없음",기대: { 사유: "모르는화면", blocked: true, 안침: true }, 첫화면: 글화면("새 로그인 화면") },
    { 이름: "저장값 못 읽음", 저장값: "broken", 기대: { 사유: "저장값 못 읽음", bad: true, 안침: true } },
  ];

  const 브라우저 = await chromium.launch({ headless: true });
  for (const s of 시나리오) {
    const name = s.저장값 ?? "naver";
    fs.rmSync(path.join(폴더, `${name}.state.json`), { force: true });
    const ctx = await 브라우저.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
    const 제출 = [];
    let 밖 = 0;
    await ctx.route("**/*", async (route) => {
      const req = route.request(), u = req.url();
      if (/^https:\/\/nid\.naver\.com\//.test(u)) {
        if (req.method() === "POST") {
          제출.push(req.postData() ?? "");
          return route.fulfill({ contentType: "text/html; charset=utf-8", body: await s.post(ctx) });
        }
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: s.첫화면 ?? 로그인화면() });
      }
      if (/^https:\/\/blog\.naver\.com\//.test(u)) return route.fulfill({ contentType: "text/html; charset=utf-8", body: 글화면("블로그") });
      밖++;
      return route.abort();
    });
    const page = await ctx.newPage();
    await page.goto("https://nid.naver.com/nidlogin.login?mode=form&url=https%3A%2F%2Fblog.naver.com%2Fforce11%3FRedirect%3DWrite");
    const 샷 = path.join(폴더, "shots-test", s.이름);
    const 전 = Date.now();
    const r = await A.자동로그인(page, ctx, name, { shotsDir: 샷, 대기ms: 4000 });
    const 상태 = A.상태읽기(name);
    console.log(`결과 ${s.이름} ${JSON.stringify(r)} ${JSON.stringify(상태)}`);
    const 기 = s.기대, 이름 = `[${s.이름}]`;
    봄(`${이름} lastAttemptAt 남김`, 상태.lastAttemptAt >= 전);
    봄(`${이름} 바깥 요청 0`, 밖 === 0, String(밖));
    봄(`${이름} 로그인 제출 ≤ 1`, 제출.length <= 1, String(제출.length));
    if (기.ok) {
      const f = new URLSearchParams(제출[0] ?? "");
      봄(`${이름} ok`, r.ok === true && r.사유 === null, JSON.stringify(r));
      봄(`${이름} 제출에 카나리아 비번이 그대로`, f.get("pw") === 카나리아);
      봄(`${이름} 제출 아이디`, f.get("id") === 아이디);
      봄(`${이름} 로그인 상태 유지 켜짐`, f.get("nvlong") === "on");
      봄(`${이름} 상태 ok · 막힘 아님`, 상태.lastResult === "ok" && !상태.blocked && !상태.bad);
      봄(`${이름} 스크린샷 없음`, !fs.existsSync(샷));
    } else {
      봄(`${이름} 사유 ${기.사유}`, r.ok === false && r.사유 === 기.사유, JSON.stringify(r));
      봄(`${이름} 상태 값`, 상태.lastResult === 기.사유 && 상태.blocked === Boolean(기.blocked) && 상태.bad === Boolean(기.bad), JSON.stringify(상태));
      봄(`${이름} 스크린샷 파일`, Boolean(r.화면) && fs.existsSync(r.화면) && path.dirname(r.화면) === 샷 && /naver|broken/.test(path.basename(r.화면)));
      if (기.안침) {
        const 키 = await page.evaluate(() => window.__keys ?? 0).catch(() => 0);
        봄(`${이름} 입력 이벤트 0 · 제출 0`, 키 === 0 && 제출.length === 0, `${키}/${제출.length}`);
      }
      if (s.이름 === "시간초과") 봄(`${이름} 로그인 클릭 1`, (await page.evaluate(() => window.__clicks)) === 1);
    }
    await ctx.close();
  }
  await 브라우저.close();

  // 스크린샷은 최근 10장만
  {
    const 샷 = path.join(폴더, "shots-keep");
    fs.mkdirSync(샷, { recursive: true });
    for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(샷, `naver-20260101-00${String(i).padStart(2, "0")}.png`), "");
    const b2 = await chromium.launch({ headless: true });
    const ctx = await b2.newContext();
    await ctx.route("**/*", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: 글화면("새 로그인 화면") }));
    const page = await ctx.newPage();
    await page.goto("https://nid.naver.com/nidlogin.login");
    const r = await A.자동로그인(page, ctx, "naver", { shotsDir: 샷, 대기ms: 1000 });
    const 남음 = fs.readdirSync(샷).sort();
    봄("스크린샷 최근 10장만", 남음.length === 10 && 남음.includes(path.basename(r.화면 ?? "")) && !남음.includes("naver-20260101-0000.png"), 남음.join(","));
    await b2.close();
  }

  console.log(`자식 ${통과} 통과 · ${실패} 실패`);
}
