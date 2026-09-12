/**
 * 글에 든 숫자를 전부 끄집어내 사람 앞에 놓는다.
 *
 * slop-check 는 어휘만 본다. 그래서 「우리 지역 30개 학원을 대상으로 한 설문에서
 * 응답자의 40%가」 같은 문장이 0곳 통과로 나온다. 없는 설문이다.
 * 지어낸 숫자 하나가 다른 문서와 어긋나면 레퍼런스 전체가 죽는다 — CLAUDE.md 첫 규칙이다.
 *
 * 숫자는 기계가 셀 수 있다. 뜻은 못 봐도 「어디에 숫자가 있는지」는 빠짐없이 댈 수 있다.
 * 판단은 사람이 한다. 이 도구는 30초 만에 훑게 해 주는 것까지가 일이다.
 *
 *   node scripts/fact-check.mjs <슬러그>
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!slug) {
  console.log("슬러그를 주세요:  node scripts/fact-check.mjs <슬러그>");
  process.exit(1);
}

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
const CLIENT = Number(process.env.CLIENT_ID ?? 1);

const { rows } = await pool.query(
  `select title, body from academy.posts where slug = $1`, [slug],
);
if (!rows.length) {
  console.log(`${slug} 를 못 찾았습니다.`);
  await pool.end();
  process.exit(1);
}

// 쓸 수 있는 숫자. write-draft 가 프롬프트에 넣어 주는 것과 같은 출처다.
const { rows: 잰것 } = await pool.query(
  `select
     (select count(*) from academy.posts where client_id=$1 and published)::int 글수,
     (select count(*) from academy.crawl_hits where client_id=$1)::int 크롤러방문`,
  [CLIENT],
);
await pool.end();

const 허용 = new Set(Object.values(잰것[0] ?? {}).map(String));
const body = rows[0].body ?? "";

console.log(rows[0].title);
console.log(`잰 숫자(써도 되는 것): ${[...허용].join(", ") || "없음"}\n`);

/** 설문·조사·통계를 들먹이는 문장. 우리는 설문을 한 적이 없다. */
const 조사표현 = /설문|조사에 따르면|통계|응답자|리서치|연구 결과|자료에 따르면/;

const 줄들 = body.split(/\n+/).map((s) => s.trim()).filter(Boolean);
let 숫자줄 = 0;
let 조사줄 = 0;

for (const 줄 of 줄들) {
  // 목록 번호는 숫자가 아니다. 「1. 반 인원수를」의 1 을 지어낸 숫자로 세면
  // 헛것이 대부분이 되고, 그러면 진짜 한 줄을 놓친다.
  const 본문 = 줄.replace(/^\s*\d+[.)]\s/, "").replace(/\(\s*\d+\s*\)/g, "");
  const nums = 본문.match(/\d+(?:[.,]\d+)?/g);
  const 조사 = 조사표현.test(줄);
  if (!nums && !조사) continue;

  const 밖의것 = (nums ?? []).filter((n) => !허용.has(n));
  if (!밖의것.length && !조사) continue;

  숫자줄++;
  if (조사) 조사줄++;
  const 보임 = 줄.length > 150 ? 줄.slice(0, 150) + "…" : 줄;
  console.log(`  ${조사 ? "‼" : "·"} ${보임}`);
  if (밖의것.length) console.log(`      잰 적 없는 숫자: ${[...new Set(밖의것)].join(", ")}`);
  if (조사) console.log(`      ‼ 설문·조사를 들먹입니다. 우리는 설문을 한 적이 없습니다`);
  console.log();
}

console.log("─".repeat(56));
if (!숫자줄) {
  console.log("  잰 적 없는 숫자가 없습니다. 그래도 겪은 일인지는 사람이 봐야 합니다.");
} else {
  console.log(`  확인할 줄 ${숫자줄}개${조사줄 ? ` · 그중 ${조사줄}개는 없는 조사를 인용합니다` : ""}`);
  console.log("  겪은 일이 아니면 지우거나, 숫자를 빼고 판단 기준만 남깁니다.");
}
