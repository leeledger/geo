/**
 * 승인 질문 20개를 AI API 엔진에 매일 그대로 묻고 답·출처를 적재한다.
 *
 * 개선 루프의 첫 칸이다. 재지 않으면 고친 게 먹혔는지 모른다.
 * 기준선이 수동 8건(09.10)·2건(09.17)뿐이라 루프가 아무것도 판정하지 못했다.
 *
 * 엔진
 *   gemini         google_search 근거 검색을 켠다. 실제로 읽은 출처가 응답에 온다
 *   groq-compound  웹 검색이 내장된 groq/compound
 * 키가 없는 엔진은 건너뛰고 그렇게 적는다.
 *
 * 소비자 ChatGPT 화면이 아니다. collection_method 에 api- 를 붙여 남기고,
 * 다른 방법의 수치와 한 비율로 합치지 않는다.
 *
 *   node scripts/ai-measure.mjs                    오늘 안 잰 질문만 · 대상 목록 전부(진행 중 파일럿 고객 → 학원 → 자사 고객 → 탐침)
 *   node scripts/ai-measure.mjs --client robotncoding --engine gemini --limit 3
 */
import fs from "node:fs";
import { Pool } from "pg";
import { 오픈라우터, 재시도, 모델들 } from "./writer-common.mjs";
import { 클로드코드, 클로드코드있음 } from "./claude-code.mjs";
import { 측정대상, HOUSE, 예산부족알림, 예산부족닫기, 측정상한, 고객측정일 } from "../measure-targets.mjs";
import { bySlug } from "../clients.mjs";
import { 탐침측정DDL } from "./loop-grow.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const CLIENT = arg("--client");   // 없으면 대상 목록 전부(academy/measure-targets.mjs) — 순서: 유료 파일럿 고객 → 학원 → 자사 고객 → 탐침
const ONLY = arg("--engine");
const LIMIT = Number(arg("--limit")) || 0;
const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 시작 = Date.now();
/** 넓힘 탐침(academy.ai_probe_questions)은 하루 이만큼만. 승인 20문항을 다 잰 뒤에만 잰다 */
const 탐침수 = Number(process.env.MEASURE_PROBES_PER_DAY ?? 2) || 0;

const 도메인 = (s) => {
  try { return new URL(s).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(s ?? "").replace(/^www\./, "").toLowerCase().trim(); }
};

const ENGINES = [
  {
    /**
     * Claude Code(머리 없이) + WebSearch. 원장 Max 구독으로 돈다 — API 크레딧이 필요 없다(2026-09-22 전환).
     * 인용은 anthropic-web 과 같은 기준: 검색해서 실제로 받아 본 결과 주소.
     * 9/10 의 claude-code-websearch 는 세션에서 손으로 잰 것이라 방법 이름을 따로 둔다 — 섞으면 비율을 비교할 수 없다.
     */
    engine: "claude-code-web",
    method: "claude-code-headless-websearch",
    key: 클로드코드있음() ? "구독" : null,
    model: process.env.MEASURE_CLAUDE_CODE_MODEL || "sonnet",
    gap: 3000,
    ask: async (e, text) => {
      const r = await 클로드코드(text, {
        system: "너는 한국어로 답하는 일반 AI 도우미다. 사용자의 질문에 웹 검색으로 최신 정보를 찾아 답한다. 코딩과 무관한 질문도 똑같이 성실히 답한다.",
        tools: ["WebSearch"],
        model: e.model,
        purpose: "measure", // 하루 상한에서 측정 몫을 먼저 쓴다
        // 80분 작업에 고객마다 20문항이다. 한 문항이 멈추면 나머지를 다 잃는다
        timeoutMs: 3 * 60 * 1000,
      });
      // 구독 한도에 걸리면 나머지 질문도 똑같이 막힌다 — 429 로 넘겨 루프를 멈춘다
      if (!r.ok) return { status: r.인증실패 ? 401 : r.한도 ? 429 : r.시간초과 ? 503 : String(r.error).startsWith("결과 없음") ? 500 : 0, error: r.error ?? "알 수 없음" };
      const citations = r.urls.map((u) => ({ domain: 도메인(u.url), title: u.title, url: u.url }));
      const answerUrls = r.text.match(/https?:\/\/[^\s)\]>"']+/g) ?? [];
      return { answer: r.text, citations, answerUrls };
    },
  },
  {
    // 원장 결정(2026-09-17). 모델 0원, 웹 검색(Exa)은 요청당 $0.007 크레딧
    engine: "openrouter",
    method: "api-openrouter-web-exa",
    key: 오픈라우터()?.key,
    url: 오픈라우터()?.url,
    model: 모델들()[0],
    gap: 3000,
    ask: async (e, text) => {
      const res = await 재시도(e.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${e.key}`, "x-title": "cited-ai-measure" },
        body: JSON.stringify({
          model: e.model,
          messages: [{ role: "user", content: text }],
          plugins: [{ id: "web", engine: "exa", max_results: 5 }],
        }),
      });
      if (!res.ok) return { status: res.status, error: (await res.text()).slice(0, 3000) };
      const d = await res.json();
      // 200 안에 오류가 오기도 한다
      if (d.error) return { status: d.error.code ?? 0, error: JSON.stringify(d.error).slice(0, 3000) };
      const m = d.choices?.[0]?.message ?? {};
      // 인용은 검색 결과 주석에서만 센다. 본문 URL 은 따라 쓴 것일 수 있다
      const citations = (m.annotations ?? [])
        .filter((a) => a.type === "url_citation" && a.url_citation?.url)
        .map((a) => ({ domain: 도메인(a.url_citation.url), title: a.url_citation.title ?? "", url: a.url_citation.url }));
      const answerUrls = (m.content ?? "").match(/https?:\/\/[^\s)\]>"']+/g) ?? [];
      return { answer: m.content ?? "", citations, answerUrls };
    },
  },
  {
    /**
     * Claude + 웹 검색. 검색 1,000건당 $10 + 토큰 (platform.claude.com 요금표, 2026-09-18 확인).
     * 질문 1건 ≈ 검색 $0.01 + 토큰 $0.03 (Sonnet 5 기준). OpenRouter 보다 비싸지만 선불이 아니라 안 멈춘다.
     * 키가 Vercel 에만 있으면 중계(/api/llm?provider=anthropic)를 거친다.
     */
    engine: "anthropic-web",
    method: "api-anthropic-web-search",
    key: process.env.LLM_PROXY_TOKEN || process.env.ANTHROPIC_API_KEY,
    url: process.env.LLM_PROXY_URL ? `${process.env.LLM_PROXY_URL}?provider=anthropic` : "https://api.anthropic.com/v1/messages",
    model: process.env.MEASURE_ANTHROPIC_MODEL || "claude-sonnet-5",
    gap: 2000,
    ask: async (e, text) => {
      const 중계 = Boolean(process.env.LLM_PROXY_URL);
      const res = await 재시도(e.url, {
        method: "POST",
        headers: 중계
          ? { "content-type": "application/json", authorization: `Bearer ${e.key}` }
          : { "content-type": "application/json", "x-api-key": e.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: e.model,
          max_tokens: 4000,
          messages: [{ role: "user", content: text }],
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        }),
      });
      if (!res.ok) return { status: res.status, error: (await res.text()).slice(0, 3000) };
      const d = await res.json();
      if (d.error) return { status: d.error.code ?? 0, error: JSON.stringify(d.error).slice(0, 3000) };
      const blocks = d.content ?? [];
      const answer = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      // 인용은 실제로 검색해 읽은 자리에서만 센다 (검색 결과 블록 + 문장에 달린 인용)
      const found = new Map();
      for (const b of blocks) {
        const list = b.type === "web_search_tool_result" && Array.isArray(b.content) ? b.content : [];
        for (const r of list) if (r.url) found.set(r.url, { domain: 도메인(r.url), title: r.title ?? "", url: r.url });
        for (const c of b.citations ?? []) if (c.url) found.set(c.url, { domain: 도메인(c.url), title: c.title ?? "", url: c.url });
      }
      const answerUrls = answer.match(/https?:\/\/[^\s)\]>"']+/g) ?? [];
      return { answer, citations: [...found.values()], answerUrls, searches: d.usage?.server_tool_use?.web_search_requests ?? null };
    },
  },
  {
    engine: "gemini",
    method: "api-gemini-google-search",
    key: process.env.GEMINI_API_KEY,
    // 모델 이름은 자주 닫힌다. 404 본문에 후속 이름이 온다 (writer-common.mjs)
    model: process.env.MEASURE_GEMINI_MODEL || "gemini-3.6-flash",
    gap: 1500,
    ask: async (e, text) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${e.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": e.key },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], tools: [{ google_search: {} }] }),
      });
      if (!res.ok) return { status: res.status, error: (await res.text()).slice(0, 3000) };
      const d = await res.json();
      const answer = (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      // 근거 조각의 uri 는 구글 중계 주소다. 제목 자리에 원래 도메인이 온다
      const citations = (d.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
        .filter((c) => c.web)
        .map((c) => ({ domain: 도메인(c.web.title), title: c.web.title ?? "", url: c.web.uri ?? "" }));
      return { answer, citations, queries: d.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [] };
    },
  },
  {
    engine: "groq-compound",
    method: "api-groq-compound",
    key: process.env.GROQ_API_KEY,
    model: process.env.MEASURE_GROQ_MODEL || "groq/compound",
    gap: 4000,
    ask: async (e, text) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${e.key}` },
        body: JSON.stringify({ model: e.model, messages: [{ role: "user", content: text }] }),
      });
      if (!res.ok) return { status: res.status, error: (await res.text()).slice(0, 3000) };
      const d = await res.json();
      const m = d.choices?.[0]?.message ?? {};
      // 검색 결과 모양이 판마다 조금씩 달라 url 을 가진 것은 전부 줍는다.
      // 인용은 실제로 검색해 읽은 것만 센다. 본문 URL 은 넣지 않는다 —
      // 「robotncoding.com 이 사이트 무슨 학원이야?」에 주소를 따라 쓰기만 해도 인용이 된다
      const found = new Map();
      const walk = (x) => {
        if (!x || typeof x !== "object") return;
        if (typeof x.url === "string" && /^https?:/.test(x.url)) found.set(x.url, { domain: 도메인(x.url), title: x.title ?? "", url: x.url });
        for (const v of Object.values(x)) walk(v);
      };
      walk(m.executed_tools);
      const answerUrls = (m.content ?? "").match(/https?:\/\/[^\s)\]>"']+/g) ?? [];
      return { answer: m.content ?? "", citations: [...found.values()], answerUrls };
    },
  },
];

/** 이 키로 부를 수 있는 모델 목록에서 대안을 고른다. 이름을 박아 두면 또 닫힌다 */
const 다른모델 = async (e) => {
  if (e.engine === "gemini") {
    const d = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": e.key } })
      .then((r) => r.json()).catch(() => ({}));
    const names = (d.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n) && n !== e.model);
    console.log(`    이 키로 보이는 flash 모델: ${names.join(", ") || "없음"}`);
    // 새 판부터, 같은 판이면 lite 를 뒤에
    return names.sort((a, b) => b.localeCompare(a, "en", { numeric: true })).slice(0, 4);
  }
  if (e.engine === "groq-compound") return ["groq/compound-mini"].filter((m) => m !== e.model);
  if (e.engine === "openrouter") return 모델들().filter((m) => m !== e.model);
  return [];
};

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const main = async () => {
  // 누구를 잴지 — --client 가 없으면 진행 중 파일럿·측정 켠 고객·학원을 순서대로(academy/measure-targets.mjs)
  const 대상 = await 측정대상(q, 오늘, CLIENT);
  const 나눔 = 대상.length > 1;   // 학원만 있으면 나누지 않는다 — 지금과 같게
  const 유료있음 = 대상.some((t) => t.묶음 === "유료");
  const 집 = 대상.find((t) => t.slug === HOUSE) ?? 대상[0];
  /** Claude 측정 몫. claude-code.mjs 와 같은 규칙(measure-targets 측정상한 — 학원 밖에 잴 고객(유료·승인 질문 있는 자사) k 곳이면 22+20k, env 먼저 · Step 32 D45) */
  const 몫 = 측정상한(await 고객측정일(q, 오늘)).reserve;
  const 측정씀 = async () => {
    const [r] = await q(`select count(*)::int n from geo.claude_calls where purpose = 'measure'
      and (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`).catch(() => [null]);
    return r ? r.n : null;
  };

  await q(`create table if not exists academy.ai_measurements (
    id bigserial primary key, client_id int not null default 1, measured_on date not null,
    collection_method text not null, engine text not null, model text, prompt_id text not null,
    stage text, prompt_text text not null, attempt int not null default 1,
    mentioned boolean not null default false, cited boolean not null default false,
    citations jsonb not null default '[]'::jsonb, note text, raw jsonb not null,
    imported_at timestamptz not null default now(),
    unique (client_id, measured_on, collection_method, engine, prompt_id, attempt))`);

  /**
   * 한 문항 결과를 넣는다. 탐침(p*)은 academy.ai_probe_measurements 로 간다(x.form 이 있으면 탐침).
   * ai_measurements 를 날·곳으로 묶어 세는 곳이 케이스 리포트·현황판 등 여럿이다 — 탐침이 섞이면 영업 숫자가 바뀐다(Richard 22)
   */
  const 적재 = async (client, e, x, r) => {
    const mentioned = client.answerRe.test(r.answer);
    const cited = r.citations.some((c) => c.domain === client.domain || c.domain.endsWith(`.${client.domain}`));
    const 탐침 = Boolean(x.form);
    await q(
      `insert into ${탐침 ? "academy.ai_probe_measurements" : "academy.ai_measurements"}
         (client_id, measured_on, collection_method, engine, model, prompt_id, stage, prompt_text,
          attempt, mentioned, cited, citations, note, raw${탐침 ? ", form, radius" : ""})
       values ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11::jsonb,$12,$13::jsonb${탐침 ? ",$14,$15" : ""})
       on conflict (client_id, measured_on, collection_method, engine, prompt_id, attempt) do nothing`,
      [client.id, 오늘, e.method, e.engine, e.model, x.prompt_id, x.stage, x.text, mentioned, cited,
        JSON.stringify(r.citations), "자동 API 측정 · 소비자 화면 아님",
        JSON.stringify({ answer: r.answer, queries: r.queries ?? [], answer_urls: r.answerUrls ?? [] }),
        ...(탐침 ? [x.form, x.radius] : [])],
    );
    return { mentioned, cited };
  };

  let 성공엔진 = 0;
  let 시도엔진 = 0;
  let 설정실패 = false;
  let 질문대기 = false;
  const 요약 = [];

  /**
   * 넓힘 탐침 — daily-agent 자기 점검이 만든 「송파」「서울」「동네 없이」·검색어형 질문. 따로 표(ai_probe_measurements)에 넣는다.
   * Claude(구독)로만, 승인 20문항을 다 잰 날에만 잰다. 기준선이 먼저다.
   * optimize.yml 제한이 80분이라 60분이 지났으면 멈춘다 — 뒤의 개선 루프(20분 남김)가 잘리면 안 된다(Step 32 D45: 고객 2곳이면 승인 60문항만 35~40분)
   */
  const 탐침재기 = async (client, e) => {
    const [표] = await q(`select to_regclass('academy.ai_probe_questions')::text as t`);
    if (!표.t) return;
    /**
     * 측정 몫 안에서만 (Step 23 D4). claude-code.mjs 는 측정을 「오늘 전체 호출 < CLAUDE_DAILY_MAX」로만 막는다.
     * 측정이 몫(CLAUDE_MEASURE_RESERVE)을 넘겨 쓰면 나머지 일은 자기 몫을 그대로 쓰니 하루 합이 상한을 넘는다.
     * 승인 20문항이 이미 몫을 다 썼으면 탐침은 건너뛴다. 새 상한은 만들지 않는다 — 있는 몫 값을 그대로 읽는다
     */
    const 씀 = await 측정씀();
    const 남은몫 = 씀 !== null ? 몫 - 씀 : 0;   // 못 세면 안 부른다
    if (남은몫 <= 0) {
      요약.push(`${e.engine} 탐침: 오늘 측정 몫 ${몫}회를 ${씀 !== null ? `승인 질문이 ${씀}회로 다 써서` : "셀 수 없어"} 건너뜀`);
      return;
    }
    await q(탐침측정DDL);
    /**
     * 가장 오래 안 잰 탐침부터. 오늘 잰 것은 빼고, 오늘 이미 잰 만큼은 한도에서 뺀다.
     * 확장 질문(Step 31 D40 — 원장이 받아들인 불린 탐침, pilot_questions stage 'extend', approved=false)도 이 줄에 같이 선다.
     * 승인 20문항이 아니니 ai_measurements 에 안 넣는다(form 'extend' → 탐침 표). 같은 날짜면 확장 질문이 먼저.
     * 최근 14일 한 번이라도 이름이 나온 것을 먼저 잰다(Arch 31) — 승격 문턱(14일 4번)에 닿으려면 불린 탐침을 몰아 재야 한다
     */
    const 탐침 = await q(
      `select c.prompt_id, c.stage, c.text, c.form, c.radius, m.last_day
         from (select p.prompt_id, 'probe' as stage, p.text, p.form, p.radius, 1 as ord_kind, p.id as ord_id
                 from academy.ai_probe_questions p where p.client_id=$1 and p.active
               union all
               select 'q' || pq.position, 'extend', pq.text, 'extend', null, 0, pq.position
                 from geo.pilot_questions pq join geo.pilots pl on pl.id = pq.pilot_id
                where pl.client_id=$1 and pq.stage='extend') c
         left join (select prompt_id, max(measured_on) as last_day,
                           bool_or((mentioned or cited) and measured_on >= $3::date - 13) as hit14
                      from academy.ai_probe_measurements
                     where client_id=$1 and collection_method=$2 group by prompt_id) m
           on m.prompt_id = c.prompt_id
        where m.last_day is null or m.last_day < $3::date
        order by coalesce(m.hit14, false) desc, m.last_day nulls first, c.ord_kind, c.ord_id
        limit greatest(0, $4 - (select count(*) from academy.ai_probe_measurements
                                 where client_id=$1 and collection_method=$2 and measured_on=$3::date))`,
      [client.id, e.method, 오늘, Math.min(탐침수, 남은몫)]);
    let pOk = 0, pHit = 0;
    for (const x of 탐침) {
      // 한 문항이 3분까지 걸린다. 문항마다 본다 — 묶음 앞에서 한 번만 보면 60분에 시작해 67분까지 간다
      if (Date.now() - 시작 > 60 * 60 * 1000) {
        요약.push(`${e.engine} 탐침: 시작 후 60분이 지나 멈춤`);
        break;
      }
      const r = await e.ask(e, x.text).catch((err) => ({ status: 0, error: err.message }));
      if (r.error) {
        console.log(`  ✗ ${e.engine} 탐침 ${x.prompt_id} ${r.status} ${r.error.replace(/\s+/g, " ").slice(0, 160)}`);
        if ([400, 401, 402, 403, 404, 413, 429, 500, 503].includes(r.status)) break;
        continue;
      }
      const { mentioned, cited } = await 적재(client, e, x, r);
      pOk++;
      if (mentioned || cited) pHit++;
      console.log(`  ${cited ? "◎" : mentioned ? "○" : "·"} ${e.engine} 탐침 ${x.prompt_id} 출처 ${r.citations.length}`);
      await 쉼(e.gap);
    }
    if (탐침.length) 요약.push(`${e.engine} 탐침: ${pOk}/${탐침.length} 측정 · 언급·인용 ${pHit}/${pOk}`);
  };

  const 나중탐침 = [];
  for (const t of 대상) {
    const 머리 = 나눔 ? `${t.name} · ` : "";
    // 이름 정규식이 없으면 지어내지 않고 그 고객만 멈춘다 — 다른 고객은 잰다
    const client = t.conf;
    if (!client) {
      요약.push(`${머리}측정 설정 없음: ${t.slug} — geo.clients.answer_pattern 이나 academy/clients.mjs 에 이름 판별 말이 있어야 잽니다`);
      설정실패 = true;
      continue;
    }
    const questions = await q(
      `select 'q' || q.position as prompt_id, q.stage, q.text
         from geo.pilot_questions q join geo.pilots p on p.id = q.pilot_id
        where p.client_id = $1 and q.approved order by q.position`,
      [client.id],
    );
    if (!questions.length) {
      // 질문 승인 전은 고장이 아니라 대기다(Step 25 리뷰). 빨간불을 켜지 않는다 — 승인은 원장 몫이고 화면 측정이 그 고객 일감을 올린다
      요약.push(`${머리}승인된 질문이 없습니다 — 승인 대기`);
      질문대기 = true;
      continue;
    }

    for (const e of ENGINES) {
      if (ONLY && e.engine !== ONLY) continue;
      // 제미나이·groq 무료 키는 한도에 막혀 있다(2026-09-17). OpenRouter 가 있으면 매일 헛두드리지 않는다.
      // 결제를 켜면 MEASURE_ALL_ENGINES=1 로 다시 같이 잰다
      // MEASURE_ENGINES 로 쓸 엔진을 고른다 (예: anthropic-web 또는 anthropic-web,openrouter).
      // 안 정하면 OpenRouter 만 — 제미나이·groq 무료 키는 한도에 막혀 있어 매일 헛두드릴 이유가 없다
      const 고른엔진 = (process.env.MEASURE_ENGINES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!ONLY && 고른엔진.length && !고른엔진.includes(e.engine)) continue;
      if (!ONLY && !고른엔진.length && e.engine !== "openrouter" && 오픈라우터() && process.env.MEASURE_ALL_ENGINES !== "1") continue;
      if (!e.key) {
        요약.push(`${머리}${e.engine}: 키 없음 — 건너뜀`);
        continue;
      }
      시도엔진++;
      const done = new Set((await q(
        `select prompt_id from academy.ai_measurements
          where client_id=$1 and measured_on=$2 and collection_method=$3 and attempt=1`,
        [client.id, 오늘, e.method],
      )).map((r) => r.prompt_id));
      let todo = questions.filter((x) => !done.has(x.prompt_id));
      /**
       * 매일 20문항을 다 재면 돈이 그만큼 나간다. 효과 판정은 7일 창으로 보니 그럴 필요가 없다.
       * MEASURE_EVERY_DAYS=3 이면 3일에 한 번만 전부 잰다. 그 사이 날에는 아무것도 안 부른다.
       * 다만 한 번 잴 때는 20문항을 통째로 잰다 — 질문마다 잰 날이 다르면 적중률을 비교할 수 없다.
       */
      const 주기 = Number(process.env.MEASURE_EVERY_DAYS) || 1;
      if (주기 > 1 && todo.length && !LIMIT) {
        const [최근] = await q(
          `select max(measured_on)::text as last_day from academy.ai_measurements
            where client_id=$1 and collection_method=$2`, [client.id, e.method]);
        const 지난날 = 최근?.last_day ? Math.round((new Date(오늘) - new Date(최근.last_day)) / 86400000) : 999;
        if (지난날 < 주기 && done.size === 0) {
          요약.push(`${머리}${e.engine}: ${주기}일 주기 — 마지막 측정 ${지난날}일 전이라 오늘은 건너뜀`);
          성공엔진++;
          continue;
        }
      }
      if (LIMIT) todo = todo.slice(0, LIMIT);

      /**
       * Claude 측정 몫을 순서대로 나눈다(Step 25 D3). 고객이 둘 이상일 때만 — 학원 혼자면 지금처럼 claude-code.mjs 상한만 본다.
       * 한 고객의 남은 문항을 다 못 잴 만큼 남았으면 아예 안 잰다 — 절반만 잰 날은 다른 날과 비교가 안 된다.
       * 못 세면(표 없음 등) 나누지 않고 claude-code.mjs 상한에 맡긴다
       */
      if (나눔 && e.engine === "claude-code-web" && todo.length && !LIMIT) {
        const 씀 = await 측정씀();
        if (씀 !== null && 몫 - 씀 < todo.length) {
          const 줄 = `${머리}${e.engine}: 오늘 측정 몫 ${몫}회 가운데 ${씀}회를 앞 순서가 써서 남은 ${todo.length}문항을 못 잼`;
          요약.push(줄);
          await 예산부족알림(q, t, "claude", `Claude 측정 몫(하루 ${몫}회)을 앞 순서 고객이 먼저 써서 ${오늘} ${t.name} 승인 질문 ${todo.length}문항을 못 쟀습니다`,
            "GitHub 저장소 변수 CLAUDE_MEASURE_RESERVE(측정 몫)와 CLAUDE_DAILY_MAX(하루 전체)를 함께 올리면 다음 실행부터 잽니다.")
            .catch((err) => console.log("  ⚠ 예산 일감 기록 실패", err.message));
          continue;
        }
      }

      let ok = 0, fail = 0, hit = 0;
      let 마지막오류 = "";
      for (const x of todo) {
        let r;
        try { r = await e.ask(e, x.text); }
        catch (err) { r = { status: 0, error: err.message }; }
        if (r.error) {
          fail++;
          마지막오류 = `${r.status} ${r.error.replace(/\s+/g, " ").slice(0, 300)}`;
          // 429 본문은 어느 한도(분당·일일·무료 등급)인지를, 404 는 쓸 모델 이름을 담아 온다. 첫 실패는 끝까지 찍는다
          console.log(`  ✗ ${e.engine} ${x.prompt_id} ${fail === 1 ? `${r.status} ${r.error.replace(/\s+/g, " ")}` : 마지막오류.slice(0, 160)}`);
          // 모델마다 무료 한도가 따로다. 막히면 같은 키로 되는 다른 모델을 한 번 찾아본다
          if ([402, 404, 413, 429].includes(r.status) && ok === 0 && !e.probed) {
            e.probed = true;
            const 대안 = await 다른모델(e);
            for (const m of 대안) {
              const 원래 = e.model;
              e.model = m;
              const t2 = await e.ask(e, x.text).catch((err) => ({ status: 0, error: err.message }));
              console.log(`    대안 모델 ${m}: ${t2.error ? `${t2.status} ${t2.error.replace(/\s+/g, " ").slice(0, 140)}` : "성공"}`);
              if (!t2.error) { r = t2; break; }
              e.model = 원래;
              await 쉼(e.gap);
            }
            if (!r.error) {
              fail--;
              요약.push(`${머리}${e.engine}: 기본 모델이 막혀 ${e.model} 로 쟀습니다 (MEASURE_* 변수로 고정 가능)`);
            }
          }
        }
        if (r.error) {
          // 한도·키·모델 문제는 나머지 질문도 똑같이 막힌다. 계속 두드리지 않는다
          // 503 은 Claude Code 시간 초과, 500 은 결과 없이 끝남(CLI 고장) — 다음 문항도 같을 공산이 커 멈춘다
          if ([400, 401, 402, 403, 404, 413, 429, 500, 503].includes(r.status)) break;
          await 쉼(e.gap);
          continue;
        }
        const { mentioned, cited } = await 적재(client, e, x, r);
        ok++;
        if (mentioned || cited) hit++;
        console.log(`  ${cited ? "◎" : mentioned ? "○" : "·"} ${e.engine} ${나눔 ? `${client.slug} ` : ""}${x.prompt_id} 출처 ${r.citations.length}`);
        await 쉼(e.gap);
      }
      if (ok > 0 || (todo.length === 0 && done.size > 0)) 성공엔진++;
      요약.push(`${머리}${e.engine}: 오늘 ${done.size + ok}/${questions.length} 측정 · 이번 실행 언급·인용 ${hit}/${ok}` +
        (fail ? ` · 실패 ${fail} (${마지막오류.slice(0, 120)})` : ""));

      if (e.engine === "claude-code-web" && done.size + ok === questions.length) {
        await 예산부족닫기(q, t, "claude", `${오늘} ${e.engine} ${questions.length}/${questions.length} 측정`)
          .catch((err) => console.log("  ⚠ 예산 일감 닫기 실패", err.message));
        // 탐침은 모든 대상 뒤 — 순서 「유료 → 학원 → 자사 → 탐침」(Step 30 Arch). 학원 승인 질문을 다 잰 날만 차례를 잡는다.
        // 유료 파일럿 고객이 있는 날은 끈다(그 몫은 고객 기준선에 쓴다)
        // 탐침을 도는 고객(clients.mjs loop.probes — 학원 넓힘, 아이로그 검색어 변형 Step 31 D43)은 고객마다 같은 하루 탐침 몫
        if (탐침수 > 0 && !LIMIT && (t.slug === HOUSE || !나눔 || Boolean(bySlug(t.slug)?.loop?.probes))) {
          if (유료있음) 요약.push(`${e.engine} 탐침: 유료 파일럿 고객이 있는 날이라 끔`);
          else 나중탐침.push(() => 탐침재기(client, e));
        }
      }
    }
  }
  for (const 재기 of 나중탐침) await 재기();

  // 크레딧이 없으면 웹 검색을 쓰는 측정이 통째로 막힌다(무료 모델도 검색은 유료다).
  // 돈 쓰는 일은 사람만 할 수 있으니 일감으로 올려 대시보드에 띄운다 — 로그에만 남기면 아무도 안 본다
  // Anthropic 은 잔액이 바닥나면 402 가 아니라 400 「credit balance is too low」 로 답한다(2026-09-22).
  // 그걸 못 알아봐서 크레딧 일감을 「해결됨」으로 닫아 버렸다. 선불이다 — 월 청구라 적었던 BUILD-LOG 는 틀렸다
  // 회사 전체 일이라 학원 id 에 둔다(전과 같은 자리)
  const 크레딧막힘 = 요약.some((s) => /Insufficient credits|402|credit balance is too low/i.test(s));
  const 앤트로픽막힘 = 요약.some((s) => /credit balance is too low/i.test(s));
  // 닫는 건 실제로 한 번이라도 잰 날만. 건너뛴 날(주기)이나 다른 이유로 실패한 날에 닫으면 거짓 완료다
  const 실제로잼 = 요약.some((s) => /오늘 [1-9]\d*\/\d+ 측정/.test(s));
  if (집?.id) await q(
    크레딧막힘
      ? `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload, link)
         values ($1,'measure','human','openrouter-credits', $2, $3, '사람 대기', 5, '{"sticky":true}'::jsonb, $4)
         on conflict (client_id, dedupe_key) do update set status='사람 대기', title=excluded.title, detail=excluded.detail,
           link=excluded.link, done_at=null, updated_at=now()`
      : 실제로잼
        ? `update geo.agent_tasks set status='완료', done_at=now(), updated_at=now()
            where client_id=$1 and dedupe_key='openrouter-credits' and status='사람 대기'`
        : `select 1`,
    크레딧막힘
      ? [집.id,
         앤트로픽막힘 ? "Anthropic 크레딧이 바닥나 AI 답변 측정이 멈췄습니다" : "OpenRouter 크레딧이 없어 AI 답변 측정이 멈췄습니다",
         앤트로픽막힘
           ? "Claude 웹 검색으로 20문항을 3일에 한 번 잽니다. 한 번 약 $0.8, 한 달 약 $8 입니다. 초안 쓰기(편당 약 $0.09)도 같은 잔액을 씁니다. 충전하면 다음 실행부터 자동으로 다시 잽니다."
           : "무료 모델도 웹 검색을 켜면 요청당 약 $0.007 이 크레딧에서 나갑니다. 하루 20문항 기준 월 약 $5 입니다. 충전하면 다음 실행부터 자동으로 다시 잽니다.",
         앤트로픽막힘 ? "https://console.anthropic.com/settings/billing" : "https://openrouter.ai/settings/credits"]
      : 실제로잼 ? [집.id] : [],
  ).catch((e) => console.log("  ⚠ 크레딧 일감 기록 실패", e.message));

  console.log(`\n${나눔 ? 대상.map((t) => t.name).join(" → ") : 집?.name ?? CLIENT} · ${오늘} AI 자동 측정`);
  for (const s of 요약) console.log(`  ${s}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### AI 자동 측정 ${오늘}\n${요약.map((s) => `- ${s}`).join("\n")}\n\n`);
  }
  if (설정실패) {
    // 설정·질문이 없는 고객이 있으면 빨간불 — 다른 고객을 다 쟀어도 한 곳을 못 잰 것은 고장이다
    process.exitCode = 1;
  } else if (질문대기 && 시도엔진 === 0) {
    process.exitCode = 78; // 잴 수 있는 고객이 하나도 없다 — 승인 대기뿐이면 「건너뜀」
  } else if (시도엔진 === 0) {
    console.log("측정할 키가 없습니다. LLM_PROXY_URL·ANTHROPIC_API_KEY 중 하나가 필요합니다.");
    process.exitCode = 78;
  } else if (성공엔진 === 0) {
    // 돈이 없어 못 잰 것은 고장이 아니라 설정이다. 78 로 끝내면 워크플로가 빨간불 대신 「건너뜀」으로 적는다.
    // 매일 빨간불이 뜨면 진짜 고장났을 때 아무도 안 본다 (write.yml 이 같은 이유로 78 을 쓴다)
    process.exitCode = 크레딧막힘 ? 78 : 1;
    if (크레딧막힘) console.log("\n크레딧이 없어 측정을 건너뜁니다. 채우면 다음 실행부터 자동으로 다시 잽니다.");
  }
};

main()
  .catch((e) => {
    console.log("실패:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
