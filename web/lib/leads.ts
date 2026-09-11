/**
 * 리드·진단 이력 저장.
 *
 * DATABASE_URL 이 있으면 Postgres 에, 없으면 로컬 파일(.data/*.jsonl)에 쓴다.
 * 파일 폴백은 개발용이다 — Vercel 같은 서버리스에서는 파일이 유지되지 않는다.
 *
 * Postgres 면 어디든 붙는다:
 *   - 기존 Supabase 프로젝트  (Settings → Database → Connection string / Pooler)
 *   - Neon, Vercel Postgres, Railway, 자체 호스팅
 * 테이블은 `geo` 스키마 안에 두므로 기존 프로젝트와 이름이 충돌하지 않는다.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const DSN = process.env.DATABASE_URL;
export const dbEnabled = Boolean(DSN);

const DATA_DIR = path.join(process.cwd(), ".data");

/**
 * 서버리스에서는 요청마다 모듈이 재평가될 수 있어 풀이 계속 생긴다.
 * globalThis 에 캐시해 커넥션 누수를 막는다. 반드시 Pooler(6543) 연결 문자열을 쓸 것.
 */
const g = globalThis as unknown as { __geoPool?: Pool };

/**
 * TLS 설정을 코드에서 정한다.
 * 연결 문자열의 sslmode 는 제거한다 — pg 8.23+ 가 해석 방식이 바뀌었다고 경고를 내고,
 * 어차피 여기서 명시하므로 두 곳에서 관리할 이유가 없다.
 * 기본은 인증서 검증 켜짐. 자체 서명 인증서를 쓰는 자체 호스팅이면
 * DATABASE_SSL_INSECURE=true 로만 끈다.
 */
function connConfig(dsn: string) {
  const local = /localhost|127\.0\.0\.1/.test(dsn);
  let url = dsn;
  try {
    const u = new URL(dsn);
    u.searchParams.delete("sslmode");
    url = u.toString();
  } catch { /* 파싱 실패하면 원문 그대로 */ }
  return {
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
  };
}

function pool(): Pool {
  if (!g.__geoPool) {
    g.__geoPool = new Pool({
      ...connConfig(DSN!),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    g.__geoPool.on("error", (e) => console.error("[db] idle client error:", e.message));
  }
  return g.__geoPool;
}

/** IP 는 원문으로 남기지 않는다. 중복·남용 판별에만 쓰는 해시. */
export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? "siteband-dev-salt";
  return createHash("sha256").update(salt + "|" + ip).digest("hex").slice(0, 32);
}

/** 파일 폴백 — 개발 환경에서만 의미가 있다 */
function appendFile(table: string, row: Record<string, unknown>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const rec = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    fs.appendFileSync(path.join(DATA_DIR, `${table}.jsonl`), JSON.stringify(rec) + "\n", "utf8");
    return rec.id;
  } catch (e: any) {
    console.error("[db] 파일 폴백 실패:", e?.message);
    return null;
  }
}

export async function saveScan(input: {
  origin: string; total: number; grade: string;
  checks: unknown; notes: unknown;
  ip: string; userAgent: string | null; referrer: string | null;
}): Promise<string | null> {
  const row = {
    origin: input.origin, total: input.total, grade: input.grade,
    checks: input.checks, notes: input.notes,
    ip_hash: hashIp(input.ip),
    user_agent: input.userAgent?.slice(0, 300) ?? null,
    referrer: input.referrer?.slice(0, 300) ?? null,
  };
  if (!dbEnabled) return appendFile("scans", row);

  try {
    const { rows } = await pool().query(
      `insert into geo.scans (origin, total, grade, checks, notes, ip_hash, user_agent, referrer)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [row.origin, row.total, row.grade, JSON.stringify(row.checks), JSON.stringify(row.notes),
       row.ip_hash, row.user_agent, row.referrer],
    );
    return rows[0]?.id ?? null;
  } catch (e: any) {
    console.error("[db] scans insert 실패:", e?.message);
    return null;
  }
}

export async function saveLead(input: {
  scanId: string | null; email: string;
  company?: string | null; name?: string | null; phone?: string | null;
  wants?: string | null;
  /** 어떻게 알고 왔는지 — 매출 검증의 유일한 고리 */
  referral?: string | null;
  concerns?: string | null; competitor?: string | null; site?: string | null;
  ip: string;
}): Promise<string | null> {
  const row = {
    scan_id: input.scanId,
    email: input.email.trim().slice(0, 200),
    company: input.company?.slice(0, 120) || null,
    name: input.name?.slice(0, 60) || null,
    phone: input.phone?.slice(0, 40) || null,
    wants: input.wants?.slice(0, 60) || null,
    referral: input.referral?.slice(0, 40) || null,
    concerns: input.concerns?.slice(0, 400) || null,
    competitor: input.competitor?.slice(0, 200) || null,
    site: input.site?.slice(0, 200) || null,
    ip_hash: hashIp(input.ip),
    source: input.referral ? "contact" : "free_scan",
  };
  if (!dbEnabled) return appendFile("leads", row);

  try {
    const { rows } = await pool().query(
      `insert into geo.leads (scan_id, email, company, name, phone, wants, referral, concerns, competitor, site, ip_hash, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [row.scan_id, row.email, row.company, row.name, row.phone, row.wants,
       row.referral, row.concerns, row.competitor, row.site, row.ip_hash, row.source],
    );
    return rows[0]?.id ?? null;
  } catch (e: any) {
    // 42703 = 없는 열. schema.sql 의 alter 를 아직 안 돌린 DB 다.
    // 리드를 버리면 안 되므로 옛 열로 넣고, 경로만은 wants 뒤에 붙여 살린다.
    if (e?.code !== "42703") {
      console.error("[db] leads insert 실패:", e?.message);
      return null;
    }
    console.warn("[db] geo.leads 에 새 열이 없습니다. npm run setup-db 를 돌리세요.");
    const wants = [row.wants, row.referral && `경로:${row.referral}`].filter(Boolean).join(" · ").slice(0, 60) || null;
    try {
      const { rows } = await pool().query(
        `insert into geo.leads (scan_id, email, company, name, phone, wants, ip_hash, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [row.scan_id, row.email, row.company ?? row.site, row.name, row.phone, wants, row.ip_hash, row.source],
      );
      return rows[0]?.id ?? null;
    } catch (e2: any) {
      console.error("[db] leads insert 실패:", e2?.message);
      return null;
    }
  }
}

/** 관리자 화면용 — 리드와 진단 점수를 붙여서 최근순으로 */
export async function listLeads(limit = 100) {
  if (!dbEnabled) {
    try {
      const f = path.join(DATA_DIR, "leads.jsonl");
      if (!fs.existsSync(f)) return [];
      const leads = fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const sf = path.join(DATA_DIR, "scans.jsonl");
      const scans = fs.existsSync(sf)
        ? new Map(fs.readFileSync(sf, "utf8").trim().split("\n").filter(Boolean)
            .map((l) => JSON.parse(l)).map((s: any) => [s.id, s]))
        : new Map();
      return leads.reverse().slice(0, limit).map((l: any) => {
        const s: any = scans.get(l.scan_id);
        return { ...l, origin: s?.origin ?? null, site_score: s?.total ?? null, grade: s?.grade ?? null };
      });
    } catch { return []; }
  }
  try {
    const { rows } = await pool().query(
      // l.* — referral 등 새 열이 있는 DB 와 없는 DB 둘 다에서 돈다
      `select l.*, s.origin, s.total as site_score, s.grade
         from geo.leads l
         left join geo.scans s on s.id = l.scan_id
        order by l.created_at desc
        limit $1`, [limit]);
    return rows;
  } catch (e: any) {
    console.error("[db] listLeads 실패:", e?.message);
    return [];
  }
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
