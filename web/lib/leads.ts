/**
 * 리드·진단 이력 저장.
 *
 * Supabase 환경변수가 있으면 DB에, 없으면 로컬 파일(.data/*.jsonl)에 쓴다.
 * 파일 폴백은 개발용이다 — Vercel 같은 서버리스에서는 파일이 유지되지 않는다.
 * 배포 전에 반드시 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 설정할 것.
 *
 * 의존성 없이 PostgREST 를 직접 호출한다.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dbEnabled = Boolean(URL_ && KEY);

const DATA_DIR = path.join(process.cwd(), ".data");

/** IP 는 원문으로 남기지 않는다. 중복·남용 판별에만 쓰는 해시. */
export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? "siteband-dev-salt";
  return createHash("sha256").update(salt + "|" + ip).digest("hex").slice(0, 32);
}

async function insert<T>(table: string, row: Record<string, unknown>): Promise<T | null> {
  if (dbEnabled) {
    try {
      const res = await fetch(`${URL_}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: KEY!,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error(`[leads] ${table} insert 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const [created] = await res.json();
      return created as T;
    } catch (e: any) {
      console.error(`[leads] ${table} insert 오류:`, e?.message);
      return null;
    }
  }

  // 폴백 — 개발 환경에서만 의미가 있다
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const id = crypto.randomUUID();
    const rec = { id, created_at: new Date().toISOString(), ...row };
    fs.appendFileSync(path.join(DATA_DIR, `${table}.jsonl`), JSON.stringify(rec) + "\n", "utf8");
    return rec as T;
  } catch (e: any) {
    console.error(`[leads] 파일 폴백 실패:`, e?.message);
    return null;
  }
}

export async function saveScan(input: {
  origin: string; total: number; grade: string;
  checks: unknown; notes: unknown;
  ip: string; userAgent: string | null; referrer: string | null;
}) {
  const row = await insert<{ id: string }>("scans", {
    origin: input.origin,
    total: input.total,
    grade: input.grade,
    checks: input.checks,
    notes: input.notes,
    ip_hash: hashIp(input.ip),
    user_agent: input.userAgent?.slice(0, 300) ?? null,
    referrer: input.referrer?.slice(0, 300) ?? null,
  });
  return row?.id ?? null;
}

export async function saveLead(input: {
  scanId: string | null; email: string;
  company?: string | null; name?: string | null; phone?: string | null;
  wants?: string | null; ip: string;
}) {
  const row = await insert<{ id: string }>("leads", {
    scan_id: input.scanId,
    email: input.email.slice(0, 200),
    company: input.company?.slice(0, 120) ?? null,
    name: input.name?.slice(0, 60) ?? null,
    phone: input.phone?.slice(0, 40) ?? null,
    wants: input.wants?.slice(0, 60) ?? null,
    ip_hash: hashIp(input.ip),
    source: "free_scan",
  });
  return row?.id ?? null;
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
