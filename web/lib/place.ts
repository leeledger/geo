import { pool } from "./ops";

/**
 * 랜딩 도입 사례의 네이버 플레이스 순위 — 「구 + 코딩학원」 검색어 하나.
 *
 * 측정일을 같이 준다. 오래된 순위를 날짜 없이 걸면 지금 순위처럼 읽힌다
 * (9/09 뒤로 측정이 멈췄는데 랜딩은 날짜 없이 「2위」를 띄우고 있었다).
 * FRESH_DAYS 안에 잰 것만 준다. 없거나 못 읽으면 null — 화면은 그 칸을 숨긴다.
 */
export const PLACE_FRESH_DAYS = 14;

export async function readPlaceRank(): Promise<{ rank: number; day: string } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { rows } = await pool().query(
      `select p.rank::int as rank, p.day::text as day
         from academy.place_checks p
         join geo.clients c on c.id = p.client_id
        where c.status <> 'ended' and p.rank is not null and p.query ~ '구 코딩학원$'
          and p.day >= (now() at time zone 'Asia/Seoul')::date - $1::int
        order by c.started_on, c.id, p.day desc
        limit 1`,
      [PLACE_FRESH_DAYS]);
    return rows[0] ? { rank: rows[0].rank, day: rows[0].day } : null;
  } catch (e) {
    console.error("플레이스 순위 읽기 실패", e);
    return null;
  }
}
