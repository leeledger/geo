/**
 * 로그인 값을 이 PC 에 저장하고, 그 값으로 자동 로그인이 되는지 바로 확인한다 — Step 52 (D176·D184) · Step 53 계정마다 (D193·D196·D198).
 *
 *   node tools/save-login.mjs naver              학원 네이버(.browser-profile)
 *   node tools/save-login.mjs naver-<slug>       고객 네이버(.browser-profile-<slug> 폴더가 있어야)
 *   node tools/save-login.mjs microsoft          빙 웹마스터 마이크로소프트 계정(.browser-profile)
 *   node tools/save-login.mjs --all              위 전부를 한 번에 — 입력을 먼저 다 받고, 저장한 것만 차례로 시험, 끝에 요약 표
 *
 * 윈도 창(Get-Credential)에 원장이 아이디·비번을 친다. PowerShell 이 tools/.secrets/<계정>.xml 로 바로 쓴다(DPAPI, 이 윈도 계정만 풀 수 있음).
 * Node 는 비번을 안 본다. 창에서 취소하면 그 계정은 건너뛴다(있던 파일 그대로).
 * 시험: 그 계정의 프로필을 로그아웃하고 로그인 화면에서 같은 자동 로그인 함수로 들어가 본다 — 원장이 보고 있을 때만 하는 시험이다.
 * 막히면 창을 5분 둔다. 손으로 마저 로그인하면 된다(주소만 본다).
 * 로컬 에이전트·로그인 창이 브라우저를 쓰는 중이면 30초씩 최대 15분 기다린다. 창 잠금은 끝까지 쥐고 60초마다 갱신한다. 남의 프로세스는 안 죽인다.
 * 구글·카카오 등은 대상이 아니다 — open-session.mjs 로 사람이 로그인.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { POWERSHELL, 비밀폴더, 상태쓰기, 프로필열기, 자동로그인, 마소자동로그인, 마소로그인화면, 계정이름, 마소계정이름, 저장아이디 } from "./auto-login.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const 고객꼴 = /^naver-([a-z0-9-]{1,40})$/;
const 사용법 = "사용: node tools/save-login.mjs naver | naver-<slug> | microsoft | --all";

/** 계정 → 프로필 폴더. 한 방향 표 하나뿐 — 계정과 프로필이 어긋난 조합을 만들 길이 없게(D189) */
export function 프로필경로(계정, dir = HERE) {
  const 경로 = 계정 === "naver" || 계정 === "microsoft" ? path.join(dir, ".browser-profile")
    : 고객꼴.test(계정) ? path.join(dir, `.browser-profile-${고객꼴.exec(계정)[1]}`) : null;
  // 되짚기: 그 프로필이 다시 같은 계정으로 읽혀야 한다
  const 되짚음 = 계정 === "microsoft" ? 마소계정이름(경로) : 계정이름(경로);
  return 경로 && 되짚음 === 계정 ? 경로 : null;
}

/** --all 목록: naver · 디스크의 .browser-profile-<slug> 전부(이름순) · microsoft */
export function 계정목록(dir = HERE) {
  let 고객 = [];
  try {
    고객 = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && 계정이름(path.join(dir, d.name))?.startsWith("naver-"))
      .map((d) => 계정이름(path.join(dir, d.name)))
      .sort();
  } catch {}
  return ["naver", ...고객, "microsoft"];
}

/** 인자 → { 계정들 } | { 오류 }. PowerShell·브라우저를 부르기 전에 끝난다 */
export function 인자판정(arg, dir = HERE) {
  if (arg === "--all") return { 계정들: 계정목록(dir) };
  if (arg === "naver" || arg === "microsoft") return { 계정들: [arg] };
  if (typeof arg === "string" && arg.startsWith("naver-")) {
    const 경로 = 프로필경로(arg, dir);
    let 있음 = false;
    try { 있음 = Boolean(경로) && fs.statSync(경로).isDirectory(); } catch {}
    return 있음 ? { 계정들: [arg] } : { 오류: `${사용법}\n「${String(arg).slice(0, 60)}」 — 그런 고객 프로필(tools/.browser-profile-<slug>)이 없습니다` };
  }
  if (!arg) return { 오류: 사용법 };
  return { 오류: `자동 로그인 대상이 아닙니다 — node tools/open-session.mjs 로 사람이 로그인\n${사용법}` };
}

/** 윈도 창 제목 — 어느 계정 칸인지 원장이 헷갈리지 않게 */
export function 창문구(계정) {
  if (계정 === "naver") return "네이버 — 학원 블로그 계정";
  if (계정 === "microsoft") return "마이크로소프트 — 빙 웹마스터 계정(이메일)";
  const m = 고객꼴.exec(계정);
  return m ? `네이버 — ${m[1]} 고객 블로그 계정(학원 계정 아님)` : null;
}

const 실행옵션 = {
  headless: false,
  viewport: { width: 1440, height: 940 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
  args: ["--disable-blink-features=AutomationControlled"],
};

async function main() {
  const 판정 = 인자판정(process.argv[2]);
  if (판정.오류) { console.log(판정.오류); process.exit(1); }
  const 전부 = process.argv[2] === "--all";

  const LA_LOCK = path.join(HERE, ".local-agent.lock");
  const OS_LOCK = path.join(HERE, ".open-session.lock");
  const 신선 = (f, ms) => { try { return Date.now() - fs.statSync(f).mtimeMs < ms; } catch { return false; } };
  const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── 잠금: login-poll 과 같은 꼴. 창 잠금을 먼저 잡고 로컬 에이전트 잠금을 본다(로컬 에이전트는 반대 순서)
  let 잡음 = false;
  const 내잠금 = () => { try { return fs.readFileSync(OS_LOCK, "utf8") === String(process.pid); } catch { return false; } };
  const 잠금풀기 = () => {
    if (!잡음) return;
    잡음 = false;
    if (내잠금()) fs.rmSync(OS_LOCK, { force: true });
  };
  /** 쥔 잠금이 13분 지나 죽은 것으로 읽히지 않게 mtime 을 지금으로(D196) */
  const 잠금갱신 = () => { if (잡음 && 내잠금()) { const t = new Date(); try { fs.utimesSync(OS_LOCK, t, t); } catch {} } };
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
  const 갱신타이머 = setInterval(잠금갱신, 60_000);

  // ── [1] 저장: 비번은 PowerShell 프로세스 안에만 있다. 취소 = 건너뜀(있던 파일 그대로)
  const 폴더 = 비밀폴더();
  const 따옴 = (s) => `'${s.replace(/'/g, "''")}'`;
  const 입력 = (계정) => new Promise((resolve) => {
    const 스크립트 = [
      "$ErrorActionPreference = 'Stop'",
      `try { $c = Get-Credential -Message ${따옴(창문구(계정))} } catch { exit 2 }`,
      "if (-not $c -or -not $c.GetNetworkCredential().Password) { exit 2 }",
      `New-Item -ItemType Directory -Force -Path ${따옴(폴더)} | Out-Null`,
      `$c | Export-Clixml -LiteralPath ${따옴(path.join(폴더, `${계정}.xml`))}`,
    ].join("; ");
    const p = spawn(POWERSHELL, ["-NoProfile", "-Command", 스크립트], { stdio: "inherit" });
    p.on("error", () => resolve(1));
    p.on("exit", (code) => resolve(code ?? 1));
  });

  const 결과 = [];
  for (const 계정 of 판정.계정들) {
    잠금갱신();
    if (전부) console.log(`\n[${계정}] ${창문구(계정)} — 창에 입력하거나 취소(건너뜀)`);
    const 코드 = await 입력(계정);
    if (코드 === 0) {
      상태쓰기(계정, { lastAttemptAt: null, lastResult: "saved", blocked: false, bad: false });
      결과.push({ 계정, 저장: "저장", 시험: null });
    } else {
      console.log(코드 === 2 ? `${계정}: 취소 — 건너뜁니다` : `${계정}: 저장하지 못했습니다(PowerShell 오류)`);
      결과.push({ 계정, 저장: 코드 === 2 ? "건너뜀" : "저장 못 함", 시험: null });
    }
  }

  // ── [2] 시험 로그인: 이번에 저장한 계정만 차례로. 그 계정의 프로필·운영과 같은 실행 옵션
  for (const r of 결과.filter((x) => x.저장 === "저장")) {
    잠금갱신();
    const 마소 = r.계정 === "microsoft";
    console.log(`\n${r.계정}: 저장했습니다 — 자동 로그인을 시험합니다(프로필을 로그아웃했다 다시 들어갑니다)`);
    let ctx;
    try {
      ctx = await 프로필열기(프로필경로(r.계정), 실행옵션);
      const page = ctx.pages()[0] ?? (await ctx.newPage());
      const 로그인화면 = 마소 ? () => 마소로그인화면(page.url()) : () => /nid\.naver\.com/.test(page.url());
      await page.goto(마소 ? "https://login.live.com/logout.srf" : "https://nid.naver.com/nidlogin.logout", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      await page.goto(마소 ? "https://login.live.com/login.srf" : "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2F",
        { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
      const t = 로그인화면()
        ? await (마소 ? 마소자동로그인(page, ctx, r.계정) : 자동로그인(page, ctx, r.계정))
        : { ok: false, 사유: "로그아웃이 안 돼 로그인 화면이 안 뜸", 화면: null };
      if (t.ok) {
        console.log(`✓ ${r.계정}: 자동 로그인 됐습니다`);
        r.시험 = "성공";
      } else {
        r.시험 = `멈춤: ${t.사유}`;
        console.log(`✗ ${r.계정}: 자동 로그인 멈춤: ${t.사유}${t.화면 ? ` · 화면 ${t.화면}` : ""}`);
        console.log("창을 5분 둡니다. 손으로 로그인을 마쳐 주세요");
        const t1 = Date.now();
        while (Date.now() - t1 < 5 * 60000 && 로그인화면()) await page.waitForTimeout(2500);
        if (!로그인화면()) console.log("로그인 화면을 벗어났습니다 — 다음 실행 때 세션을 확인합니다");
      }
      await page.waitForTimeout(5000);
    } catch {
      r.시험 = "멈춤: 브라우저를 열거나 다루지 못함";
      console.log(`${r.계정}: 브라우저를 열거나 다루지 못했습니다 — 저장값은 남아 있습니다. 다음 실행 때 자동 로그인을 시도합니다`);
    } finally {
      await ctx?.close().catch(() => {}); // 쿠키를 디스크에 쓰려면 닫아야 한다
    }
  }
  clearInterval(갱신타이머);
  잠금풀기();

  // ── [3] 요약 표 — 저장 아이디로 계정 뒤바뀜을 눈으로 본다(D193)
  console.log("\n계정 · 저장 아이디 · 저장 · 시험");
  for (const r of 결과) console.log(`${r.계정} · ${저장아이디(r.계정) ?? "(없음)"} · ${r.저장} · ${r.시험 ?? "-"}`);
  const 시험함 = 결과.filter((x) => x.시험 !== null);
  process.exit(시험함.length && 시험함.every((x) => x.시험 === "성공") ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
