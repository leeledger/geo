/**
 * 네이버 블로그(학원) 자동 다시 로그인 — Step 52 (D176~D184).
 *
 * 저장: save-login.mjs 가 PowerShell 5.1 Get-Credential → Export-Clixml 로 tools/.secrets/naver.xml 을 쓴다.
 *       비번은 DPAPI(CurrentUser)로 암호화된다. Node 는 저장 때 비번을 못 본다.
 * 풀기: 로그인 순간에만. powershell.exe 자식이 base64(UTF8 JSON) 한 줄을 내고 Node 메모리에서만 쓴다.
 *       base64 인 까닭 — PowerShell 출력에 BOM·줄바꿈이 붙는다. 명령 인자에는 파일 경로만 들어간다.
 * 치기: 사람처럼 한 글자씩(60~160ms), 로그인 버튼은 한 번. 성공은 긍정형만(nid 를 떠남 + NID_AUT 「유지」).
 *       그 밖의 화면은 전부 멈춤 — 스크린샷 하나, 더 치지도 누르지도 않는다.
 * 횟수: 20시간에 한 번(치기 전에 시각을 남김). 비번 틀림은 bad(save-login 다시), 캡차 등은 blocked(사람 로그인 확인 때 풀림).
 *
 * 이 파일은 아이디·비번·복호화 결과를 어디에도 찍지 않는다. 오류도 고정 문구만 던진다.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { 네이버쿠키 } from "./login-rules.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const 하루 = 86400000;
/** Windows PowerShell 5.1(pwsh 아님) — Get-Credential 이 윈도 창이다. PATH 에 없을 때가 있어 전체 경로로(local-agent --install 과 같이) */
export const POWERSHELL = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

/** 저장값·상태·스크린샷 폴더. env 는 시험만 쓴다 */
export const 비밀폴더 = () => process.env.AUTO_LOGIN_SECRETS_DIR ?? path.join(HERE, ".secrets");
const xml경로 = (name) => path.join(비밀폴더(), `${name}.xml`);
const 상태경로 = (name) => path.join(비밀폴더(), `${name}.state.json`);

export const 저장값있음 = (name) => fs.existsSync(xml경로(name));

const 빈상태 = { lastAttemptAt: null, lastResult: null, blocked: false, bad: false };

/** { lastAttemptAt(ms), lastResult, blocked, bad } — 아이디·비번은 안 들어간다. 없거나 깨졌으면 빈 상태 */
export function 상태읽기(name) {
  try { return { ...빈상태, ...JSON.parse(fs.readFileSync(상태경로(name), "utf8")) }; } catch { return { ...빈상태 }; }
}

/** 있던 상태에 덮어쓴다. 네 칸만 남긴다 — 다른 값이 섞여 들어가지 않게 */
export function 상태쓰기(name, s) {
  const 합 = { ...상태읽기(name), ...s };
  fs.mkdirSync(비밀폴더(), { recursive: true });
  fs.writeFileSync(상태경로(name), JSON.stringify({ lastAttemptAt: 합.lastAttemptAt, lastResult: 합.lastResult, blocked: Boolean(합.blocked), bad: Boolean(합.bad) }));
}

/** D180 — 비번 틀림·막힘이 아니고 마지막 시도에서 20시간이 지났을 때만 */
export const 시도가능 = (s, now) => !s.bad && !s.blocked && (!s.lastAttemptAt || now - s.lastAttemptAt >= 20 * 3600 * 1000);

/** naver-blog-post 의 nid 분기 조건. 고객 프로필에는 학원 저장값을 절대 안 쓴다(D178) */
export function 자동로그인할까(PROFILE, 저장값, 상태, now) {
  if (PROFILE !== ".browser-profile") return { 할까: false, 까닭: "고객 프로필" };
  if (!저장값) return { 할까: false, 까닭: "저장값 없음" };
  if (상태.bad) return { 할까: false, 까닭: "비번틀림" };
  if (상태.blocked) return { 할까: false, 까닭: "막힘" };
  if (!시도가능(상태, now)) return { 할까: false, 까닭: "20시간 안" };
  return { 할까: true, 까닭: null };
}

/**
 * 저장값을 푼다. 실패하면 원래 오류·stdout·stderr 를 안 붙이고 고정 문구만 던진다.
 * powershell.exe(5.1) — DPAPI 를 같은 윈도 계정으로 풀어야 한다.
 * GetNetworkCredential().UserName — 5.1 Get-Credential 이 아이디 앞에 「\」를 붙여 돌려줄 때가 있어 그 몫을 뗀다
 */
export function 복호화(name) {
  const 경로 = xml경로(name).replace(/'/g, "''");
  const 스크립트 = [
    "$ErrorActionPreference = 'Stop'",
    `$c = Import-Clixml -LiteralPath '${경로}'`,
    "$n = $c.GetNetworkCredential()",
    "$j = @{ u = $n.UserName; p = $n.Password } | ConvertTo-Json -Compress",
    "[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($j))",
  ].join("; ");
  try {
    const out = execFileSync(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", 스크립트],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, encoding: "utf8" });
    const v = JSON.parse(Buffer.from(out.trim(), "base64").toString("utf8"));
    if (typeof v?.u !== "string" || typeof v?.p !== "string" || !v.u || !v.p) throw 0;
    return v;
  } catch {
    throw new Error("저장된 로그인 값을 못 읽음");
  }
}

/** launchPersistentContext 그대로. 잠금 없는 도구가 프로필을 쥐었으면 60초 쉬고 최대 3번 더. 남의 프로세스는 안 찾고 안 죽인다 */
export async function 프로필열기(dir, opts) {
  for (let i = 0; ; i++) {
    try { return await chromium.launchPersistentContext(dir, opts); }
    catch (e) {
      if (i >= 3) throw e;
      console.log(`브라우저 프로필을 못 열었습니다 — 60초 뒤 다시 (${i + 1}/3)`);
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }
}

/** NID_AUT 만료일까지 남은 날(내림). 없거나 세션 쿠키면 null */
export function 세션남은일(cookies, now = Date.now()) {
  const aut = (cookies ?? []).find((c) => c.name === "NID_AUT");
  if (!aut || !(aut.expires > 0)) return null;
  return Math.floor((aut.expires * 1000 - now) / 하루);
}

/** naver-blog-post 출력에서 멈춘 까닭 한 줄 — local-agent 일감 근거로 */
export const 멈춤줄 = (out) => /자동 로그인 (멈춤|안 함): [^\n]*/.exec(String(out ?? ""))?.[0].trimEnd() ?? null;
/** naver-blog-post 출력의 「NID_AUT 남은 N일」 */
export const 남은날줄 = (out) => { const m = /NID_AUT 남은 (\d+)일/.exec(String(out ?? "")); return m ? Number(m[1]) : null; };

/**
 * 세션이 곧 풀리는데(3일 이하) 저장값이 없으면 원장 일감 naver-session-soon. 저장값이 있으면 안 올린다 — 풀리면 자동 로그인이 받는다(D181).
 * 3일을 넘으면 열린 일감을 근거와 함께 완료. → "올림" | "완료" | "그대로"
 */
export async function 세션경고(q, n, 저장값, 지금) {
  if (n <= 3) {
    if (저장값) return "그대로";
    await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
             values (1, 'deliver', 'human', 'naver-session-soon', $1, $2, '사람 대기', 5, '{"sticky":true}'::jsonb)
             on conflict (client_id, dedupe_key) do update set status='사람 대기', title=excluded.title, updated_at=now()`,
      [`네이버 블로그 로그인이 ${n}일 뒤 풀립니다`, "PC 에서 node tools/save-login.mjs naver 를 한 번 돌리면 그 뒤로는 혼자 다시 로그인합니다."]);
    return "올림";
  }
  await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(coalesce(evidence, '') || E'\\n' || $1, 4000)
            where client_id=1 and dedupe_key='naver-session-soon' and status='사람 대기'`, [`${지금} NID_AUT 남은 ${n}일`]);
  return "완료";
}

/**
 * nid 로그인 화면. 선택자는 후보를 여럿 둔다 — 못 찾으면 「모르는화면」으로 멈추고 아무것도 안 친다.
 * 표지 문구는 화면에 보이는 글자(innerText)로만 본다. 숨은 캡차 틀이 늘 DOM 에 있어도 걸리지 않게
 */
const 칸 = {
  아이디: 'input#id, input[name="id"]',
  // type=password 만 — 글자가 보이는 칸에 치면 비번이 스크린샷에 찍힌다
  비번: 'input#pw[type="password"], input[name="pw"][type="password"]',
  유지: 'input#loginStay, input#keep, input#nvlong, input[name="nvlong"]',
  // 2026-10 화면: 로그인 버튼이 #loginBtn_row·#loginBtn_column 둘이고 화면 폭에 따라 하나만 보인다(실제 화면에서 확인)
  로그인: '#loginBtn_row:visible, #loginBtn_column:visible, [id="log.login"], button.btn_login, form#frmNIDLogin button[type="submit"]',
  캡차: "#captcha, #captchaimg, #chptcha",
};
const 표지 = [
  ["보호조치", /보호조치|보호 조치|도용이 의심|이용이 제한/],
  ["캡차", /자동입력 ?방지|자동 입력 방지|보안문자|보이는 대로 입력/],
  ["2단계", /2단계 인증|2차 인증|OTP 인증/],
  ["새기기", /새로운 기기|새 기기|새로운 환경|등록되지 않은 기기|기기 인증/],
  ["비번틀림", /비밀번호를 (잘못|정확하게)|비밀번호가 (잘못|일치하지)/],
];
const 막힘사유 = new Set(["캡차", "2단계", "새기기", "보호조치", "모르는화면"]);
const 나쁨사유 = new Set(["비번틀림", "저장값 못 읽음"]);

async function 보이나(page, sel) {
  try { return await page.locator(sel).first().isVisible(); } catch { return false; }
}
/**
 * 클릭 뒤(비번먼저)에는 비번틀림 글자를 캡차보다 먼저 본다 — 네이버는 비번이 틀리면 캡차를 같이 띄운다.
 * 그걸 캡차(blocked)로 읽으면 사람 로그인 뒤 옛 비번으로 또 친다. 비번틀림(bad)이어야 save-login 전까지 안 친다
 */
async function 표지찾기(page, { 비번먼저 = false } = {}) {
  const 글 = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  if (비번먼저 && 표지.find(([n]) => n === "비번틀림")[1].test(글)) return "비번틀림";
  if (await 보이나(page, 칸.캡차)) return "캡차";
  return 표지.find(([, re]) => re.test(글))?.[0] ?? null;
}

const KST분 = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(/[-:]/g, "").replace(" ", "-");

async function 찍기(page, dir, name) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const 파일 = path.join(dir, `${name}-${KST분()}.png`);
    await page.screenshot({ path: 파일 });
    const 옛것 = fs.readdirSync(dir).filter((f) => f.startsWith(`${name}-`) && f.endsWith(".png")).sort();
    for (const f of 옛것.slice(0, -10)) fs.rmSync(path.join(dir, f), { force: true });
    return 파일;
  } catch { return null; }
}

const 쉼 = () => 60 + Math.floor(Math.random() * 101);

/** 한 글자씩 — 키마다 60~160ms 무작위 */
async function 사람처럼(page, loc, s) {
  await loc.click();
  for (const ch of s) {
    await loc.pressSequentially(ch);
    await page.waitForTimeout(쉼());
  }
}

/**
 * 로그인 화면(nid)에 서 있는 page 에서 저장값으로 한 번 로그인한다. → { ok, 사유, 화면 }
 * 오류를 밖으로 던지지 않는다 — Playwright 오류 문구가 일감 근거로 새지 않게.
 * 대기ms 는 시험만 줄인다
 */
export async function 자동로그인(page, ctx, name, { shotsDir = path.join(비밀폴더(), "shots"), 대기ms = 30_000 } = {}) {
  상태쓰기(name, { lastAttemptAt: Date.now() });
  const 멈춤 = async (사유) => {
    const 화면 = await 찍기(page, shotsDir, name);
    상태쓰기(name, { lastResult: 사유, ...(나쁨사유.has(사유) ? { bad: true } : 막힘사유.has(사유) ? { blocked: true } : {}) });
    return { ok: false, 사유, 화면 };
  };

  // 들어가기 전 — 이미 막힌 화면이거나 칸이 없으면 아무것도 안 친다
  const 처음 = await 표지찾기(page);
  if (처음) return 멈춤(처음 === "비번틀림" ? "모르는화면" : 처음);
  const 아이디칸 = page.locator(칸.아이디).first(), 비번칸 = page.locator(칸.비번).first();
  const 유지칸 = page.locator(칸.유지).first(), 버튼 = page.locator(칸.로그인).first();
  if (!(await 보이나(page, 칸.아이디)) || !(await 보이나(page, 칸.비번)) || !(await 보이나(page, 칸.로그인))) return 멈춤("모르는화면");

  let 값;
  try { 값 = 복호화(name); } catch { return 멈춤("저장값 못 읽음"); }
  // 클릭 뒤 화면이 한 번이라도 넘어갔나 — 같은 주소로 다시 그려져도 넘어간 것이다(시간초과와 모르는화면을 가른다)
  let 바뀜 = false;
  const 넘어감 = (f) => { if (f === page.mainFrame()) 바뀜 = true; };
  try {
    let u = 값.u, p = 값.p;
    값 = null;
    await 사람처럼(page, 아이디칸, u);
    u = "";
    await 사람처럼(page, 비번칸, p);
    p = "";
    // 「로그인 상태 유지」 — 꺼져 있으면 켠다. 라벨을 누르는 게 사람 손과 같다. 그래도 안 켜지면 누르지 않고 멈춤
    if ((await 유지칸.count()) && !(await 유지칸.isChecked())) {
      const id = await 유지칸.getAttribute("id");
      const 라벨 = id ? page.locator(`label[for="${id}"]`).first() : null;
      if (라벨 && (await 라벨.isVisible().catch(() => false))) await 라벨.click();
      else await 유지칸.check({ force: true });
    }
    if (!(await 유지칸.count()) || !(await 유지칸.isChecked())) return 멈춤("모르는화면");
    await page.waitForTimeout(쉼() * 3);
    page.on("framenavigated", 넘어감);
    await 버튼.click({ noWaitAfter: true });
  } catch {
    page.off("framenavigated", 넘어감);
    return 멈춤("모르는화면");
  } finally {
    값 = null;
  }

  // 성공은 긍정형만: nid 를 떠나고 NID_AUT 가 「유지」. 표지가 뜨면 바로 멈춤
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 대기ms) {
      await page.waitForTimeout(1000);
      if (!/nid\.naver\.com/.test(page.url())) {
        if (네이버쿠키(await ctx.cookies("https://nid.naver.com").catch(() => [])) === "유지") {
          상태쓰기(name, { lastResult: "ok", blocked: false });
          return { ok: true, 사유: null, 화면: null };
        }
        continue;
      }
      const 본것 = await 표지찾기(page, { 비번먼저: true });
      if (본것) return 멈춤(본것);
    }
    return 멈춤(바뀜 || !/nid\.naver\.com/.test(page.url()) ? "모르는화면" : "시간초과");
  } catch {
    return 멈춤("모르는화면");
  } finally {
    page.off("framenavigated", 넘어감);
  }
}
