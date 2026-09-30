import { pool } from "./ops";

/**
 * 총괄 아침 보고 — academy/scripts/pm-report.mjs 가 geo.pm_reports 에 하루 한 장 남긴다(Step 19).
 * 현황판 맨 위 「오늘 아침 보고」가 읽는다. 오늘 것이 없으면 가장 최근 것을 날짜와 함께 보여 준다.
 *
 * 문장은 스크립트가 틀에 숫자만 넣어 만든 것이다. 여기서 고치지 않는다.
 * 못 읽으면 ok:false — 화면은 「보고를 못 읽었습니다」.
 */

export type PmStatus = "정상" | "주의" | "막힘";

export type PmStaff = { id: string; 이름: string; 한일: string; 성공: number; 실패: number; 지금: string };

export type PmBody = {
  status: PmStatus;
  conclusion: string;
  직원: PmStaff[];
  확인필요: string[];
  원장할일: number;
  산출물: string[];
  다음: string[];
  /** 엔진별 AI 답변 — 2026-09-24 부터. 옛 보고에는 없다 */
  AI답변?: {
    엔진: string; day: string; n: number; 이름: number; 인용: number; 전체?: boolean; 링크없음?: boolean;
    비교: { day: string; 공통: number; 전이름: number; 지금이름: number; 전인용: number; 지금인용: number; 말: string } | null;
  }[];
  /** 학원 밖 고객 한 줄씩 — 2026-09-30(Step 30) 부터. 옛 보고에는 없다 */
  고객별?: { slug: string; name: string; 줄: string }[];
  /** 「확장 질문 n개 중 k개 불림」 — Step 31 부터, 확장 질문이 있는 고객만 */
  확장?: { slug: string; name: string; 줄: string }[];
};

export type PmReport =
  | { ok: true; report: null }
  | { ok: true; report: { day: string; today: boolean; at: string; body: PmBody } }
  | { ok: false; err: string };

export async function readPmReport(): Promise<PmReport> {
  try {
    const { rows } = await pool().query<{ day: string; at: string; body: PmBody; today: boolean }>(
      // day·at 은 SQL 키워드라 별칭에 as 를 꼭 쓴다 — 없으면 구문 오류로 카드가 「못 읽었습니다」가 된다(9/24 첫 배포)
      `select day::text as day, at::text as at, body, day = (now() at time zone 'Asia/Seoul')::date as today
         from geo.pm_reports order by day desc limit 1`,
    );
    const r = rows[0];
    return { ok: true, report: r ? { day: r.day, today: r.today, at: r.at, body: r.body } : null };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    // 표는 회사 루프가 첫 보고를 만들 때 생긴다. 그 전에는 「아직 없음」이지 고장이 아니다
    if (/pm_reports/.test(err) && /does not exist/.test(err)) return { ok: true, report: null };
    return { ok: false, err };
  }
}
