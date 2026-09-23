/**
 * AI 가 쓴 티가 남았는지 검사한다.
 *
 * 읽는 사람은 안다. 아래 표시가 있으면 그 글은 광고로 분류되고,
 * 광고로 분류되면 AI 도 인용하지 않는다.
 *
 * 규칙은 slop-rules.mjs 에 있다. write-draft 도 같은 것을 부른다 —
 * 검사 기준이 두 벌이면 한쪽만 고쳐 놓고 통과한 줄 안다.
 *
 * 이관해 온 글은 기본으로 뺀다 (source_url 이 있는 글).
 * 원장님이 예전에 직접 쓰신 글이라 "다양한" 이 있어도 그건 AI 티가 아니라
 * 그분 말투다. 고치면 진짜배기가 사라진다. 새로 쓰는 글만 이 기준으로 본다.
 *
 *   node scripts/slop-check.mjs                    새로 쓴 글만 (어휘)
 *   node scripts/slop-check.mjs --all              이관 글까지 전부 (어휘)
 *   node scripts/slop-check.mjs <슬러그>            한 편만 (어휘)
 *   node scripts/slop-check.mjs --strict <슬러그>   치명까지 본다. 치명이 있으면 종료 코드 1
 */
import fs from "node:fs";
import { Pool } from "pg";
import { MARKS, 검사 } from "./slop-rules.mjs";

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

const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const withMigrated = process.argv.includes("--all");
const STRICT = process.argv.includes("--strict");

/** 어휘 표시만 골라낸다. 인자 없는 기존 동작은 여기서 멈춘다 — Actions 가 이 출력을 읽는다 */
const 어휘 = new Set(MARKS.map((m) => m.why));

// ── 엄격 검사: 한 편을 치명까지 본다. 재료는 review_notes.쓴재료 로 찾는다
if (STRICT) {
  if (!only) {
    console.log("슬러그를 주세요: node scripts/slop-check.mjs --strict <슬러그>");
    await pool.end();
    process.exitCode = 2;
  } else {
    const { rows } = await pool.query(
      `select slug, title, body, coalesce(review_notes->'쓴재료', '[]'::jsonb) 쓴재료 from academy.posts where slug = $1`,
      [only],
    );
    const p = rows[0];
    if (!p) {
      console.log(`${only} 글이 없습니다.`);
      await pool.end();
      process.exitCode = 2;
    } else {
      const ids = (p.쓴재료 ?? []).filter((x) => typeof x === "string");
      const { rows: 재료들 } = ids.length
        ? await pool.query(`select id, kind, said from academy.materials where id = any($1::uuid[])`, [ids])
        : { rows: [] };
      await pool.end();

      const r = 검사(p.body ?? "", { 재료들 });
      console.log(`${p.title}\n  ${p.slug} · 쓴 재료 ${재료들.length}개`);
      if (r.치명.length) {
        console.log("\n치명 — 이대로는 원장 큐에 못 올립니다");
        for (const f of r.치명) console.log(`  ✗ ${f.why} ${f.n}곳 — ${f.sample.join(" / ")}${f.말 ? `\n      ${f.말}` : ""}`);
      } else {
        console.log("\n치명: 없음");
      }
      if (r.경고.length) {
        console.log("\n경고 — 세기만 합니다");
        for (const f of r.경고) console.log(`    ${f.why} ${f.n}곳 — ${f.sample.join(", ")}`);
      }
      process.exitCode = r.치명.length ? 1 : 0;
    }
  }
} else {
  const { rows } = await pool.query(
    only
      ? `select slug, title, body from academy.posts where slug = $1`
      : withMigrated
        ? `select slug, title, body from academy.posts where published order by published_at desc`
        : `select slug, title, body from academy.posts
            where published and source_url is null order by published_at desc`,
    only ? [only] : [],
  );
  if (!only) {
    console.log(withMigrated
      ? `이관 글까지 ${rows.length}편을 봅니다.`
      : `새로 쓴 글 ${rows.length}편을 봅니다. (이관 글은 뺐습니다 — --all 로 포함)`);
  }
  await pool.end();

  let dirty = 0;
  const tally = new Map();

  for (const p of rows) {
    const r = 검사(p.body ?? "");
    const found = [...r.치명, ...r.경고].filter((f) => 어휘.has(f.why));
    if (!found.length) continue;
    dirty++;
    console.log(`\n${p.title}`);
    console.log(`  ${p.slug}`);
    for (const f of found) {
      tally.set(f.why, (tally.get(f.why) ?? 0) + f.n);
      console.log(`    ${f.why} ${f.n}곳 — ${f.sample.join(", ")}`);
    }
  }

  console.log("\n" + "─".repeat(56));
  console.log(`  글 ${rows.length}편 중 ${dirty}편에서 걸림`);
  if (tally.size) {
    console.log("  많이 나온 것:");
    [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .forEach(([w, n]) => console.log(`    ${w}  ${n}곳`));
  } else {
    console.log("  걸린 표현이 없습니다.");
  }
  console.log("\n  어휘만 봅니다. 지어낸 장면·일반론은 --strict 로 봅니다.");
}
