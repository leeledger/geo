import { Pool } from "pg";

/**
 * 문의 기록 — 읽기와 상수.
 *
 * "어떻게 알고 오셨어요" 한 마디가 이 사업 검증의 마지막 고리다.
 * AI 답변을 보고 온 사람은 서버 기록에 안 남는다 — 챗 화면에서 이름만 보고
 * 나중에 검색해서 오면 검색에서 온 사람으로 찍힌다.
 * 그래서 사람에게 직접 묻는 것 말고는 방법이 없다.
 *
 * 쓰기(서버 액션)는 inquiry-actions.ts 에 따로 있다.
 * "use server" 모듈은 내보내는 것이 전부 async 함수여야 해서,
 * 상수와 타입을 같이 두면 빌드가 죽는다.
 */

const g = globalThis as unknown as { __inqPool?: Pool };

export function inqPool(): Pool {
  if (!g.__inqPool) {
    const dsn = process.env.DATABASE_URL;
    if (!dsn) throw new Error("DATABASE_URL 없음");
    const u = new URL(dsn);
    u.searchParams.delete("sslmode");
    g.__inqPool = new Pool({
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
      max: 3,
    });
  }
  return g.__inqPool;
}

/** 유입 경로는 고정 목록으로 둔다. 자유 입력만 두면 나중에 셀 수가 없다. */
export const SOURCES = [
  "AI", "네이버검색", "구글검색", "네이버플레이스",
  "블로그", "소개", "간판·전단", "기타",
] as const;

export type Inquiry = {
  id: string;
  day: string;
  source: string;
  said: string;
  channel: string;
  grade: string;
  enrolled: boolean | null;
  note: string;
};

export type Summary = {
  month: string;
  total: number;
  fromSearch: number;
  fromAi: number;
  enrolled: number;
};

export async function listInquiries(limit = 60): Promise<Inquiry[]> {
  try {
    const { rows } = await inqPool().query(
      `select id, day::text, source, said, channel, grade, enrolled, note
         from academy.inquiries order by day desc, created_at desc limit $1`,
      [limit],
    );
    return rows as Inquiry[];
  } catch {
    return [];
  }
}

export async function inquirySummary(): Promise<Summary[]> {
  try {
    const { rows } = await inqPool().query(
      `select month::text, total, from_search, from_ai, enrolled
         from academy.inquiry_summary limit 6`,
    );
    return rows.map((r) => ({
      month: r.month,
      total: r.total,
      fromSearch: r.from_search,
      fromAi: r.from_ai,
      enrolled: r.enrolled,
    }));
  } catch {
    return [];
  }
}
