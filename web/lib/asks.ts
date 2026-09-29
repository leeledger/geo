import { pool, type Client } from "./ops";
import { engineName } from "./agents";

/**
 * AI 에게 실제로 물어본 기록 — academy.ai_measurements 를 사람이 읽는 모양으로.
 *
 * 측정(ai-measure.mjs · tools/ai-web-measure.mjs)이 질문마다 한 줄씩 쌓는다. 지우는 곳이 없어 날짜별로 계속 누적된다.
 * 시각은 imported_at — 자동 측정은 답을 받아 적은 때다. 손으로 잰 기록(import-ai-measurements.mjs)은
 * 가져온 시각으로 덮여 물어본 시각이 아니라서 안 보여 준다.
 * 곳(collection_method)이 다르면 숫자를 합치지 않는다 — 한 날에 4곳을 물었으면 요약도 4줄이다.
 * 날짜·시각은 전부 KST (DB 는 UTC. 러너가 UTC 라 그냥 찍으면 9시간 밀린다).
 */

export type AskResult = "both" | "cited" | "named" | "none";

export type AskRow = {
  id: string;
  day: string;              // YYYY-MM-DD (측정일)
  time: string | null;      // HH:MM KST — 자동 측정만
  method: string;
  where: string;            // 「Claude · 웹 검색」
  question: string;
  result: AskResult;
  sources: { domain: string; url: string | null; title: string | null; ours: boolean }[];
  answer: string;           // 앞부분만
};

export type AskPlace = {
  method: string; where: string; auto: boolean;
  n: number; named: number; cited: number; first: string | null; last: string | null;
};
export type AskDay = { day: string; places: AskPlace[] };

export type AskGrid = {
  where: string;
  days: string[];
  rows: { promptId: string; question: string; cells: (AskResult | null)[] }[];
};

const KST = 9 * 3600 * 1000;
const hhmm = (d: Date) => new Date(d.getTime() + KST).toISOString().slice(11, 16);

/** 방법 이름을 사람 말로. 자동인지(시각이 믿을 만한지)도 같이 */
export function whereOf(engine: string, method: string): { where: string; auto: boolean } {
  const who = engineName(engine);
  if (method === "claude-code-headless-websearch") return { where: `${who} · 웹 검색`, auto: true };
  if (method.startsWith("api-")) return { where: `${who} · API`, auto: true };
  if (method.endsWith("-web-logged-out")) return { where: `${who} 화면 · 로그아웃`, auto: true };   // ai-web-measure.mjs (Playwright)
  if (method === "claude-code-websearch") return { where: `${who} · 웹 검색 (손으로)`, auto: false };
  return { where: `${who} (손으로)`, auto: false };
}

/**
 * 곳마다 어떻게 쟀나 — 보고서·화면에 그대로 적는 말 (academy/scripts/case-report.mjs 방법글 과 같은 말).
 * Claude 는 claude.ai 화면이 아니라 Claude Code(Max) 웹 검색을 거친다. 그 차이를 숨기지 않는다
 */
export function howOf(method: string): string {
  if (method.endsWith("-web-logged-out")) return "로그아웃 화면 · 한국어(ko-KR) · 하루 1회";
  if (method === "claude-code-headless-websearch") return "Claude Code(Max) 웹 검색 경유 — claude.ai 화면과 다를 수 있음 · 하루 1회";
  if (method.startsWith("api-")) return "API 경유 — 소비자 화면이 아님";
  return "손으로 잰 기록";
}

export type WeekPlace = {
  method: string; where: string; how: string;
  first: string; last: string; days: number; n: number; kept: number;
  /** 최근 7일 이 곳 합계 — 물어본 횟수 n 중 이름이나 링크가 나온 k */
  week: { n: number; k: number };
};
export type WeekRates = {
  places: WeekPlace[];
  rows: { promptId: string; question: string; cells: ({ n: number; k: number } | null)[] }[];
};

/**
 * 반복 비율 (Step 23 D3). 한 번 나온 것을 적중으로 치지 않는다 — 질문×곳마다 「최근 7일 n번 중 k번」.
 * 합계도 곳별로만. places 는 전체 기간의 방법·기간·표본(원문 보관 수 포함), rows 는 최근 7일.
 */
export async function readWeekRates(client: Client): Promise<WeekRates> {
  const [all, week] = await Promise.all([
    pool().query(
      `select collection_method as method, max(engine) as engine, count(*)::int as n,
              count(distinct measured_on)::int as days, min(measured_on)::text as first, max(measured_on)::text as last,
              count(*) filter (where raw is not null)::int as kept
         from academy.ai_measurements where client_id = $1 group by 1 order by 1`, [client.id]),
    pool().query(
      `select prompt_id, max(prompt_text) as q, collection_method as method,
              count(*)::int as n, count(*) filter (where mentioned or cited)::int as k
         from academy.ai_measurements
        where client_id = $1 and measured_on > (now() at time zone 'Asia/Seoul')::date - 7
        group by 1, 3`, [client.id]),
  ]);
  const inWeek = new Set(week.rows.map((x) => x.method as string));
  const places: WeekPlace[] = all.rows.map((x) => {
    const mine = week.rows.filter((w) => w.method === x.method);
    return {
      method: x.method, where: whereOf(x.engine, x.method).where, how: howOf(x.method),
      first: x.first, last: x.last, days: x.days, n: x.n, kept: x.kept,
      week: { n: mine.reduce((a, w) => a + w.n, 0), k: mine.reduce((a, w) => a + w.k, 0) },
    };
  });
  const cols = places.filter((p) => inWeek.has(p.method)).map((p) => p.method);
  const qs = new Map<string, string>();
  for (const w of week.rows) if (!qs.has(w.prompt_id)) qs.set(w.prompt_id, w.q);
  const num = (p: string) => Number(p.replace(/\D/g, "")) || 0;
  return {
    places,
    rows: [...qs.entries()]
      .sort((a, b) => num(a[0]) - num(b[0]) || a[0].localeCompare(b[0]))
      .map(([promptId, question]) => ({
        promptId, question,
        cells: cols.map((m) => {
          const c = week.rows.find((w) => w.prompt_id === promptId && w.method === m);
          return c ? { n: c.n, k: c.k } : null;
        }),
      })),
  };
}

const resultOf = (m: boolean, c: boolean): AskResult => (m && c ? "both" : c ? "cited" : m ? "named" : "none");

export const RESULT_TEXT: Record<AskResult, string> = {
  both: "이름 + 우리 링크",
  cited: "우리 링크",
  named: "이름만",
  none: "안 나옴",
};

const host = (s: string) => {
  try { return new URL(s).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};
/** AI 답에서 온 주소라 http(s) 만 링크로 */
const safeUrl = (s: string | null) => (s && /^https?:\/\//i.test(s) ? s : null);

function sourcesOf(raw: unknown, domain: string | null) {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: AskRow["sources"] = [];
  for (const c of arr) {
    const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const url = safeUrl(typeof o.url === "string" ? o.url : typeof o.uri === "string" ? o.uri : typeof c === "string" ? c : null);
    const d = (typeof o.domain === "string" && o.domain) || (url ? host(url) : "");
    if (!d) continue;
    const k = url ?? d;
    if (seen.has(k)) continue;
    seen.add(k);
    const ours = !!domain && (d === domain || d.endsWith(`.${domain}`));
    out.push({ domain: d, url, title: typeof o.title === "string" ? o.title : null, ours });
  }
  return out;
}

const answerOf = (raw: unknown, max: number) => {
  const a = raw && typeof raw === "object" ? (raw as Record<string, unknown>).answer : null;
  // 답은 마크다운으로 온다. 화면에서는 기호를 걷어 사람이 읽는 글로
  const t = typeof a === "string"
    ? a.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)").trim()
    : "";
  return t.length > max ? t.slice(0, max) + "…" : t;
};

/** 측정한 날 목록 — 최근 것부터. 날마다 곳별로 따로 */
export async function readAskDays(client: Client, limit = 120): Promise<AskDay[]> {
  const r = await pool().query(
    `select measured_on::text as day, collection_method as method, max(engine) as engine,
            count(*)::int as n, count(*) filter (where mentioned)::int as named, count(*) filter (where cited)::int as cited,
            min(imported_at) as first, max(imported_at) as last
       from academy.ai_measurements where client_id = $1
      group by 1, 2 order by 1 desc`, [client.id]);
  const by = new Map<string, AskDay>();
  for (const x of r.rows) {
    const w = whereOf(x.engine, x.method);
    const d: AskDay = by.get(x.day) ?? { day: x.day, places: [] };
    d.places.push({
      method: x.method, where: w.where, auto: w.auto, n: x.n, named: x.named, cited: x.cited,
      first: w.auto ? hhmm(new Date(x.first)) : null, last: w.auto ? hhmm(new Date(x.last)) : null,
    });
    by.set(x.day, d);
  }
  const days = [...by.values()].slice(0, limit);
  // 자동으로 매일 도는 곳을 앞에
  // 순서를 고정한다 — 매일 도는 Claude 측정이 늘 대표. 나머지는 이름순 (쿼리 순서에 기대면 대표가 날마다 바뀐다)
  const rank = (p: AskPlace) => (p.method === "claude-code-headless-websearch" ? 0 : p.auto ? 1 : 2);
  for (const d of days) d.places.sort((a, b) => rank(a) - rank(b) || b.n - a.n || a.method.localeCompare(b.method));
  return days;
}

/** 대표 곳 — 가장 최근 날의 첫 자동 측정. 격자와 현황판 목록이 이 곳 하나만 본다 */
export const mainMethod = (days: AskDay[]) => days[0]?.places[0]?.method ?? null;

/** 그날 물어본 질문 — 물어본 순서대로. method 를 주면 그 곳만 */
export async function readAsks(client: Client, day: string, answerMax = 1500, method?: string): Promise<AskRow[]> {
  const r = await pool().query(
    `select id::text, measured_on::text as day, engine, collection_method as method, prompt_text,
            mentioned, cited, citations, raw, imported_at
       from academy.ai_measurements
      where client_id = $1 and measured_on = $2 and ($3::text is null or collection_method = $3)
      order by collection_method, imported_at, id`, [client.id, day, method ?? null]);
  return r.rows.map((x) => {
    const w = whereOf(x.engine, x.method);
    return {
      id: x.id,
      day: x.day,
      time: w.auto ? hhmm(new Date(x.imported_at)) : null,
      method: x.method,
      where: w.where,
      question: x.prompt_text,
      result: resultOf(!!x.mentioned, !!x.cited),
      sources: sourcesOf(x.citations, client.domain),
      answer: answerOf(x.raw, answerMax),
    };
  });
}

export type ProbeGrid = {
  days: string[];
  rows: { promptId: string; question: string; form: "sentence" | "keyword"; radius: string; where: string; cells: (AskResult | null)[] }[];
};

/**
 * 넓혀 본 질문(탐침) — 개선 루프가 동네 질문을 「송파」「서울」「동네 없이」로 넓히거나 검색어형(「송파구 코딩학원 추천」)으로 만든 것.
 * 따로 표(academy.ai_probe_questions · ai_probe_measurements)라 승인 20문항 숫자와 안 섞인다.
 * 한 줄 = 탐침 하나 × 곳 하나. 아직 안 잰 탐침도 보인다. 표가 없으면 null
 */
export async function readProbeGrid(client: Client, days = 14): Promise<ProbeGrid | null> {
  const t = await pool().query(`select to_regclass('academy.ai_probe_questions')::text as q, to_regclass('academy.ai_probe_measurements')::text as m`);
  if (!t.rows[0]?.q) return null;
  const probes = await pool().query(
    `select prompt_id, text, coalesce(form,'sentence') as form, coalesce(radius,'') as radius
       from academy.ai_probe_questions where client_id = $1 and active order by id`, [client.id]);
  const r = t.rows[0].m ? await pool().query(
    `select measured_on::text as day, prompt_id, collection_method as method, max(engine) as engine,
            bool_or(mentioned) as m, bool_or(cited) as c
       from academy.ai_probe_measurements
      where client_id = $1 and measured_on > (now() at time zone 'Asia/Seoul')::date - $2::int
      group by 1, 2, 3`, [client.id, days]) : { rows: [] as { day: string; prompt_id: string; method: string; engine: string; m: boolean; c: boolean }[] };
  const ds = [...new Set(r.rows.map((x) => x.day as string))].sort();
  const rows: ProbeGrid["rows"] = [];
  for (const p of probes.rows) {
    const mine = r.rows.filter((x) => x.prompt_id === p.prompt_id);
    const methods = [...new Set(mine.map((x) => x.method as string))];
    const base = { promptId: p.prompt_id, question: p.text, form: (p.form === "keyword" ? "keyword" : "sentence") as "sentence" | "keyword", radius: p.radius };
    if (!methods.length) { rows.push({ ...base, where: "아직 안 잼", cells: ds.map(() => null) }); continue; }
    for (const m of methods) {
      const cells = new Map(mine.filter((x) => x.method === m).map((x) => [x.day as string, resultOf(!!x.m, !!x.c)]));
      rows.push({ ...base, where: whereOf(mine.find((x) => x.method === m)?.engine ?? "", m).where, cells: ds.map((d) => cells.get(d) ?? null) });
    }
  }
  return { days: ds, rows };
}

/** 한 곳에서 질문별 최근 며칠 — 같은 질문이 날마다 어떻게 나왔나. 곳을 섞지 않는다 */
export async function readAskGrid(client: Client, method: string, days = 14): Promise<AskGrid> {
  const r = await pool().query(
    `select measured_on::text as day, prompt_id, max(prompt_text) as q, max(engine) as engine,
            bool_or(mentioned) as m, bool_or(cited) as c
       from academy.ai_measurements
      where client_id = $1 and collection_method = $2
        and measured_on > (now() at time zone 'Asia/Seoul')::date - $3::int
      group by 1, 2`, [client.id, method, days]);
  const ds = [...new Set(r.rows.map((x) => x.day as string))].sort();
  const qs = new Map<string, { question: string; cells: Map<string, AskResult> }>();
  for (const x of r.rows) {
    const e = qs.get(x.prompt_id) ?? { question: x.q, cells: new Map() };
    e.cells.set(x.day, resultOf(!!x.m, !!x.c));
    qs.set(x.prompt_id, e);
  }
  const num = (p: string) => Number(p.replace(/\D/g, "")) || 0;
  return {
    where: whereOf(r.rows[0]?.engine ?? "", method).where,
    days: ds,
    rows: [...qs.entries()]
      .sort((a, b) => num(a[0]) - num(b[0]) || a[0].localeCompare(b[0]))
      .map(([promptId, e]) => ({ promptId, question: e.question, cells: ds.map((d) => e.cells.get(d) ?? null) })),
  };
}
