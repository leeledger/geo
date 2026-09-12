/**
 * AI 가 쓴 티가 남았는지 검사한다.
 *
 * 읽는 사람은 안다. 아래 표시가 있으면 그 글은 광고로 분류되고,
 * 광고로 분류되면 AI 도 인용하지 않는다.
 *
 * 기계가 잡을 수 있는 건 어휘뿐이다. 양비론이나 일반론처럼
 * 뜻을 봐야 아는 건 사람이 읽어야 한다. 그래서 이건 1차 거름망이다.
 *
 * 이관해 온 글은 기본으로 뺀다 (source_url 이 있는 글).
 * 원장님이 예전에 직접 쓰신 글이라 "다양한" 이 있어도 그건 AI 티가 아니라
 * 그분 말투다. 고치면 진짜배기가 사라진다. 새로 쓰는 글만 이 기준으로 본다.
 *
 *   node scripts/slop-check.mjs            새로 쓴 글만
 *   node scripts/slop-check.mjs --all      이관 글까지 전부
 *   node scripts/slop-check.mjs <슬러그>    한 편만
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

/** 잡을 것. 뒤에 왜 나쁜지를 적어 둔다 — 고칠 때 필요하다. */
const MARKS = [
  { re: /알아보겠습니다|살펴보겠습니다|대해 알아보|소개해 드리겠습니다/g, why: "서론으로 여는 말" },
  // 연결어 하나는 문제가 아니다. "먼저 분명히 해둘 게 있습니다" 는 오히려 좋다.
  // 세트로 깔아서 순서를 만드는 게 AI 티다. 그래서 두 종류 이상일 때만 잡는다.
  { seq: ["먼저", "다음으로", "마지막으로", "끝으로"], min: 2, why: "순서를 까는 연결어 세트" },
  { re: /정말 중요|매우 중요|굉장히|너무나|아주 유용/g, why: "빈 강조" },
  { re: /라고 할 수 있습니다|인 것 같습니다|일 것입니다|하는 것이 좋습니다만/g, why: "흐린 마무리" },
  { re: /다양한|여러 가지|수많은|많은 분들/g, why: "숫자를 피하는 말" },
  { re: /놀라운|혁신적|필수적|완벽한|최적의|효과적으로/g, why: "과장 형용사" },
  { re: /장단점이 있|둘 다 맞|각각의 장점/g, why: "양비론" },
  { re: /요즘 많은|최근 들어 많은|바야흐로/g, why: "아무나 쓰는 도입" },
  // 「~것이 중요합니다」로 문단을 닫으면 판단이 아니라 훈계가 된다.
  // 금지 목록에는 적어 뒀는데 여기 정규식에 없어서 그냥 통과했다(2026-09-12).
  { re: /것이 현명합니다|것이 바람직합니다|것이 중요합니다|것이 좋습니다|도움이 됩니다/g, why: "훈계조로 닫기" },
];

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const withMigrated = process.argv.includes("--all");

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
  const found = [];
  for (const m of MARKS) {
    if (m.seq) {
      const used = m.seq.filter((w) => new RegExp("(^|\n)\s*" + w + "[,\s]").test(p.body));
      if (used.length < m.min) continue;
      found.push({ why: m.why, n: used.length, sample: used });
      tally.set(m.why, (tally.get(m.why) ?? 0) + used.length);
      continue;
    }
    const hits = p.body.match(m.re);
    if (!hits) continue;
    found.push({ why: m.why, n: hits.length, sample: [...new Set(hits)].slice(0, 3) });
    tally.set(m.why, (tally.get(m.why) ?? 0) + hits.length);
  }
  if (!found.length) continue;
  dirty++;
  console.log(`\n${p.title}`);
  console.log(`  ${p.slug}`);
  for (const f of found) {
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
console.log("\n  어휘만 봅니다. 양비론·일반론은 사람이 읽어야 압니다.");
