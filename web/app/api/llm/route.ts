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
  // 토큰이 새도 비싼 모델로 크레딧을 태우지 못하게 무료 모델만, 출력 상한을 둔다
  if (typeof body.model !== "string" || !(/^stealth\//.test(body.model) || /:free$/.test(body.model))) {
    return Response.json({ error: { code: 400, message: "무료 모델만 중계합니다" } }, { status: 400 });
  }
  body.max_tokens = Math.min(Number(body.max_tokens) || 12000, 16000);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-title": "cited" },
    body: JSON.stringify(body),
  });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
}
