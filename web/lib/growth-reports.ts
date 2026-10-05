import { pool } from "./ops";
import { reportStalled, type GrowthCf, type GrowthGsc, type GscRow, type Opportunity } from "./growth-core.mjs";

/**
 * 「문서딱 주간 성장」 카드 읽기 (Step 36). 쓰기는 academy/scripts/growth-import.mjs 가 매일 한 번.
 * 숫자는 문서딱 저장소 리포트 값 그대로다 — 없는 주를 0 으로 채우지 않는다.
 */

export type GrowthWeek = {
  week: string;
  generated: string | null;
  sourceUrl: string;
  gsc: GrowthGsc | null;
  cf: GrowthCf | null;
  queries28: GscRow[] | null;
  pages28: GscRow[] | null;
  notes: string | null;
};

export type GrowthReports =
  | { ok: true; weeks: GrowthWeek[]; today: string; stalled: boolean; opportunity: Opportunity | null }
  | { ok: false; err: string };

const noTable = (e: unknown) => (e as { code?: string })?.code === "42P01";

type Row = {
  week: string; generated: string | null; source_url: string; gsc: GrowthGsc | null; cf: GrowthCf | null;
  gsc_queries28: GscRow[] | null; gsc_pages28: GscRow[] | null; notes: string | null; opportunity: Opportunity | null; today: string;
};

/** 최근 12주(오래된 것부터). 후보 이슈는 opportunity 가 있는 가장 최근 행의 것 */
export async function readGrowthReports(clientId: number): Promise<GrowthReports> {
  try {
    const { rows } = await pool().query<Row>(
      `select week, generated::text, source_url, gsc, cf, gsc_queries28, gsc_pages28, notes, opportunity,
              (now() at time zone 'Asia/Seoul')::date::text as today
         from geo.growth_reports where client_id = $1 order by week desc limit 12`, [clientId]);
    const today = rows[0]?.today ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const weeks = rows.map((r) => ({
      week: r.week, generated: r.generated, sourceUrl: r.source_url, gsc: r.gsc, cf: r.cf,
      queries28: r.gsc_queries28, pages28: r.gsc_pages28, notes: r.notes,
    })).reverse();
    return {
      ok: true, weeks, today,
      stalled: reportStalled(weeks.at(-1), today),
      opportunity: rows.find((r) => r.opportunity)?.opportunity ?? null,
    };
  } catch (e) {
    if (noTable(e)) return { ok: true, weeks: [], today: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }), stalled: false, opportunity: null };
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}
