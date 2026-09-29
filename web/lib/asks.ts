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
