import { Pool } from "pg";
import { createHash } from "node:crypto";

/**
 * 고객사 서버가 보내는 크롤러 방문 기록.
 *
 * 로봇&코딩학원은 사이트가 이 저장소에 있어 자기 서버에서 바로 DB 에 쓴다.
 * 아이로그처럼 사이트가 밖에 있는 고객사에 우리 DB 주소를 넘길 수는 없다.
 * 그래서 고객사 서버는 봇 판별만 하고 이리로 보내며, 여기서 고객사 키를 확인하고 쓴다.
 * 키가 새어도 할 수 있는 일은 가짜 방문 기록을 넣는 것뿐이다.
 */

const g = globalThis as unknown as { __crawlPool?: Pool };

function pool(): Pool {
  if (!g.__crawlPool) {
    const dsn = process.env.DATABASE_URL;
    if (!dsn) throw new Error("DATABASE_URL 없음");
    const u = new URL(dsn);
    u.searchParams.delete("sslmode");
    g.__crawlPool = new Pool({
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
      max: 3,
    });
  }
  return g.__crawlPool;
}

/** 키 확인 결과를 잠깐 들고 있는다. 크롤러가 몰려오면 방문마다 조회하게 된다. */
const cache = new Map<string, { id: number | null; at: number }>();

export async function clientForKey(slug: string, key: string): Promise<number | null> {
  if (!slug || !key) return null;
  const k = `${slug}|${key}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.id;
  const { rows } = await pool().query(
    `select id from geo.clients where slug = $1 and crawl_key = $2 and status <> 'ended'`, [slug, key]);
  const id = rows[0]?.id ?? null;
  cache.set(k, { id, at: Date.now() });
  if (cache.size > 200) cache.clear();
  return id;
}

export async function saveHit(clientId: number, b: { bot: string; vendor?: string; path: string; ua?: string; ip?: string }) {
  const salt = process.env.IP_HASH_SALT ?? "cited";
  const ipHash = b.ip
    ? createHash("sha256").update(salt + String(b.ip).split(",")[0].trim()).digest("hex").slice(0, 32)
    : null;
  await pool().query(
    `insert into academy.crawl_hits (client_id, bot, vendor, path, ua, ip_hash) values ($1,$2,$3,$4,$5,$6)`,
    [clientId, String(b.bot).slice(0, 60), String(b.vendor ?? "").slice(0, 40),
     String(b.path).slice(0, 300), String(b.ua ?? "").slice(0, 500), ipHash],
  );
}
