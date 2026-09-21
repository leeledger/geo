/**
 * 글쓰는 스크립트들이 같이 쓰는 것. 두 벌이 되면 갈라진다.
 *
 * 오늘 실제로 그랬다 — write-draft 의 프롬프트를 「숫자를 쓰지 마라」로 바꿨는데
 * fact-check 만 「43·659 는 써도 된다」로 남아 있었다. 되살아나도 통과시켰을 것이다.
 *
 * 여기 두는 것은 선언적인 것뿐이다. 검사 로직은 글의 종류마다 달라서 각자 갖는다 —
 * 관점 글은 숫자를 쓰면 안 되고, 뉴스 글은 출처만 있으면 써야 한다.
 */

/**
 * OpenRouter 로 가는 길. 키가 Vercel 에 Sensitive 로만 있어 Actions 는 사이티드 중계(/api/llm)를 거친다.
 * 로컬에 키가 있으면 바로 간다.
 */
/**
 * 쓸 모델. 이름을 한 곳에 둔다 — stealth/union-alpha 는 2026-09-18 에 닫혔고(응답이 후속 이름을 알려 줬다)
 * 그때 세 파일에 흩어져 있어 한꺼번에 못 고칠 뻔했다. 앞이 막히면 뒤로 넘어간다.
 * 값: 측정 1건 ≈ 검색 $0.007 + 모델 $0.006 (google/gemini-2.5-flash, 2026-09-18 기준)
 */
/**
 * 글 쓰는 모델은 따로 둔다. 재는 일은 싸야 하지만(하루 20번), 쓰는 일은 좋아야 한다(주 1번).
 * 초안 한 편 ≈ 입력 3천 + 출력 3천 토큰 → Opus 5 로 약 $0.09(130원), Sonnet 5 로 약 $0.035.
 * 2026-09-18 원장 지적: union-alpha 초안이 AI 슬롭이라 버렸다. 값보다 글이 중요한 자리다.
 */
// OPENROUTER_MODEL(측정용 싼 모델)을 여기서 읽으면 안 된다 — 그 변수를 재는 쪽에 맞추면 글까지 같이 싸구려가 된다
export const 쓰기모델 = () => process.env.WRITER_MODEL || "anthropic/claude-opus-5";

export const 모델들 = () => [
  process.env.OPENROUTER_MODEL,
  // 유료 — 크레딧이 있으면 이쪽이 한국어가 낫다
  "google/gemini-2.5-flash",
  "qwen/qwen3.7-flash",
  // 크레딧이 없으면 402 가 온다(2026-09-18). 무료 모델로라도 계속 잰다
  "nex-agi/nex-n2.5-pro:free",
  "qwen/qwen3.8-27b:free",
].filter(Boolean);

export const 오픈라우터 = () =>
  process.env.LLM_PROXY_URL && process.env.LLM_PROXY_TOKEN
    ? { url: process.env.LLM_PROXY_URL, key: process.env.LLM_PROXY_TOKEN }
    : process.env.OPENROUTER_API_KEY
      ? { url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY }
      : null;

/**
 * 429·5xx 는 기다렸다 다시 부른다. Union Alpha 는 공용 풀이라 「잠시 뒤 재시도」 429 가 자주 온다
 * (2026-09-17 첫 실행에서 4번째 질문과 초안이 이걸로 멈췄다). 20·40·80초
 */
export const 재시도 = async (url, opts, 횟수 = 3) => {
  for (let i = 0; ; i++) {
    const res = await fetch(url, opts);
    // 중계의 하루 상한(x-proxy-cap)은 기다려도 안 풀린다. 다시 부르면 상한 칸만 더 먹는다
    if (!(res.status === 429 || res.status >= 500) || i >= 횟수 || res.headers?.get?.("x-proxy-cap")) return res;
    const 초 = 20 * 2 ** i;
    console.log(`  (${res.status} — ${초}초 기다렸다 다시 부릅니다 ${i + 1}/${횟수})`);
    await new Promise((r) => setTimeout(r, 초 * 1000));
  }
};

/** 어느 모델로 쓰는가. 키가 있는 쪽을 쓴다. 우선순위 openrouter → anthropic → gemini → groq. */
/**
 * 쓸 수 있는 공급자를 순서대로 다 준다. 앞이 막히면(402 크레딧·429 한도·5xx) 다음으로 넘어간다.
 *
 * 하나만 고르던 때는 그 하나가 막히면 일 전체가 섰다 — 제미나이 무료 한도에 걸려 주간 초안이
 * 이틀 연달아 죽었고, 회사 루프 분석은 OpenRouter 크레딧 0 으로 12일 같은 실패를 되풀이했다(2026-09-21).
 * Groq 는 한국어가 무너져(BUILD-LOG 2026-09-12) 글쓰기 예비로는 안 넣는다. 짧은 JSON 분석에만 끝자리로 쓴다.
 */
export const 공급자들 = ({ groq = false } = {}) => {
  const 순서 = [process.env.WRITER_PROVIDER, "openrouter", "anthropic", "gemini", ...(groq ? ["groq"] : [])];
  const 있음 = {
    openrouter: !!오픈라우터(),
    anthropic: !!(process.env.ANTHROPIC_API_KEY || (process.env.LLM_PROXY_URL && process.env.LLM_PROXY_TOKEN)),
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
  };
  return [...new Set(순서.filter(Boolean))].filter((p) => 있음[p]).map((p) => 공급자만들기(p)).filter(Boolean);
};

/** WRITER_MODEL 은 WRITER_PROVIDER 가 고른 공급자 몫이다. 예비로 넘어간 쪽에 붙이면 없는 모델 이름으로 400 이 난다 */
const 모델변수 = (p) => {
  // WRITER_PROVIDER 가 없으면 키로 자동으로 고른 첫 공급자가 주인이다
  const 주인 = process.env.WRITER_PROVIDER
    || (오픈라우터() ? "openrouter" : process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GEMINI_API_KEY ? "gemini" : process.env.GROQ_API_KEY ? "groq" : null);
  return 주인 === p ? process.env.WRITER_MODEL : undefined;
};

export const 공급자만들기 = (지정) => {
  const pick =
    지정 ||
    process.env.WRITER_PROVIDER ||
    (오픈라우터()
      ? "openrouter"
      : process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : process.env.GROQ_API_KEY
          ? "groq"
          : null);

  if (pick === "groq") {
    // 무료 목록은 전부 오픈웨이트다. 여섯 번 재봤고 한국어에서 같은 자리에서 무너졌다.
    // 죽지 않고 도는 예비 경로로만 남긴다 (BUILD-LOG 2026-09-12).
    const model = 모델변수("groq") || "openai/gpt-oss-120b";
    return {
      이름: "groq",
      key: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model,
      검색가능: false,
      최대토큰: Number(process.env.WRITER_MAX_TOKENS) || 6000,
      headers: (k) => ({ "content-type": "application/json", authorization: `Bearer ${k}` }),
      요청: (p, 최대) => ({ model, max_tokens: 최대, messages: [{ role: "user", content: p }] }),
      text: (d) => {
        const m = d.choices?.[0]?.message ?? {};
        return m.content || m.reasoning || "";
      },
      끊겼나: (d) => d.choices?.[0]?.finish_reason === "length",
      출처: () => [],
    };
  }

  if (pick === "openrouter") {
    // 원장 결정(2026-09-17): 제미나이 무료 키가 모든 모델에서 429 라 OpenRouter 로 옮겼다.
    // 모델 요금은 0원이지만 web 플러그인(Exa)은 크레딧에서 요청당 $0.007 이 나간다 (openrouter.ai/docs 웹 검색 가격)
    const model = 모델변수("openrouter") || "anthropic/claude-opus-5";
    return {
      이름: "openrouter",
      key: 오픈라우터()?.key,
      url: 오픈라우터()?.url,
      model,
      검색가능: true,
      최대토큰: Number(process.env.WRITER_MAX_TOKENS) || 12000,
      headers: (k) => ({ "content-type": "application/json", authorization: `Bearer ${k}`, "x-title": "cited-academy" }),
      요청: (p, 최대, 옵션 = {}) => ({
        model,
        max_tokens: 최대,
        messages: [{ role: "user", content: p }],
        ...(옵션.검색 ? { plugins: [{ id: "web", engine: "exa", max_results: 5 }] } : { response_format: { type: "json_object" } }),
      }),
      text: (d) => d.choices?.[0]?.message?.content ?? "",
      끊겼나: (d) => d.choices?.[0]?.finish_reason === "length",
      출처: (d) =>
        (d.choices?.[0]?.message?.annotations ?? [])
          .filter((a) => a.type === "url_citation" && a.url_citation?.url)
          .map((a) => ({ 제목: a.url_citation.title ?? "", 주소: a.url_citation.url })),
    };
  }

  if (pick === "anthropic") {
    // 키가 Vercel 에만 있으면 중계를 거친다. Anthropic 직판은 선불이 아니라 사용량 월 청구라 크레딧이 끊길 일이 없다
    const 중계 = process.env.LLM_PROXY_URL && process.env.LLM_PROXY_TOKEN;
    const model = 모델변수("anthropic") || "claude-opus-5";
    return {
      이름: 중계 ? "anthropic(중계)" : "anthropic",
      key: 중계 ? process.env.LLM_PROXY_TOKEN : process.env.ANTHROPIC_API_KEY,
      url: 중계 ? `${process.env.LLM_PROXY_URL}?provider=anthropic` : "https://api.anthropic.com/v1/messages",
      model,
      검색가능: false,
      최대토큰: Number(process.env.WRITER_MAX_TOKENS) || 6000,
      headers: (k) => (중계
        ? { "content-type": "application/json", authorization: `Bearer ${k}` }
        : { "content-type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01" }),
      요청: (p, 최대) => ({ model, max_tokens: 최대, messages: [{ role: "user", content: p }] }),
      text: (d) => (d.content ?? []).map((c) => c.text ?? "").join(""),
      끊겼나: (d) => d.stop_reason === "max_tokens",
      출처: () => [],
    };
  }

  if (pick === "gemini") {
    // 모델 이름은 자주 바뀐다. 2.5-flash 는 신규 사용자에게 닫혔고
    // 404 본문이 「gemini-3.6-flash 를 쓰라」고 직접 알려줬다(2026-09-12).
    // 또 막히면 그때도 응답에 후속 이름이 적혀 온다. WRITER_MODEL 로 넘긴다.
    const model = 모델변수("gemini") || "gemini-3.6-flash";
    return {
      이름: "gemini",
      key: process.env.GEMINI_API_KEY,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      model,
      // 구글 검색으로 근거를 잡을 수 있는 건 이쪽뿐이다. 뉴스 글이 여기에 걸려 있다.
      검색가능: true,
      // 생각한 토큰도 이 한도에 같이 센다. 넉넉히 준다.
      최대토큰: Number(process.env.WRITER_MAX_TOKENS) || 12000,
      headers: (k) => ({ "content-type": "application/json", "x-goog-api-key": k }),
      요청: (p, 최대, 옵션 = {}) => {
        const body = {
          contents: [{ parts: [{ text: p }] }],
          generationConfig: { maxOutputTokens: 최대 },
        };
        if (옵션.json) {
          // 글이 아닌 JSON(회사 루프 분석 등). 글 양식 스키마를 걸면 필요한 필드가 안 온다
          body.generationConfig.responseMimeType = "application/json";
        } else if (옵션.검색) {
          // 검색을 켜면 JSON 모드를 같이 걸 수 없다. 껍질 벗기기와 줄바꿈 복구로 받는다.
          body.tools = [{ google_search: {} }];
        } else {
          /**
           * responseSchema 로 강제한다. 안 그러면 본문 안의 따옴표 하나가 JSON을 깨서
           * 모델이 다 쓰고도 통째로 버려진다(2026-09-19, gemini-3.6-flash, position 1311 파싱 실패).
           * 필드는 write-draft.mjs·write-news.mjs 가 기대하는 모양에 맞춘다.
           */
          body.generationConfig.responseMimeType = "application/json";
          body.generationConfig.responseSchema = {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              slug: { type: "STRING" },
              summary: { type: "STRING" },
              tags: { type: "ARRAY", items: { type: "STRING" } },
              body: { type: "STRING" },
              확인필요: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["title", "summary", "tags", "body", "확인필요"],
          };
        }
        return body;
      },
      text: (d) => (d.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? "").join(""),
      끊겼나: (d) => d.candidates?.[0]?.finishReason === "MAX_TOKENS",
      // 검색을 켜면 실제로 읽은 자리가 응답에 같이 온다. 이게 「객관성」의 증거다.
      출처: (d) =>
        (d.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
          .map((c) => ({ 제목: c.web?.title ?? "", 주소: c.web?.uri ?? "" }))
          .filter((x) => x.주소),
    };
  }

  return null;
};

/** slop-check 가 잡는 것과 같은 목록. 사후에 잡느니 미리 안 쓰게 한다. */
export const 금지 = [
  "「오늘은 ~에 대해 알아보겠습니다」 같은 서론. 첫 문장부터 본론으로",
  "「먼저 / 다음으로 / 마지막으로」로 순서를 까는 것",
  "「정말 중요합니다」 「매우 유익합니다」 같은 빈 강조",
  "「~라고 할 수 있습니다」 「~인 것 같습니다」 로 흐리게 닫기",
  "「다양한」 「여러 가지」 「많은」 — 숫자를 알면 숫자를 쓴다",
  "「놀라운」 「혁신적인」 「필수적인」 같은 과장",
  "양쪽 다 맞다는 양비론. 어느 쪽인지 말한다",
  "검색하면 아무나 쓸 수 있는 일반론",
  "「~하는 것이 바람직하다」 「~하는 것이 현명하다」 같은 훈계조 닫기",
];

/**
 * 지어내기를 막는 자리. 규칙 목록에 한 줄로 끼워 두면 흘려 넘긴다.
 * 실제로 그랬다 — 「확인된 숫자만」이라 썼는데 없는 설문을 만들어 왔다(gpt-oss-120b).
 * 구멍을 남겨 두면 채운다. 그래서 「모르면 이렇게 써라」까지 준다.
 */
export const 지어내기금지 = [
  "설문·조사·통계를 만들어 내지 않는다. 우리는 설문을 한 적이 없다.",
  "겪지 않은 수업 장면을 겪은 것처럼 쓰지 않는다. 어떤 교구를 쓰는지 너는 모른다.",
  "모르는 것은 모른다고 쓴다. 숫자로 채우지 말고 판단 기준만 준다.",
  "이 블로그나 이 글 자체를 이야깃거리로 삼지 마라. 공개한 글 수나 크롤러 방문 수는 학부모에게 뜻이 없다.",
];

/**
 * 모델이 본문에 진짜 줄바꿈을 넣어 보내면 그건 JSON 이 아니다.
 * 마크다운을 JSON 문자열에 담으라고 시키면 자주 이런다 (qwen3.8-27b, 2026-09-12).
 * 모델 탓이 아니라 파서가 약한 것이다. 따옴표 안인지 밖인지만 따라가며 고친다.
 */
export const 줄바꿈고치기 = (s) => {
  let out = "";
  let 따옴표안 = false;
  let 이스케이프 = false;
  for (const ch of s) {
    if (이스케이프) { out += ch; 이스케이프 = false; continue; }
    if (ch === "\\") { out += ch; 이스케이프 = true; continue; }
    if (ch === '"') { 따옴표안 = !따옴표안; out += ch; continue; }
    if (따옴표안 && (ch === "\n" || ch === "\r" || ch === "\t")) {
      out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
      continue;
    }
    out += ch;
  }
  return out;
};

/** 껍질을 벗기고 JSON 을 꺼낸다. 한 번 실패하면 줄바꿈을 고쳐 다시 읽는다. */
export const 파싱 = (text) => {
  const 벗김 = text.replace(/```(?:json)?/g, "");
  const json = 벗김.slice(벗김.indexOf("{"), 벗김.lastIndexOf("}") + 1);
  try {
    return { post: JSON.parse(json) };
  } catch {
    try {
      return { post: JSON.parse(줄바꿈고치기(json)), 고쳐읽음: true };
    } catch (e) {
      return { 오류: e.message.slice(0, 80) };
    }
  }
};

/** 글 종류와 상관없이 깨진 것. 숫자·지역처럼 종류마다 다른 건 각 스크립트가 본다. */
export const 공통짜임새 = (본문) => {
  const 흠 = [];
  if (/^#+\s*\*\*/m.test(본문)) 흠.push("소제목에 ** 를 겹쳐 썼습니다");
  if (/##\s*\**\s*(마무리|결론|정리)/.test(본문)) 흠.push("「마무리」 문단 — 앞에서 한 말을 다시 합니다");
  if (/크롤러|색인 로봇|누적 \d+\s*회|공개한 \d+\s*편|본 블로그/.test(본문)) {
    흠.push("블로그 운영 지표를 본문에 썼습니다 — 학부모에게는 뜻이 없는 숫자입니다");
  }
  // 한국어만 쓰는 모델이 아니면 한자·영어가 샌다.
  // qwen3.8-27b 이 「최대几名까지」 「화면을转播하는」 「Instead, 부장님이」를 뱉었다.
  const 한자 = 본문.match(/[一-鿿]+/g);
  if (한자) 흠.push(`한자가 섞였습니다: ${[...new Set(한자)].slice(0, 5).join(" ")}`);
  const 영어 = 본문.match(/(?<=[가-힣\s])(?:Instead|However|Therefore|Moreover|Furthermore|or|and|but)(?=[\s,.])/g);
  if (영어) 흠.push(`영어가 섞였습니다: ${[...new Set(영어)].slice(0, 5).join(" ")}`);
  return 흠;
};
