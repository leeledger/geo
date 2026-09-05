/**
 * Neon Postgres 연결.
 *
 * web/ 의 GEO 프로젝트와 같은 DATABASE_URL 을 써도 되고 따로 써도 된다.
 * 테이블은 academy 스키마 안에 있어 geo 스키마와 충돌하지 않는다.
 */
import { Pool } from "pg";

const DSN = process.env.DATABASE_URL;
export const dbEnabled = Boolean(DSN);

// 서버리스에서 요청마다 모듈이 재평가되면 풀이 계속 생긴다. globalThis 에 캐시한다.
const g = globalThis as unknown as { __academyPool?: Pool };

/**
 * TLS 를 코드에서 정한다.
 * pg 8.23+ 는 연결 문자열의 sslmode 해석이 바뀌었다고 경고하므로 DSN 에서 떼어낸다.
 * Neon 은 인증서 검증이 정상 동작하므로 rejectUnauthorized 를 켠 채로 둔다.
 */
function connConfig(dsn: string) {
  const u = new URL(dsn);
  u.searchParams.delete("sslmode");
  return {
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  };
}

export function pool(): Pool | null {
  if (!DSN) return null;
  g.__academyPool ??= new Pool(connConfig(DSN));
  return g.__academyPool;
}

export async function q<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const p = pool();
  if (!p) return [];
  const r = await p.query(text, params);
  return r.rows as T[];
}
