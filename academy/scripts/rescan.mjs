/**
 * 재진단 — 고객사 사이트를 다시 진단해 「지금 점수」를 남긴다.
 *
 * 착수 진단만 있고 다시 재는 자리가 없었다. 아이로그는 09.10 에 44점이었고
 * 전달 파일 세 개가 반영돼 75점이 됐는데, DB 와 대시보드에는 계속 44점이었다.
 * 고친 게 먹혔는지 모르면 다음에 뭘 할지도 못 정한다.
 *
 * 하는 일
 *   1. probe/src/scan.js 로 진단 → geo.scans 에 한 줄, geo.clients.current_score 갱신
 *   2. 사이트맵의 실제 페이지 → academy.site_pages (커버리지 분모)
 *
 *   node scripts/rescan.mjs                  전 고객사
 *   node scripts/rescan.mjs --client ilog    한 곳
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { selectClients } from "../clients.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const SCAN = path.resolve(process.cwd(), "..", "probe", "src", "scan.js");

/** 사이트맵 경로를 크롤러 기록과 같은 모양으로 — 끝의 / 를 떼고, 루트만 / */
const norm = (loc) => {
  try {
    const p = new URL(loc.trim()).pathname;
    return p.length > 1 ? p.replace(/\/+$/, "") : "/";
  } catch { return null; }
};

let failed = 0;
for (const c of selectClients()) {
  console.log(`\n══ ${c.name} · ${c.domain} ══`);

  // ── 1. 진단
  let s;
  try {
    const out = execFileSync(process.execPath, [SCAN, c.domain, "--pages", "6", "--json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 150_000, maxBuffer: 20 * 1024 * 1024,
    });
    s = JSON.parse(out);
  } catch (e) {
    console.log(`  진단 실패 — ${String(e.message).slice(0, 80)}`);
    failed++;
    continue;
  }

  const [prev] = await q(`select baseline_score, current_score from geo.clients where id = $1`, [c.id]);
  await q(
    `insert into geo.scans (origin, total, grade, checks, notes, user_agent)
     values ($1,$2,$3,$4,$5,'cited-rescan')`,
    [s.origin, s.total, s.grade, JSON.stringify(s.checks), JSON.stringify(s.notes ?? [])],
  );
  await q(`update geo.clients set current_score = $1, current_on = current_date where id = $2`, [s.total, c.id]);

  const base = prev?.baseline_score;
  const was = prev?.current_score;
  console.log(`  진단 ${s.total}점 (${s.grade})` +
    (base != null ? ` · 착수 ${base}점 대비 ${s.total - base >= 0 ? "+" : ""}${s.total - base}` : "") +
    (was != null && was !== s.total ? ` · 지난번 ${was}점` : ""));
  for (const [k, v] of Object.entries(s.checks ?? {})) {
    if (v.score < 70) console.log(`    낮음  ${k} ${v.score}`);
  }

  // ── 2. 사이트맵 페이지
  try {
    const r = await fetch(`https://${c.domain}/sitemap.xml`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const paths = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1])).filter(Boolean))];
    if (paths.length) {
      await q(`delete from academy.site_pages where client_id = $1 and path <> all($2::text[])`, [c.id, paths]);
      for (const p of paths) {
        await q(
          `insert into academy.site_pages (client_id, path) values ($1,$2)
           on conflict (client_id, path) do update set seen_on = current_date`, [c.id, p]);
      }
    }
    console.log(`  사이트맵 ${paths.length}쪽`);
  } catch (e) {
    console.log(`  사이트맵 못 읽음 — ${e.message}`);
  }
}

await pool.end();
if (failed) process.exitCode = 1;
