/**
 * 플랫폼 도메인 고객 이행(Step 55g D236) — domain 이 블로그·SNS·플레이스 호스트인 고객은 고객 사이트가 없다.
 *   domain null · IndexNow 「안 씀」 · wantGsc false · derived 비움 · config.auto 「등록 됨 · 나머지 대기」.
 *   채널 주소는 도메인정리가 경로를 떼어 잃었다 — 채널 칸이 비었으면 사이트 단계 = 원장(「블로그 주소 전체를 … 채널 칸에」).
 *   원장이 넣은 판별 말·경쟁 검색어는 출처 「원장」으로 두고 바꾸지 않는다(이름 판별 말 줄이 흔한 말을 원장에게 알린다).
 *   끝에 체크리스트 → 사람 일감 — 열려 있던 setup-send·setup-gsc 는 해당없음으로 닫힌다.
 *
 *   node scripts/migrate-platform-domain.mjs           (기본·--dry) 바꿀 것을 찍기만. DB 안 씀
 *   node scripts/migrate-platform-domain.mjs --apply   바꾼다 — Arch 가 돌린다
 *
 * 출력은 id·별칭만 — 고객 이름·도메인·판별 말을 찍지 않는다. 두 번 돌려도 같다(이행된 고객은 domain 이 null 이라 다시 안 잡힌다)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { 도메인정리, 체크리스트, 사람일감맞추기, 파일럿상태, 자동단계 } from "../../web/lib/client-core.mjs";
import { 호스트갈래, classifyTarget } from "../../web/lib/platform-hosts.mjs";
import { 이름흔함 } from "../../web/lib/auto-setup-words.mjs";

const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry");
const ADMIN = "https://geo-rose-nine.vercel.app";
export const 채널없음말 = "블로그 주소 전체를 「계약 뒤 순서」 상황 바꾸기 채널 칸에 넣어 주세요";

/** 고객 행 → 이행 뒤 config(순수). 채널 칸에 플랫폼 주소가 이미 있으면 사이트 단계는 대기(자동 세팅이 연다) */
export function 이행config(row, at) {
  const c = row.config && typeof row.config === "object" ? row.config : {};
  const ch = c.onboard?.channels && typeof c.onboard.channels === "object" ? Object.values(c.onboard.channels) : [];
  const 채널있음 = ch.some((u) => u && classifyTarget(String(u)).kind === "platform");
  const 경쟁 = Array.isArray(c.queries?.compete) ? c.queries.compete : [];
  return {
    ...c,
    indexnow: { mode: "안 씀" },
    wantGsc: false,
    auto: {
      v: 1, at, 갈래: "플랫폼", 입력: { name: row.name, homepage: "" }, 흔함: 이름흔함(row.name), 이행: "Step 55g — 플랫폼 도메인을 지움",
      출처: { 판별말: "원장", 브랜드: "원장", ...(경쟁.length ? { 경쟁: "원장" } : {}) },
      단계: Object.fromEntries(자동단계.map((k) => [k, k === "사이트" && !채널있음 ? { 상태: "원장", 시도: 0, at, 말: 채널없음말 } : { 상태: "대기", 시도: 0 }])),
    },
  };
}

const 직접 = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (직접) {
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 2 });
  const db = await pool.connect();
  const q = (s, p = []) => db.query(s, p).then((r) => r.rows);
  try {
    const 대상 = (await q(`select to_jsonb(c) as r from geo.clients c where c.domain is not null order by c.id`)).map((x) => x.r)
      .filter((r) => 호스트갈래(도메인정리(r.domain)) === "플랫폼");
    console.log(`플랫폼 도메인 고객 ${대상.length}곳 · ${APPLY ? "바꿈" : "dry — DB 안 씀"}`);
    const at = new Date().toISOString();
    for (const r of 대상) {
      const config = 이행config(r, at);
      const 뒤 = { ...r, domain: null, config, derived: {} };
      const 줄 = 체크리스트(뒤, {}, { pilot: await 파일럿상태(q, r.id) });
      console.log(`  id ${r.id} · ${r.alias ?? "별칭 없음"}`);
      console.log(`    domain → null · IndexNow ${r.config?.indexnow?.mode ?? "없음"} → 안 씀 · wantGsc ${r.config?.wantGsc} → false · derived 키 ${Object.keys(r.derived ?? {}).length}개 → 0`);
      console.log(`    자동 세팅: ${자동단계.map((k) => `${k} ${config.auto.단계[k].상태}`).join(" · ")} · 판별 말 흔함 ${(r.config?.answerTerms ?? []).filter(이름흔함).length}/${(r.config?.answerTerms ?? []).length}`);
      console.log(`    체크리스트 뒤: ${줄.map((x) => `${x.id} ${x.상태}`).join(" · ")}`);
      if (APPLY) {
        await q("begin");
        await q(`update geo.clients set domain = null, config = $2::jsonb, derived = '{}'::jsonb where id = $1 and domain = $3`, [r.id, JSON.stringify(config), r.domain]);
        await q("commit");
        const [새] = (await q(`select to_jsonb(c) as r from geo.clients c where id = $1`, [r.id])).map((x) => x.r);
        const 일감 = await 사람일감맞추기(q, 새, 체크리스트(새, 새.derived ?? {}, { pilot: await 파일럿상태(q, 새.id) }), { admin: ADMIN });
        console.log(`    바꿈 · 일감 엶 ${일감.열림.join(",") || "없음"} · 닫음 ${일감.닫힘.join(",") || "없음"}`);
      }
    }
  } catch (e) {
    await q("rollback").catch(() => {});
    console.log("실패:", String(e?.message ?? e).slice(0, 300));
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
}
