/**
 * 도해를 본문에 넣는다.
 *
 * 8편이 도해 없이 글자만 있었다. 사이트에서도 읽기 힘들고, 네이버로 옮기면
 * 더 나빠진다 — 네이버는 이미지가 없으면 글이 안 읽힌다.
 *
 * 넣는 자리가 중요하다. 맨 위에 붙이면 장식이 되고, 그 도해가 설명하는
 * 대목 바로 앞에 놓아야 읽는 사람이 그림을 보고 다음 문단을 읽는다.
 *
 *   node scripts/insert-diagrams.mjs
 */
import fs from "node:fs";
import { Pool } from "pg";

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

/** slug → { file, alt, before } — before 앞에 넣는다. 없으면 맨 뒤. */
const PLAN = {
  "koding-myeot-hangnyeonbuteo": {
    file: "age-ladder",
    alt: "나이별 코딩 학습 단계. 7세부터 초3은 글자를 몰라도 시작하고, 초1~초4는 코드를 쓰지 않고 순서와 반복과 조건으로 사고의 뼈대를 만들며, 초5 이상부터 파이썬으로 넘어간다. 기준은 나이가 아니라 설명할 수 있는가이다.",
    before: "## 그럼 늦게 시작하면 손해인가요",
  },
  "beullogeseo-paisseoneuro": {
    file: "ready-check",
    alt: "블록코딩에서 파이썬으로 넘어갈 때를 집에서 확인하는 법. 아이에게 이 블록은 왜 여기 있는지, 빼면 어떻게 될지, 숫자를 바꾸면 어떻게 될지 묻는다. 자기 말로 답하면 넘어갈 때이고 모르겠다고 하면 아직이다.",
    before: "## 넘어갈 때 이렇게 합니다",
  },
  "hagweon-vs-online-gangui": {
    file: "one-test",
    alt: "코딩학원과 온라인 강의 중 무엇이 맞는지 판단하는 기준 하나. 지난주에 아이가 스스로 강의를 열었으면 온라인으로 충분하고, 매번 시켜야 했으면 아직 사람이 필요하다.",
    before: "## 섞어 쓰는 방법",
  },
  "saenggibue-sseul-koding-project": {
    file: "record",
    alt: "생기부용 코딩 프로젝트는 완성작만으로 부족하다. 면접에서 묻는 세 가지와, 그래서 만드는 동안 남겨야 하는 네 가지를 나란히 보여준다.",
    before: "## 그래서 기록을 남기게 합니다",
  },
  "entry-scratch-eoneu-geot": {
    file: "tool-vs-class",
    alt: "엔트리와 스크래치는 도구로서 같다. 진짜 갈리는 것은 수업 방식이다. 예제를 따라 만들기만 하는 수업은 1년을 해도 혼자 못 만들고, 만들고 싶은 것을 정하는 수업이라야 사고가 붙는다.",
    before: "## 확인해 보는 법",
  },
  "yeongjaego-gwahakgo-koding-junbi": {
    file: "what-to-ask",
    alt: "영재고와 과학고 준비에서 가장 많이 놓치는 것은 과정 기록이다. 남겨야 할 세 가지와 학원 상담에서 물어볼 세 가지.",
    before: "## AI를 써도 되나",
  },
  "hagweoneseo-mueoseul-baewossna": {
    file: "what-remains",
    alt: "수업이 끝나면 무엇이 남는가. 만든 화면과 아이의 소감, 선생님 코멘트가 합쳐져 학습 성장 리포트가 된다. 태도, 집중력, 학습 의지, 이해력, 표현력, 창의성 여섯 영역을 기록하고 점수는 매기지 않는다.",
    before: "## 점수를 매기지 않는 이유",
  },
};

let done = 0;
for (const [slug, p] of Object.entries(PLAN)) {
  const { rows } = await pool.query(`select body from academy.posts where slug = $1`, [slug]);
  if (!rows[0]) { console.log(`  ${slug} — 글이 없습니다`); continue; }

  let body = rows[0].body;
  if (body.includes(`/${p.file}.svg`)) { console.log(`  ${slug} — 이미 있습니다`); continue; }

  const img = `![${p.alt}](/blog/${slug}/${p.file}.svg)`;
  if (p.before && body.includes(p.before)) {
    body = body.replace(p.before, `${img}\n\n${p.before}`);
  } else {
    console.log(`  ${slug} — 「${p.before}」 를 못 찾아 맨 뒤에 붙입니다`);
    body = `${body}\n\n${img}`;
  }

  await pool.query(
    `update academy.posts set body = $1, updated_at = now() where slug = $2`, [body, slug]);
  console.log(`  ${slug} — 넣었습니다 (${body.length}자)`);
  done++;
}

const [{ n }] = (await pool.query(
  `select count(*)::int n from academy.posts
    where published and source_url is null and body not like '%![%'`)).rows;
console.log(`\n  ${done}편 처리 · 아직 도해 없는 글 ${n}편`);

await pool.end();
