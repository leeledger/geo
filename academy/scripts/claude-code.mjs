/**
 * Claude Code 를 머리 없이(-p) 부른다. 원장의 Max 구독으로 돈다 — API 크레딧이 필요 없다.
 *
 * 2026-09-22 에 OpenRouter(산 적 없음)·Anthropic API(선불 잔액 소진)가 둘 다 막혀
 * 측정과 초안이 섰다. 구독 토큰(claude setup-token → CLAUDE_CODE_OAUTH_TOKEN)으로 옮긴다.
 *
 * 알아 둘 것
 *  - 기본 시스템 프롬프트가 「코딩 도우미」라 학원 추천을 물으면 거절한다. --system-prompt 로 바꾼다
 *  - 저장소 안에서 돌리면 CLAUDE.md 를 읽어 답이 오염된다. 빈 임시 폴더에서 돌린다
 *  - 프롬프트는 표준입력으로 넘긴다. 윈도에서 claude 는 .cmd 껍데기라 셸을 거치는데, 한글·줄바꿈 인자가 깨진다
 *  - 한도는 원장이 평소 쓰는 Claude 와 같이 쓴다. 가볍게 쓴다
 *
 *   const r = await 클로드코드("질문", { tools: ["WebSearch"] })
 *   r.ok · r.text · r.urls(검색 결과로 읽은 주소) · r.error
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 토큰이 있거나(Actions) 로컬에서 로그인한 claude 를 쓰겠다고 했을 때(CLAUDE_CODE_LOCAL=1) */
export const 클로드코드있음 = () => Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.CLAUDE_CODE_LOCAL === "1");

const 기본시스템 = "너는 한국어로 답하는 일반 도우미다. 코딩과 무관한 질문도 똑같이 성실히 답한다.";

export async function 클로드코드(prompt, { system = 기본시스템, tools = [], model = "sonnet", maxTurns = 8, timeoutMs = 10 * 60 * 1000 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-"));
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--model", model, "--max-turns", String(maxTurns),
    "--system-prompt", system];
  if (tools.length) args.push("--allowedTools", tools.join(","));
  else args.push("--tools", "");

  return new Promise((resolve) => {
    const win = process.platform === "win32";
    // 윈도 셸로 넘길 때는 인자를 따옴표로 싸야 공백 든 시스템 프롬프트가 안 쪼개진다
    const child = spawn("claude", win ? args.map((a) => (/[\s"]/.test(a) || a === "" ? `"${a.replace(/"/g, '\\"')}"` : a)) : args,
      { cwd: dir, shell: win, env: process.env });
    let out = "", err = "";
    const 끝내기 = (r) => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} resolve(r); };
    const timer = setTimeout(() => { child.kill(); 끝내기({ ok: false, error: `시간 초과 ${timeoutMs / 1000}초`, text: "", urls: [] }); }, timeoutMs);
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
      if (!result) return 끝내기({ ok: false, error: `결과 없음 (종료 ${code}) ${err.slice(-300)}`, text: "", urls: [...urls.values()] });
      const text = result.result ?? "";
      // 구독 한도에 걸리면 성공처럼 끝나고 본문에 한도 안내가 온다
      const 한도 = /usage limit|limit reached|rate limit|resets at/i.test(text) && text.length < 400;
      // 토큰이 틀리면 매 호출이 똑같이 401 이다. 부르는 쪽이 한 번에 멈추게 따로 알린다(2026-09-22, 20문항을 다 두드렸다)
      const 인증실패 = /Failed to authenticate|Invalid bearer token|401/i.test(text) && text.length < 400;
      끝내기({
        ok: !result.is_error && result.subtype === "success" && !한도 && !인증실패,
        한도,
        인증실패,
        text,
        urls: [...urls.values()],
        error: result.is_error || 한도 || 인증실패 ? text.slice(0, 300) || result.subtype : null,
        cost: result.total_cost_usd ?? null,
      });
    });
    child.stdin.end(prompt);
  });
}
