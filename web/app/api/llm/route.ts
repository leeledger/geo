/**
 * OpenRouter 중계. 키는 Vercel 에만 둔다.
 *
 * 원장이 OPENROUTER_API_KEY 를 Vercel 에 「Sensitive」로 넣었다. 그러면 env pull 로도 값을 못 꺼내
 * GitHub Actions 로 옮길 수 없다. 키를 여기저기 복사하는 대신 Actions 가 이 주소를 부른다.
 *
 * 부르는 곳: academy/scripts/ai-measure.mjs (매일 측정), writer-common.mjs (초안)
 * 인증: Authorization: Bearer <LLM_PROXY_TOKEN>  — Vercel(geo)·GitHub Secrets 에 같은 값
 */
import crypto from "node:crypto";
import { inqPool } from "@/lib/inquiries";

export const runtime = "nodejs";
export const maxDuration = 300; // 초안은 생각 토큰까지 합쳐 1~3분 걸린다

const 같나 = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export async function POST(req: Request) {
  const token = process.env.LLM_PROXY_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !같나(got, token)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: { code: 503, message: "OPENROUTER_API_KEY 가 이 배포에 없습니다. 넣은 뒤 재배포해야 읽힙니다." } }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: "json" }, { status: 400 }); }
  /**
   * 토큰이 새도 비싼 모델로 크레딧을 태우지 못하게 목록에 있는 모델만 중계한다.
   * stealth/union-alpha 는 2026-09-18 에 닫혔다(응답이 후속 모델 unbiased/pareto 를 알려 줬다).
   * 값은 LLM_PROXY_MODELS 로 바꾼다 (쉼표 구분). 출력 상한도 같이 건다.
   */
  const allow = (process.env.LLM_PROXY_MODELS ?? "anthropic/claude-opus-5,anthropic/claude-sonnet-5,google/gemini-2.5-flash,qwen/qwen3.7-flash,openai/gpt-5-mini")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (typeof body.model !== "string" || !(allow.includes(body.model) || /:free$/.test(body.model))) {
    return Response.json({ error: { code: 400, message: `중계하지 않는 모델입니다: ${body.model}. 허용: ${allow.join(", ")} 또는 :free` } }, { status: 400 });
  }
  body.max_tokens = Math.min(Number(body.max_tokens) || 12000, 16000);

  /**
   * 하루 호출 상한. 토큰이 새면 남이 우리 크레딧을 태울 수 있는데, 그걸 알아채는 건 청구서를 볼 때다.
   * 정상 사용은 하루 20문항 측정 + 초안 몇 건이라 120 이면 넉넉하다. LLM_PROXY_DAILY_MAX 로 바꾼다.
   */
  const max = Number(process.env.LLM_PROXY_DAILY_MAX ?? 120);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  try {
    const db = inqPool();
    await db.query(`create table if not exists geo.llm_usage (day date primary key, calls int not null default 0)`);
    const { rows } = await db.query(
      `insert into geo.llm_usage (day, calls) values ($1, 1)
       on conflict (day) do update set calls = geo.llm_usage.calls + 1 returning calls`, [day]);
    if (rows[0].calls > max) {
      return Response.json({ error: { code: 429, message: `오늘 중계 한도 ${max}건을 넘었습니다. 예상보다 많이 불렸다면 토큰이 샜을 수 있습니다 — Vercel 에서 LLM_PROXY_TOKEN 을 바꾸고 tools/set-llm-proxy.mjs 를 다시 돌리세요.` } }, { status: 429 });
    }
  } catch (e) {
    // 상한을 못 세는 것이 글쓰기를 막을 이유는 아니다. 다만 조용히 넘어가지는 않는다
    console.error("llm 사용량 기록 실패", e);
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-title": "cited" },
    body: JSON.stringify(body),
  });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
}
