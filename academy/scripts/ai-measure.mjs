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
 *   node scripts/ai-measure.mjs                    오늘 안 잰 질문만
 *   node scripts/ai-measure.mjs --client robotncoding --engine gemini --limit 3
 */
import fs from "node:fs";
import { Pool } from "pg";
import { 오픈라우터 } from "./writer-common.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const CLIENT = arg("--client") ?? "robotncoding";
const ONLY = arg("--engine");
const LIMIT = Number(arg("--limit")) || 0;
const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));

const 도메인 = (s) => {
  try { return new URL(s).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(s ?? "").replace(/^www\./, "").toLowerCase().trim(); }
};

const ENGINES = [
  {
    // 원장 결정(2026-09-17). 모델 0원, 웹 검색(Exa)은 요청당 $0.007 크레딧
    engine: "openrouter",
    method: "api-openrouter-web-exa",
    key: 오픈라우터()?.key,
    url: 오픈라우터()?.url,
    model: process.env.OPENROUTER_MODEL || "stealth/union-alpha",
    gap: 3000,
    ask: async (e, text) => {
      const res = await fetch(e.url, {
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
  return [];
};

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const main = async () => {
  const [client] = await q(`select id, slug, name, domain from geo.clients where slug=$1`, [CLIENT]);
  if (!client) throw new Error(`고객사 없음: ${CLIENT}`);

  // 「똑똑한 로봇&코딩학원」(glcedu.co.kr)은 다른 곳이다. 이름만 보고 세면 남의 노출을 우리 것으로 센다
  const 이름 = client.slug === "robotncoding"
    ? /(?<!똑똑한\s?)(로봇\s?(&|&amp;|앤|and)\s?코딩)|robotncoding/i
    : new RegExp(client.domain.replace(/\./g, "\\."), "i");

  const questions = await q(
    `select 'q' || q.position as prompt_id, q.stage, q.text
       from geo.pilot_questions q join geo.pilots p on p.id = q.pilot_id
      where p.client_id = $1 and q.approved order by q.position`,
    [client.id],
  );
  if (!questions.length) throw new Error("승인된 질문이 없습니다");

  await q(`create table if not exists academy.ai_measurements (
    id bigserial primary key, client_id int not null default 1, measured_on date not null,
    collection_method text not null, engine text not null, model text, prompt_id text not null,
    stage text, prompt_text text not null, attempt int not null default 1,
    mentioned boolean not null default false, cited boolean not null default false,
    citations jsonb not null default '[]'::jsonb, note text, raw jsonb not null,
    imported_at timestamptz not null default now(),
    unique (client_id, measured_on, collection_method, engine, prompt_id, attempt))`);

  let 성공엔진 = 0;
  let 시도엔진 = 0;
  const 요약 = [];
  for (const e of ENGINES) {
    if (ONLY && e.engine !== ONLY) continue;
    if (!e.key) {
      요약.push(`${e.engine}: 키 없음 — 건너뜀`);
      continue;
    }
    시도엔진++;
    const done = new Set((await q(
      `select prompt_id from academy.ai_measurements
        where client_id=$1 and measured_on=$2 and collection_method=$3 and attempt=1`,
      [client.id, 오늘, e.method],
    )).map((r) => r.prompt_id));
    let todo = questions.filter((x) => !done.has(x.prompt_id));
    if (LIMIT) todo = todo.slice(0, LIMIT);

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
        if ([404, 413, 429].includes(r.status) && ok === 0 && !e.probed) {
          e.probed = true;
          const 대안 = await 다른모델(e);
          for (const m of 대안) {
            const 원래 = e.model;
            e.model = m;
            const t = await e.ask(e, x.text).catch((err) => ({ status: 0, error: err.message }));
            console.log(`    대안 모델 ${m}: ${t.error ? `${t.status} ${t.error.replace(/\s+/g, " ").slice(0, 140)}` : "성공"}`);
            if (!t.error) { r = t; break; }
            e.model = 원래;
            await 쉼(e.gap);
          }
          if (!r.error) {
            fail--;
            요약.push(`${e.engine}: 기본 모델이 막혀 ${e.model} 로 쟀습니다 (MEASURE_* 변수로 고정 가능)`);
          }
        }
      }
      if (r.error) {
        // 한도·키·모델 문제는 나머지 질문도 똑같이 막힌다. 계속 두드리지 않는다
        if ([400, 401, 403, 404, 413, 429].includes(r.status)) break;
        await 쉼(e.gap);
        continue;
      }
      const mentioned = 이름.test(r.answer);
      const cited = r.citations.some((c) => c.domain === client.domain || c.domain.endsWith(`.${client.domain}`));
      await q(
        `insert into academy.ai_measurements
           (client_id, measured_on, collection_method, engine, model, prompt_id, stage, prompt_text,
            attempt, mentioned, cited, citations, note, raw)
         values ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11::jsonb,$12,$13::jsonb)
         on conflict (client_id, measured_on, collection_method, engine, prompt_id, attempt) do nothing`,
        [client.id, 오늘, e.method, e.engine, e.model, x.prompt_id, x.stage, x.text, mentioned, cited,
          JSON.stringify(r.citations), "자동 API 측정 · 소비자 화면 아님",
          JSON.stringify({ answer: r.answer, queries: r.queries ?? [], answer_urls: r.answerUrls ?? [] })],
      );
      ok++;
      if (mentioned || cited) hit++;
      console.log(`  ${cited ? "◎" : mentioned ? "○" : "·"} ${e.engine} ${x.prompt_id} 출처 ${r.citations.length}`);
      await 쉼(e.gap);
    }
    if (ok > 0 || (todo.length === 0 && done.size > 0)) 성공엔진++;
    요약.push(`${e.engine}: 오늘 ${done.size + ok}/${questions.length} 측정 · 이번 실행 언급·인용 ${hit}/${ok}` +
      (fail ? ` · 실패 ${fail} (${마지막오류.slice(0, 120)})` : ""));
  }

  console.log(`\n${client.name} · ${오늘} AI 자동 측정`);
  for (const s of 요약) console.log(`  ${s}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### AI 자동 측정 ${오늘}\n${요약.map((s) => `- ${s}`).join("\n")}\n\n`);
  }
  if (시도엔진 === 0) {
    console.log("측정할 키가 없습니다. GEMINI_API_KEY 또는 GROQ_API_KEY 가 필요합니다.");
    process.exitCode = 78;
  } else if (성공엔진 === 0) {
    process.exitCode = 1;
  }
};

main()
  .catch((e) => {
    console.log("실패:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
