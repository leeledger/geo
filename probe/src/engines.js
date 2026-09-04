/**
 * 엔진 어댑터.
 *
 * 계약: 모든 어댑터는 async (promptText, opts) => EngineResult 를 만족한다.
 *
 *   EngineResult = {
 *     engine:      string,        // 엔진 식별자
 *     model:       string,        // 실제 사용된 모델
 *     text:        string,        // 사용자에게 보이는 최종 답변 원문
 *     citations:   [{ url, title, domain }],
 *     grounded:    boolean,       // 실시간 검색이 실제로 수행되었는가
 *     search_queries: string[],   // 엔진이 내부적으로 던진 검색 쿼리 (fan-out 관측)
 *     stop_reason: string|null,
 *     usage:       object,
 *     raw:         object         // 원본 응답 전체 (재현·재계산용, 반드시 보관)
 *   }
 *
 * search_queries 는 이 실험에서 특히 중요하다. "사용자 질문 1개 → 검색 쿼리 N개"
 * 라는 fan-out 이 실제로 일어나는지, 그리고 그 쿼리가 무엇인지가
 * GEO 가 SEO 와 다른 게임인지 판별하는 직접 증거다.
 */

const UA = "ago-geo-probe/0.1";

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function uniqBy(arr, key) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = key(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ────────────────────────── Anthropic (검증됨) ────────────────────────── */

/**
 * 실시간 웹 검색을 붙인 Claude. 소비자가 실제로 쓰는 "그라운딩된 어시스턴트"와
 * 같은 조건을 만들기 위해 web_search 서버 툴을 켠다. 이걸 끄면 학습된 지식(경로 1)만
 * 측정하게 되어 실험의 의미가 사라진다.
 *
 * 주의 — 이 어댑터에는 의도적으로 server-side fallbacks 를 켜지 않았다.
 * 거부(refusal) 시 다른 모델로 자동 대체되면 "어느 모델의 답변인지"가 섞여
 * 측정값이 오염된다. 거부는 대체하지 않고 stop_reason 으로 기록만 한다.
 */
export async function anthropic(promptText, opts = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다");

  const model = opts.model || process.env.ANTHROPIC_MODEL || "claude-opus-5";

  const body = {
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: promptText }],
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 6,
        user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
      },
    ],
  };
  if (opts.effort) body.output_config = { effort: opts.effort };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "user-agent": UA,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
  });

  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`anthropic ${res.status}: ${detail.slice(0, 400)}`);
    err.status = res.status;
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }

  const json = await res.json();

  let text = "";
  const citations = [];
  const searchQueries = [];
  let grounded = false;

  for (const block of json.content ?? []) {
    if (block.type === "text") {
      text += block.text;
      // 인용은 text 블록에도 붙는다 (web_search_result_location)
      for (const c of block.citations ?? []) {
        if (c.url) citations.push({ url: c.url, title: c.title ?? null, domain: domainOf(c.url) });
      }
    } else if (block.type === "server_tool_use" && block.name === "web_search") {
      grounded = true;
      if (block.input?.query) searchQueries.push(block.input.query);
    } else if (block.type === "web_search_tool_result") {
      // 성공하면 content 는 배열, 실패하면 에러 객체 하나. 반드시 분기해야 한다.
      const c = block.content;
      if (Array.isArray(c)) {
        for (const r of c) {
          if (r.url) citations.push({ url: r.url, title: r.title ?? null, domain: domainOf(r.url) });
        }
      }
    }
  }

  return {
    engine: "anthropic",
    model,
    text,
    citations: uniqBy(citations, (c) => c.url),
    grounded,
    search_queries: searchQueries,
    stop_reason: json.stop_reason ?? null,
    stop_details: json.stop_details ?? null,
    usage: json.usage ?? null,
    raw: json,
  };
}

/* ─────────────────── 미검증 어댑터 (키 확보 후 실행하며 교정) ─────────────────── */
/*
 * 아래 세 어댑터는 해당 제공자의 키가 없어 한 번도 실행해보지 못했다.
 * 요청/응답 형태가 실제와 다를 수 있으므로, 키를 넣은 뒤
 *   node src/run.js --engine openai --limit 1
 * 로 한 건만 먼저 돌려 응답 구조를 확인하고 파서를 고칠 것.
 * 파싱이 틀리면 "언급 0건"으로 조용히 기록되어 결과 전체를 왜곡한다.
 */

/** UNVERIFIED — OpenAI Responses API + web_search 툴 가정 */
export async function openai(promptText, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다");
  const model = opts.model || process.env.OPENAI_MODEL || "gpt-5";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "user-agent": UA },
    body: JSON.stringify({
      model,
      input: promptText,
      tools: [{ type: "web_search" }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
  });
  if (!res.ok) {
    const d = await res.text();
    const e = new Error(`openai ${res.status}: ${d.slice(0, 400)}`);
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }
  const json = await res.json();

  let text = json.output_text ?? "";
  const citations = [];
  const searchQueries = [];
  let grounded = false;

  for (const item of json.output ?? []) {
    if (item.type === "web_search_call") {
      grounded = true;
      const q = item.action?.query ?? item.query;
      if (q) searchQueries.push(q);
    }
    for (const part of item.content ?? []) {
      if (!text && part.type === "output_text") text += part.text ?? "";
      for (const a of part.annotations ?? []) {
        if (a.url) citations.push({ url: a.url, title: a.title ?? null, domain: domainOf(a.url) });
      }
    }
  }

  return {
    engine: "openai", model, text,
    citations: uniqBy(citations, (c) => c.url),
    grounded, search_queries: searchQueries,
    stop_reason: json.status ?? null, usage: json.usage ?? null, raw: json,
  };
}

/** UNVERIFIED — Google Gemini generateContent + google_search 그라운딩 가정 */
export async function gemini(promptText, opts = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 가 설정되지 않았습니다");
  const model = opts.model || process.env.GEMINI_MODEL || "gemini-2.5-pro";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey, "user-agent": UA },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
    }
  );
  if (!res.ok) {
    const d = await res.text();
    const e = new Error(`gemini ${res.status}: ${d.slice(0, 400)}`);
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }
  const json = await res.json();

  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const gm = cand?.groundingMetadata ?? {};
  const citations = (gm.groundingChunks ?? [])
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ url: w.uri, title: w.title ?? null, domain: domainOf(w.uri) }));

  return {
    engine: "gemini", model, text,
    citations: uniqBy(citations, (c) => c.url),
    grounded: citations.length > 0 || Boolean(gm.webSearchQueries),
    search_queries: gm.webSearchQueries ?? [],
    stop_reason: cand?.finishReason ?? null, usage: json.usageMetadata ?? null, raw: json,
  };
}

/** UNVERIFIED — Perplexity chat/completions 가정 */
export async function perplexity(promptText, opts = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY 가 설정되지 않았습니다");
  const model = opts.model || process.env.PERPLEXITY_MODEL || "sonar-pro";

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "user-agent": UA },
    body: JSON.stringify({ model, messages: [{ role: "user", content: promptText }] }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
  });
  if (!res.ok) {
    const d = await res.text();
    const e = new Error(`perplexity ${res.status}: ${d.slice(0, 400)}`);
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }
  const json = await res.json();

  const text = json.choices?.[0]?.message?.content ?? "";
  const urls = json.citations ?? json.search_results?.map((s) => s.url) ?? [];
  const citations = urls.filter(Boolean).map((u) => ({
    url: typeof u === "string" ? u : u.url,
    title: typeof u === "string" ? null : (u.title ?? null),
    domain: domainOf(typeof u === "string" ? u : u.url),
  }));

  return {
    engine: "perplexity", model, text,
    citations: uniqBy(citations, (c) => c.url),
    grounded: citations.length > 0, search_queries: [],
    stop_reason: json.choices?.[0]?.finish_reason ?? null, usage: json.usage ?? null, raw: json,
  };
}

export const ENGINES = { anthropic, openai, gemini, perplexity };
export const VERIFIED = new Set(["anthropic"]);
