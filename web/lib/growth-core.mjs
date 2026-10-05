/**
 * 문서딱 저장소(leeledger/doc-tools-kr)의 주간 성장 리포트 읽기 — 가져오기(academy/scripts/growth-import.mjs)·
 * 화면(web/lib/growth-reports.ts)·리포트(academy/scripts/pilot-report.mjs)가 같이 쓰는 순수 함수와 표 (Step 36).
 *
 * 리포트는 그쪽 scripts/ops/lib/report.mjs renderReport 가 쓴다. 우리는 고치지 않고 읽기만 한다.
 * 합계는 리포트 끝 growth-data JSON 값을 그대로 쓴다(우리가 다시 셈하지 않는다).
 * 표(상위 쿼리·페이지)는 리포트가 반올림해 찍은 값이다 — CTR 은 소수 한 자리 %, 순위는 소수 한 자리.
 */

/** geo.growth_reports — academy/db/schema.sql · web/db/schema.sql 과 같은 줄 */
export const GROWTH_DDL = [
  `create table if not exists geo.growth_reports (
  client_id int not null references geo.clients(id),
  week text not null,
  generated date,
  source_url text not null,
  gsc jsonb,
  gsc_queries7 jsonb,
  gsc_queries28 jsonb,
  gsc_pages28 jsonb,
  cf jsonb,
  notes text,
  opportunity jsonb,
  fetched_at timestamptz not null default now(),
  primary key (client_id, week))`,
  `alter table geo.growth_reports enable row level security`,
];

/** doc-tools-kr scripts/ops/lib/report.mjs 의 MARK 그대로 */
const MARK = /<!-- growth-data (\{.*\}) -->/;
const WEEK = /^\d{4}-\d{2}$/;

/** renderReport 의 rowsTable 머리 그대로. 이 두 줄이 아니면 그 표는 안 읽는다(null) */
const TABLES = [
  { key: "queries7", title: "### 상위 쿼리 (7일)", head: "| 쿼리 | 클릭 | 노출 | CTR | 평균 순위 |" },
  { key: "queries28", title: "### 상위 쿼리 (28일)", head: "| 쿼리 | 클릭 | 노출 | CTR | 평균 순위 |" },
  { key: "pages28", title: "### 상위 페이지 (28일)", head: "| 페이지 | 클릭 | 노출 | CTR | 평균 순위 |" },
];
const RULE5 = "|---|---:|---:|---:|---:|";

/**
 * 표 한 줄을 칸으로. 그쪽 cell() 이 칸 안의 세로줄을 「\|」로 바꿔 쓴다 — 그건 칸 구분이 아니다
 */
export function splitRow(line) {
  const s = line.trim();
  if (!s.startsWith("|") || !s.endsWith("|")) return null;
  const cells = [];
  let cur = "";
  for (let i = 1; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (ch === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  return cells;
}

/** 「1,234」→ 1234 · 「12.5%」→ 0.125 · 「-」→ null. 못 읽으면 undefined */
const 수 = (s) => (/^-?\d[\d,]*(\.\d+)?$/.test(s) ? Number(s.replace(/,/g, "")) : undefined);
const 비율 = (s) => (/^\d+(\.\d+)?%$/.test(s) ? Number(s.slice(0, -1)) / 100 : undefined);
const 순위 = (s) => (s === "-" ? null : 수(s));

/** 머리줄 아래 행들. 머리가 다르거나 행 하나라도 못 읽으면 null — 반쯤 읽은 표는 틀린 표다 */
function readTable(lines, { title, head }, cols) {
  const i = lines.findIndex((l) => l.trim() === title);
  if (i < 0 || lines[i + 1]?.trim() !== head) return null;
  const rows = [];
  for (let j = i + 3; j < lines.length && lines[j].trim().startsWith("|"); j++) {
    const c = splitRow(lines[j]);
    if (!c) return null;
    // 행이 없으면 그쪽이 「| (데이터 없음) | | | | |」 한 줄을 찍는다
    if (c[0] === "(데이터 없음)" && c.slice(1).every((x) => x === "")) continue;
    const r = cols(c);
    if (!r) return null;
    rows.push(r);
  }
  return lines[i + 2]?.trim().startsWith("|---") ? rows : null;
}

const gscRow = (c) => {
  if (c.length !== 5) return null;
  const r = { key: c[0], clicks: 수(c[1]), impressions: 수(c[2]), ctr: 비율(c[3]), position: 순위(c[4]) };
  return [r.clicks, r.impressions, r.ctr, r.position].includes(undefined) ? null : r;
};

const 숫자 = (v) => typeof v === "number" && Number.isFinite(v);
const 날짜 = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** 화면(GrowthReport.tsx)·pilot-report 가 읽는 칸: range7 두 날짜 · last7 네 숫자 */
const gscShape = (g) => 날짜(g?.range7?.startDate) && 날짜(g?.range7?.endDate) && ["clicks", "impressions", "ctr", "position"].every((k) => 숫자(g?.last7?.[k]));
/** until · last7 네 숫자 */
const cfShape = (c) => 날짜(c?.until) && ["requests", "pageViews", "uniques", "days"].every((k) => 숫자(c?.last7?.[k]));

/**
 * 리포트 마크다운 → 한 주 행.
 * growth-data 표지가 없거나 JSON 이 깨지면 던진다(그 주는 안 쓴다). gsc·cf 는 JSON 값 그대로(null 이면 null).
 * 표 3개는 제목·머리줄이 맞을 때만, 아니면 그 칸 null. 「> 」 메모 줄(비밀값 빠짐 등)은 notes.
 */
export function parseGrowthReport(md) {
  const text = String(md ?? "");
  const m = MARK.exec(text);
  if (!m) throw new Error("growth-data 표지 없음");
  let data;
  try { data = JSON.parse(m[1]); } catch (e) { throw new Error(`growth-data JSON 깨짐: ${e.message}`); }
  if (!data || typeof data !== "object" || !WEEK.test(String(data.week))) throw new Error(`growth-data 주 표시가 이상함: ${String(data?.week)}`);
  const lines = text.split(/\r?\n/);
  // 화면·pilot-report 가 읽는 칸이 다 있을 때만 쓴다. 하나라도 빠지면 그 덩어리만 비우고 「모양 다름」을 남긴다
  const odd = [];
  const gsc = data.gsc == null ? null : gscShape(data.gsc) ? data.gsc : (odd.push("서치콘솔 JSON 모양 다름(range7·last7 칸)"), null);
  const cf = data.cf == null ? null : cfShape(data.cf) ? data.cf : (odd.push("Cloudflare JSON 모양 다름(until·last7 칸)"), null);
  const memo = lines.filter((l) => l.startsWith("> ")).map((l) => l.slice(2).trim());
  const out = {
    week: data.week,
    generated: typeof data.generated === "string" ? data.generated : null,
    gsc,
    cf,
    notes: [...memo, ...odd].join("\n") || null,
    odd,
  };
  for (const t of TABLES) out[t.key] = readTable(lines, t, gscRow);
  return out;
}

const 이슈제목 = /^새 안내 페이지 후보 (\d{4}-\d{2}): (\d+)개$/;

/** 이슈 본문의 「## 제목」 절 아래 표. 「없음.」이면 빈 배열, 머리가 다르면 null */
function issueSection(lines, titleStart, head, cols) {
  const i = lines.findIndex((l) => l.startsWith(`## ${titleStart}`));
  if (i < 0) return null;
  if (lines[i + 1]?.trim() === "없음.") return [];
  if (lines[i + 1]?.trim() !== head || !lines[i + 2]?.trim().startsWith("|---")) return null;
  const rows = [];
  for (let j = i + 3; j < lines.length && lines[j].trim().startsWith("|"); j++) {
    const r = cols(splitRow(lines[j]) ?? []);
    if (!r) return null;
    rows.push(r);
  }
  return rows;
}
const 없음 = (s, word) => (s === word ? null : s);

/**
 * A-6 「새 안내 페이지 후보」 이슈(GitHub API 이슈 한 건) → 화면에 실을 꼴.
 * 제목이 「새 안내 페이지 후보 YYYY-WW: N개」가 아니면 주·건수 null — 주소·갱신 날짜는 살린다.
 * 본문 표(그쪽 opportunities.mjs issueBody)는 머리가 맞을 때만
 */
export function parseOpportunityIssue(issue) {
  const t = 이슈제목.exec(String(issue?.title ?? "").trim());
  const lines = String(issue?.body ?? "").split(/\r?\n/);
  const lowCtr = issueSection(lines, "노출은 많은데 클릭이 적은 쿼리", "| 쿼리 | 노출 | 클릭 | CTR | 순위 | 지금 받는 안내 | 추천 도구 |", (c) => {
    if (c.length !== 7) return null;
    const r = { query: c[0], impressions: 수(c[1]), clicks: 수(c[2]), ctr: 비율(c[3]), position: 수(c[4]), guide: 없음(c[5], "없음"), tool: 없음(c[6], "-") };
    return [r.impressions, r.clicks, r.ctr, r.position].includes(undefined) ? null : r;
  });
  const uncovered = issueSection(lines, "안내 페이지가 없는 쿼리", "| 쿼리 | 노출 | 클릭 | 순위 | 추천 도구 |", (c) => {
    if (c.length !== 5) return null;
    const r = { query: c[0], impressions: 수(c[1]), clicks: 수(c[2]), position: 수(c[3]), tool: 없음(c[4], "-") };
    return [r.impressions, r.clicks, r.position].includes(undefined) ? null : r;
  });
  return {
    week: t?.[1] ?? null,
    count: t ? Number(t[2]) : null,
    url: issue?.html_url ?? null,
    updatedAt: issue?.updated_at ?? null,
    lowCtr,
    uncovered,
  };
}

/** 목록의 파일 이름 「2026-41.md」 → 「2026-41」. 리포트가 아니면 null */
export const weekOfName = (name) => /^(\d{4}-\d{2})\.md$/.exec(String(name ?? ""))?.[1] ?? null;

/**
 * 받을 주 — 목록에 있고 DB 에 없는 주. 커밋된 리포트는 안 바뀌니 있는 주는 다시 안 받는다.
 * 최근 주부터 max 개 — 한 번에 다 못 받으면 남은 옛 주는 다음 날 이어 받는다
 */
export function weeksToFetch(listed, stored, max = 8) {
  const have = new Set(stored);
  return [...new Set(listed)].filter((w) => WEEK.test(w) && !have.has(w)).sort().reverse().slice(0, max);
}

/** ISO 주 「YYYY-WW」의 월요일(UTC 날짜 문자열) — 그쪽 report.mjs weekMonday 와 같은 셈 */
export function weekMonday(label) {
  const [y, w] = String(label).split("-").map(Number);
  const jan4 = Date.UTC(y, 0, 4);
  const dayNum = new Date(jan4).getUTCDay() || 7;
  return new Date(jan4 - (dayNum - 1) * 86_400_000 + (w - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

/** GitHub 시각(UTC ISO) → KST 날짜 「YYYY-MM-DD」. KST 00~09시 갱신이 하루 전으로 찍히지 않게. 못 읽으면 null */
export function kstDay(iso) {
  const t = Date.parse(String(iso ?? ""));
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 리포트가 멈췄나 — 마지막 리포트 생성일(없으면 그 주 월요일)에서 오늘(KST 날짜)까지 9일 넘음 */
export function reportStalled(latest, today) {
  if (!latest) return false;
  const from = latest.generated ?? weekMonday(latest.week);
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > 9;
}

/**
 * 성장 리포트를 읽는 고객 — academy/clients.mjs growthReports 가 있는 슬러그와 같아야 한다(시험이 맞춰 본다).
 * 웹은 clients.mjs 를 안 읽어서 여기 둔다. 이 탭에는 행이 없어도 카드(「첫 리포트 전」)를 띄운다
 */
export const GROWTH_SLUGS = ["docttak"];

/** 화면·리포트 꼬리 두 줄 — 「방문자」라는 말을 쓰지 않는다(봇이 섞인 서버 숫자다) */
export const GROWTH_FOOT = [
  "Cloudflare 요청·페이지뷰는 봇을 포함합니다. 순방문자는 하루 단위 합이라 같은 사람이 여러 번 셉니다.",
  "구글 숫자는 3일 늦게 확정됩니다 · 출처: github.com/leeledger/doc-tools-kr reports/growth",
];
