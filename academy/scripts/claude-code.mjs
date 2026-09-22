/**
 * Claude Code 를 머리 없이(-p) 부른다. 원장의 Max 구독으로 돈다 — API 크레딧이 필요 없다.
 *
 * 2026-09-22 에 OpenRouter(산 적 없음)·Anthropic API(선불 잔액 소진)가 둘 다 막혀
 * 측정과 초안이 섰다. 구독 토큰(claude setup-token → CLAUDE_CODE_OAUTH_TOKEN)으로 옮긴다.
 *
 * 알아 둘 것
 *  - 기본 시스템 프롬프트가 「코딩 도우미」라 학원 추천을 물으면 거절한다. --system-prompt 로 바꾼다
 *  - 저장소 안에서 돌리면 CLAUDE.md 를 읽어 답이 오염된다. 빈 임시 폴더에서 돌리고 MCP 도 끈다
 *  - 프롬프트는 표준입력으로 넘긴다. 윈도에서 claude 는 .cmd 껍데기라 셸을 거치는데, 한글·줄바꿈 인자가 깨진다
 *  - ANTHROPIC_API_KEY 가 환경에 있으면 CLI 가 그쪽(선불 잔액)을 먼저 쓴다. 자식에게는 빼고 넘긴다
 *  - 한도는 원장이 평소 쓰는 Claude 와 같이 쓴다. 가볍게 쓴다
 *
 *   const r = await 클로드코드("질문", { tools: ["WebSearch"] })
 *   r.ok · r.text · r.urls(검색 결과로 읽은 주소) · r.error · r.한도 · r.인증실패 · r.시간초과 · r.거절(권한에 막힌 도구 호출)
 *   r.callId (geo.claude_calls 행) · 옵션 purpose(measure·writer·audit·repair…) · taskId
 */
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 토큰이 있거나(Actions) 로컬에서 로그인한 claude 를 쓰겠다고 했을 때(CLAUDE_CODE_LOCAL=1) */
export const 클로드코드있음 = () => Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.CLAUDE_CODE_LOCAL === "1");

const 기본시스템 = "너는 한국어로 답하는 일반 도우미다. 코딩과 무관한 질문도 똑같이 성실히 답한다.";

// 구독 한도 문구는 바뀐다 — 「You've hit your limit · resets 3am」 같은 것까지 잡는다
const 한도문구 = /usage limit|limit reached|hit your limit|rate.?limit|resets\b|API Error: 429/i;
const 인증문구 = /Failed to authenticate|Invalid bearer token|API Error: 401|OAuth token/i;

// ─────────────────────────────────────────── 하루 상한 · 호출 기록
/**
 * 모든 호출자(측정·초안·분석·감사·수리)가 같은 구독 한도를 쓴다. 한 곳이 폭주하면 원장 Claude 까지 멈춘다.
 * 그래서 호출마다 geo.claude_calls 에 한 줄 남기고, 오늘(KST) 센 수가 상한을 넘으면 부르지 않는다.
 * 측정이 먼저다 — 측정 아닌 호출은 CLAUDE_MEASURE_RESERVE(기본 20) 만큼 남겨 두고 멈춘다 (Step 10, 2026-09-22)
 * 상한에 걸린 것은 「한도」로 돌려준다. 호출자들은 한도를 실패로 세지 않는다
 */
// 빈 문자열도 기본값으로 — Actions 는 설정 안 한 변수를 "" 로 넘긴다. Number("") 는 0 이라 상한 0 이 됐다(9/22 첫 dry)
const 정수 = (v, d) => { if (v === undefined || v === null || String(v).trim() === "") return d; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : d; };
let 기록q = null;
let 표준비 = null;
/** DB 를 이미 연 호출자는 자기 쿼리 함수를 준다(감사관은 부르기 전에 DATABASE_URL 을 환경에서 지운다) */
export const 클로드기록연결 = (q) => { 기록q = q; };
const 기록쿼리 = async () => {
  if (!기록q && process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const u = new URL(process.env.DATABASE_URL);
    u.searchParams.delete("sslmode");
    // allowExitOnIdle — 이 풀 때문에 부른 스크립트가 끝나지 않고 매달리면 안 된다
    const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 1, allowExitOnIdle: true });
    기록q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
  }
  if (기록q && !표준비) {
    표준비 = 기록q(`create table if not exists geo.claude_calls (id bigserial primary key, at timestamptz not null default now(),
      purpose text not null, ok boolean not null, secs int, cost_usd numeric, task_id bigint, note text not null default '')`);
  }
  if (표준비) await 표준비;
  return 기록q;
};

export async function 클로드코드(prompt, opts = {}) {
  const purpose = opts.purpose ?? "기타";
  const q = await 기록쿼리().catch((e) => { console.log(`  ⚠ claude 호출 기록 못 함: ${e.message}`); return null; });
  // capRequired — 수리·감사처럼 상한 안에서만 돌아야 하는 호출자는 셀 수 없으면 부르지 않는다(fail-closed, Richard 9/22)
  const 못셈 = { ok: false, 한도: true, 상한: true, error: "호출 수를 못 셈 — 상한을 지킬 수 없어 부르지 않음", text: "", urls: [], 거절: [] };
  if (!q && opts.capRequired) return 못셈;
  if (q) {
    const [row] = await q(`select count(*)::int n from geo.claude_calls
      where (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`).catch(() => [null]);
    if (!row && opts.capRequired) return 못셈;
    const n = row?.n ?? 0;
    const 상한 = 정수(process.env.CLAUDE_DAILY_MAX, 40);
    const 몫 = purpose === "measure" ? 상한 : 상한 - 정수(process.env.CLAUDE_MEASURE_RESERVE, 20);
    if (n >= 몫) return { ok: false, 한도: true, 상한: true, error: `하루 상한 — 오늘 ${n}회 (${purpose} 몫 ${몫})`, text: "", urls: [], 거절: [] };
  }
  const 시작 = Date.now();
  const r = await 한번부르기(prompt, opts);
  if (q) {
    const [row] = await q(`insert into geo.claude_calls (purpose, ok, secs, cost_usd, task_id, note) values ($1,$2,$3,$4,$5,$6) returning id`,
      [purpose, r.ok, Math.round((Date.now() - 시작) / 1000), r.cost ?? null, opts.taskId ?? null, String(r.error ?? "").slice(0, 300)]).catch(() => []);
    r.callId = row?.id ?? null;
  }
  return r;
}

async function 한번부르기(prompt, { system = 기본시스템, tools = [], model = "sonnet", maxTurns = 8, timeoutMs = 5 * 60 * 1000, cwd = null, envDrop = [], allow = [], deny = [] } = {}) {
  // cwd 를 주면 그 폴더에서 돈다(감사관이 저장소를 읽는다). 안 주면 빈 임시 폴더 — 지우는 것도 임시 폴더일 때만
  const dir = cwd ?? fs.mkdtempSync(path.join(os.tmpdir(), "cc-"));
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--model", model, "--max-turns", String(maxTurns),
    "--strict-mcp-config", "--system-prompt", system];
  // --allowedTools 는 허락만 한다. 다른 도구가 보이면 검색 결과 속 글에 끌려 Read 같은 걸 부를 수 있다 — 보이는 도구 자체를 좁힌다
  // allow 를 주면 도구 이름 대신 경로를 좁힌 규칙(예: Read(./**))으로 허락한다. 이름만 주면 모든 경로가 허락된다
  if (tools.length) args.push("--tools", tools.join(","), "--allowedTools", (allow.length ? allow : tools).join(","));
  else args.push("--tools", "");
  // 경로를 좁혀 허락했으면 나머지는 묻지 않고 거절한다 — -p 에는 물어볼 사람이 없다
  if (allow.length) args.push("--permission-mode", "dontAsk");
  if (deny.length) args.push("--disallowedTools", deny.join(","));

  // 선불 API 키가 섞이면 구독 대신 그쪽으로 청구된다
  const env = { ...process.env };
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", ...envDrop]) delete env[k];

  return new Promise((resolve) => {
    const win = process.platform === "win32";
    // 윈도 셸로 넘길 때는 인자를 따옴표로 싸야 공백 든 시스템 프롬프트가 안 쪼개진다
    const child = spawn("claude", win ? args.map((a) => (/[\s",]/.test(a) || a === "" ? `"${a.replace(/"/g, '\\"')}"` : a)) : args,
      { cwd: dir, shell: win, env });
    // 조각마다 따로 글자로 바꾸면 3바이트 한글이 경계에서 쪼개져 깨진다
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let out = "", err = "", 끝남 = false;
    const 끝내기 = (r) => {
      if (끝남) return;
      끝남 = true;
      if (!cwd) try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      resolve(r);
    };
    const 죽이기 = () => {
      // 윈도에서 shell:true 면 kill() 은 cmd.exe 만 죽이고 claude 는 남아 한도를 먹는다
      if (win) execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
      else { child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 5000).unref(); }
    };
    const timer = setTimeout(() => {
      죽이기();
      끝내기({ ok: false, 시간초과: true, error: `시간 초과 ${timeoutMs / 1000}초`, text: "", urls: [] });
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); 끝내기({ ok: false, error: `claude 실행 실패: ${e.message}`, text: "", urls: [] }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const urls = new Map();
      let result = null;
      for (const line of out.split("\n")) {
        let m;
        try { m = JSON.parse(line); } catch { continue; }
        if (m.type === "user") {
          for (const c of m.message?.content ?? []) {
            if (c.type !== "tool_result") continue;
            const t = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
            // WebSearch 결과는 「Links: [{"title":…,"url":…}]」 모양으로 온다
            for (const x of t.matchAll(/"title":"((?:[^"\\]|\\.)*)","url":"([^"]+)"/g)) urls.set(x[2], { title: x[1], url: x[2] });
          }
        }
        if (m.type === "result") result = m;
      }
      const text = result?.result ?? "";
      // stderr 는 실패했을 때만 본다. 성공한 실행의 경고(토큰 만료 예고 등)로 멀쩡한 답을 실패로 뒤집으면 안 된다
      const 실패함 = !result || result.is_error;
      const 짧은글 = `${text.length < 400 ? text : ""}\n${실패함 ? err.slice(-600) : ""}`;
      const 인증실패 = 인증문구.test(짧은글);
      const 한도 = !인증실패 && 한도문구.test(짧은글) && (실패함 || text.length < 400);
      if (!result) {
        // 결과 없이 끝난 건 시간 초과가 아니다(CLI 고장·플래그 거절·설치 문제). 500 으로 가야 고장 일감이 선다 —
        // 503(시간 초과)으로 두면 초안 쪽이 「돈·한도」로 보고 매주 조용히 건너뛴다
        return 끝내기({ ok: false, 한도, 인증실패, error: `결과 없음 (종료 ${code}) ${err.slice(-300)}`, text: "", urls: [...urls.values()] });
      }
      const ok = !result.is_error && result.subtype === "success" && !한도 && !인증실패;
      끝내기({
        ok,
        한도,
        인증실패,
        text,
        urls: [...urls.values()],
        // error_max_turns 처럼 is_error 는 아닌데 실패인 경우도 이유를 남긴다
        error: ok ? null : (text.slice(0, 300) || result.subtype || "알 수 없음"),
        cost: result.total_cost_usd ?? null,
        // 권한 규칙에 막힌 도구 호출(CLI 가 직접 센 것). 칸막이 시험의 증거다
        거절: result.permission_denials ?? [],
      });
    });
    // claude 가 입력을 다 읽기 전에 죽으면(인증·설치·시간 초과) EPIPE 가 나고, 안 받으면 부른 프로세스까지 죽는다
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}
