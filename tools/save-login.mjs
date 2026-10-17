/**
 * 네이버 블로그(학원) 로그인 값을 이 PC 에 한 번 저장하고, 그 값으로 자동 로그인이 되는지 바로 확인한다 — Step 52 (D176·D184).
 *
 *   node tools/save-login.mjs naver
 *
 * 윈도 창(Get-Credential)에 원장이 아이디·비번을 친다. PowerShell 이 tools/.secrets/naver.xml 로 바로 쓴다(DPAPI, 이 윈도 계정만 풀 수 있음).
 * Node 는 비번을 안 본다. 그다음 학원 프로필을 로그아웃하고 같은 자동 로그인 함수로 들어가 본다 — 원장이 보고 있을 때만 하는 시험이다.
 * 막히면 창을 5분 둔다. 손으로 마저 로그인하면 된다(주소만 본다).
 * 로컬 에이전트·로그인 창이 브라우저를 쓰는 중이면 30초씩 최대 15분 기다린다. 남의 프로세스는 안 죽인다.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { POWERSHELL, 비밀폴더, 상태쓰기, 프로필열기, 자동로그인 } from "./auto-login.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (name !== "naver") {
  console.log("사용: node tools/save-login.mjs naver");
  process.exit(1);
}

const LA_LOCK = path.join(HERE, ".local-agent.lock");
const OS_LOCK = path.join(HERE, ".open-session.lock");
const 신선 = (f, ms) => { try { return Date.now() - fs.statSync(f).mtimeMs < ms; } catch { return false; } };
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 잠금: login-poll 과 같은 꼴. 창 잠금을 먼저 잡고 로컬 에이전트 잠금을 본다(로컬 에이전트는 반대 순서)
let 잡음 = false;
const 잠금풀기 = () => {
  if (!잡음) return;
  잡음 = false;
  try { if (fs.readFileSync(OS_LOCK, "utf8") === String(process.pid)) fs.rmSync(OS_LOCK, { force: true }); } catch {}
};
process.on("exit", 잠금풀기);
process.on("SIGINT", () => { 잠금풀기(); process.exit(130); });

const t0 = Date.now();
let 알림 = false;
while (!잡음) {
  if (!신선(LA_LOCK, 2 * 3600 * 1000) && !신선(OS_LOCK, 13 * 60000)) {
    fs.rmSync(OS_LOCK, { force: true }); // 13분 넘은 창 잠금은 죽은 창의 흔적
    try { fs.writeFileSync(OS_LOCK, String(process.pid), { flag: "wx" }); 잡음 = true; } catch {}
    if (잡음 && 신선(LA_LOCK, 2 * 3600 * 1000)) 잠금풀기();
    if (잡음) break;
  }
  if (Date.now() - t0 >= 15 * 60000) { console.log("15분 기다려도 브라우저가 비지 않았습니다 — 나중에 다시 돌려 주세요."); process.exit(3); }
  if (!알림) { console.log("로컬 에이전트가 브라우저를 쓰는 중 — 기다립니다"); 알림 = true; }
  await 쉬기(30_000);
}

// ── 저장: 비번은 PowerShell 프로세스 안에만 있다
const 폴더 = 비밀폴더();
const 따옴 = (s) => `'${s.replace(/'/g, "''")}'`;
const 스크립트 = [
  "$ErrorActionPreference = 'Stop'",
  "try { $c = Get-Credential -Message '네이버 블로그(학원) 아이디와 비밀번호' } catch { exit 2 }",
  "if (-not $c -or -not $c.GetNetworkCredential().Password) { exit 2 }",
  `New-Item -ItemType Directory -Force -Path ${따옴(폴더)} | Out-Null`,
  `$c | Export-Clixml -LiteralPath ${따옴(path.join(폴더, `${name}.xml`))}`,
].join("; ");
const 저장 = spawnSync(POWERSHELL, ["-NoProfile", "-Command", 스크립트], { stdio: "inherit" });
if (저장.status === 2) { console.log("취소했습니다"); process.exit(1); }
if (저장.status !== 0) { console.log("저장하지 못했습니다(PowerShell 오류)"); process.exit(1); }
상태쓰기(name, { lastAttemptAt: null, lastResult: "saved", blocked: false, bad: false });
console.log("저장했습니다 — 자동 로그인을 시험합니다(학원 프로필을 로그아웃했다 다시 들어갑니다)");

// ── 시험 로그인: naver-blog-post 와 같은 프로필·같은 실행 옵션
const BLOG_ID = process.env.NAVER_BLOG_ID ?? "force11";
let 코드 = 1;
let ctx;
try {
  ctx = await 프로필열기(path.join(HERE, ".browser-profile"), {
    headless: false,
    viewport: { width: 1440, height: 940 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://nid.naver.com/nidlogin.logout", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000);
  const r = /nid\.naver\.com/.test(page.url())
    ? await 자동로그인(page, ctx, name)
    : { ok: false, 사유: "로그아웃이 안 돼 로그인 화면이 안 뜸", 화면: null };
  if (r.ok) {
    console.log("✓ 저장했고 자동 로그인도 됐습니다");
    코드 = 0;
  } else {
    console.log(`✗ 자동 로그인 멈춤: ${r.사유}${r.화면 ? ` · 화면 ${r.화면}` : ""}`);
    console.log("창을 5분 둡니다. 손으로 로그인을 마쳐 주세요");
    const t1 = Date.now();
    while (Date.now() - t1 < 5 * 60000 && /nid\.naver\.com/.test(page.url())) await page.waitForTimeout(2500);
    if (!/nid\.naver\.com/.test(page.url())) console.log("로그인 화면을 벗어났습니다 — 다음 이관 때 세션을 확인합니다");
  }
  await page.waitForTimeout(5000);
} catch {
  console.log("브라우저를 열거나 다루지 못했습니다 — 저장값은 남아 있습니다. 다음 이관 때 자동 로그인을 시도합니다");
} finally {
  await ctx?.close().catch(() => {}); // 쿠키를 디스크에 쓰려면 닫아야 한다
  잠금풀기();
}
process.exit(코드);
