/**
 * 흔한 이름 판별 말을 고객 이름에서 만든 말로 바꾼다(Step 57 D252).
 *
 *   node academy/scripts/fix-name-terms.mjs --client-id 18           바뀔 것만 보인다(기본 --dry)
 *   node academy/scripts/fix-name-terms.mjs --client-id 18 --apply   쓴다 — 그 뒤 체크리스트로 원장 일감을 맞춘다
 *   node academy/scripts/fix-name-terms.mjs                          화면 등록 고객(active) 전부, 매시 루프와 같은 규칙(원장 출처는 안 덮음)
 *
 * 바꾸면 판별 말 전부를 이름 그대로 · 띄어쓰기 뺀 이름(+ 홈페이지 도메인)으로 갈아 끼운다(D257).
 * --client-id 를 주면 원장 지시로 보고(D258) 출처(원장)·흔한 말 유무와 상관없이 원장이 넣은 일반 말까지 갈아 끼운다.
 * 매시 루프(판별말고치고맞추기)는 출처가 원장이면 안 덮는다.
 * 출력은 id·말 개수만 — 고객 이름·판별 말은 찍지 않는다(handoff·로그에 남지 않게).
 */
import fs from "node:fs";
import pg from "pg";
import { CODE_SLUGS, 이름판별고침, 판별말저장, 체크리스트, 파일럿상태, 사람일감맞추기 } from "../../web/lib/client-core.mjs";
import { 이름흔함 } from "../../web/lib/auto-setup-words.mjs";

const 인자 = process.argv.slice(2);
const 값 = (k) => { const i = 인자.indexOf(k); return i >= 0 ? 인자[i + 1] : null; };
const APPLY = 인자.includes("--apply");
const idArg = 값("--client-id");
if (idArg !== null && !/^\d+$/.test(idArg)) {
  console.log("사용: node academy/scripts/fix-name-terms.mjs [--client-id <숫자>] [--apply]");
  process.exit(1);
}

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 2 });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
const ADMIN = "https://geo-rose-nine.vercel.app";

try {
  const rows = (idArg !== null
    ? await q(`select to_jsonb(c) as r from geo.clients c where c.id = $1`, [Number(idArg)])
    : await q(`select to_jsonb(c) as r from geo.clients c where c.status = 'active' order by c.id`)).map((x) => x.r)
    .filter((r) => !CODE_SLUGS.includes(r.slug));
  if (!rows.length) { console.log(idArg !== null ? `id ${idArg}: 화면 등록 고객이 아닙니다(없거나 코드 고객)` : "볼 고객이 없습니다"); process.exitCode = 1; }
  console.log(APPLY ? "── 쓰기(--apply)" : "── 보기만(--dry) — 쓰려면 --apply");
  for (const row of rows) {
    const 전 = Array.isArray(row.config?.answerTerms) ? row.config.answerTerms : [];
    const g = 이름판별고침(row, { 강제: idArg !== null });
    const 줄 = `id ${row.id}: 판별 말 ${전.length}개(흔함 ${전.filter(이름흔함).length})`;
    if (!g.바꿀) { console.log(`${줄} — 그대로(${g.까닭})`); continue; }
    const 뺌 = 전.filter((x) => !g.terms.includes(x)).length;
    const 더함 = g.terms.filter((x) => !전.includes(x)).length;
    console.log(`${줄} → ${g.terms.length}개(흔함 ${g.terms.filter(이름흔함).length}) · 뺄 말 ${뺌} · 더할 말 ${더함}`);
    if (!APPLY) continue;
    const n = await 판별말저장(q, row, g.terms);
    if (!n) { console.log(`  id ${row.id}: 안 씀 — 읽은 뒤 판별 말이 바뀌었습니다. 다시 돌려 보세요`); process.exitCode = 1; continue; }
    await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1, 'setup', '이름 말 고침', true, $2)`, [row.id, `${g.까닭}${idArg !== null ? " (원장 지시)" : ""}`]);
    const [새] = (await q(`select to_jsonb(c) as r from geo.clients c where c.id = $1`, [row.id])).map((x) => x.r);
    const 일감 = await 사람일감맞추기(q, 새, 체크리스트(새, 새.derived ?? {}, { pilot: await 파일럿상태(q, row.id) }), { admin: ADMIN });
    console.log(`  id ${row.id}: 썼습니다 — 판별 말 ${새.config.answerTerms.length}개 · 일감 엶 ${일감.열림.length} · 닫음 ${일감.닫힘.length}${일감.닫힘.length ? `(${일감.닫힘.join(",")})` : ""}`);
  }
} finally {
  await pool.end();
}
