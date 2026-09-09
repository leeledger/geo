/**
 * 「코딩 시키면 논술에 도움이 되나요」 — 원장 칼럼.
 *
 * 이 글에서 조심할 것: 과장하면 바로 들킨다.
 * "코딩하면 논술 잘한다"는 거짓이다. 겹치는 부분과 안 겹치는 부분을 갈라야
 * 학부모가 믿는다. 안 겹치는 걸 먼저 말하는 편이 오히려 설득된다.
 *
 * 원칙 (seed-drafts2.mjs 와 같다):
 *  - 사이트에 이미 있는 사실만 쓴다.
 *  - 제목을 질문형으로 둔다.
 *  - 문단을 80~400자로.
 *  - "우리 학원으로 오세요"로 닫지 않는다.
 *  - 하지 말아야 할 것을 한 번은 말한다.
 *
 *   node scripts/seed-post-nonsul.mjs           초안
 *   node scripts/seed-post-nonsul.mjs --publish 공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");

const POST = {
  slug: "koding-sikimyeon-nonsure-doumi-doena",
  title: "코딩 시키면 논술에 도움이 되나요?",
  category: "교육관점",
  tags: ["논술", "컴퓨팅사고력", "AI리터러시", "코딩교육", "중학생"],
  summary:
    "글솜씨가 늘지는 않습니다. 다만 논술이 막히는 자리와 코딩이 막히는 자리가 같습니다. 둘 다 생각의 구조에서 막힙니다.",
  body: `상담에서 가끔 이런 질문을 받습니다. "코딩 시키면 나중에 논술에도 도움이 되나요?"

솔직하게 먼저 말씀드리면, **글솜씨가 늘지는 않습니다.** 코딩을 한다고 문장이 매끄러워지거나 어휘가 늘지 않습니다. 그건 읽고 쓰면서 늘어납니다.

그런데 아이들이 논술에서 막히는 자리를 보면, **글솜씨 때문에 막히는 경우가 생각보다 적습니다.**

## 논술이 실제로 요구하는 것

답안을 써 보게 하면 대개 이런 데서 걸립니다.

- 제시문이 **무엇을 묻는지** 정확히 못 잡는다
- 하고 싶은 말은 있는데 **어떤 순서로 놓을지** 모른다
- 근거와 곁가지를 **구분하지 못한다**
- 반대 입장이 나오면 **어떻게 처리할지** 모른다
- 분량 안에 **뭘 넣고 뭘 뺄지** 못 정한다

문장력 문제가 아닙니다. 다섯 개 다 **생각의 구조** 문제입니다.

## 코딩에서 막히는 자리

그런데 코딩을 시켜 보면 아이가 막히는 자리가 똑같습니다.

- 무엇을 만들지 정하지 못한다
- 큰 문제를 작은 것으로 나누지 못한다
- 핵심과 곁가지를 구분하지 못한다
- 예외가 생기면 어떻게 할지 모른다
- 뭐부터 만들지 못 정한다

같은 목록입니다. 순서를 세우고, 나누고, 버리고, 예외를 처리하는 일이요.

![논술에서 막히는 자리와 코딩에서 막히는 자리가 나란히 같다는 그림. 무엇을 묻는지 파악, 순서 세우기, 곁가지 구분, 예외 처리, 버릴 것 정하기 다섯 가지가 대응한다.](/blog/koding-sikimyeon-nonsure-doumi-doena/same-wall.svg)

## 다만 결정적으로 다른 게 하나 있습니다

논술은 **애매하게 써도 점수가 나올 때가 있습니다.** 읽는 사람이 알아서 채워 읽어 주기 때문입니다.

코드는 그게 안 됩니다. **생각에 구멍이 있으면 바로 안 돌아갑니다.** 컴퓨터는 알아서 채워 읽지 않습니다.

저는 이게 코딩의 진짜 값이라고 봅니다. 실력을 키워 줘서가 아니라, **틀린 걸 즉시 보여 주기 때문**입니다. 논술은 몇 주 뒤에 첨삭으로 알게 되는 걸, 코딩은 3초 만에 알게 됩니다.

## 그래서 순서가 이렇게 됩니다

논리적으로 생각하는 힘이 먼저 있습니다. 이건 눈에 안 보입니다.

코딩은 그 힘을 **눈에 보이게 만드는 도구**입니다. 순서를 정하고, 조건을 나누고, 반복을 찾아내는 걸 손으로 해 보게 만듭니다. 잘못 생각하면 화면이 바로 알려 줍니다.

그리고 그 위에 AI 리터러시가 얹힙니다.

![논리적 사고는 눈에 보이지 않고, 소프트웨어 사고력이 그것을 눈에 보이게 만들며, 그 위에 AI 리터러시가 얹힌다는 그림.](/blog/koding-sikimyeon-nonsure-doumi-doena/chain.svg)

## AI를 잘 쓰는 아이가 하는 일

AI에게 일을 시키는 건 논술과 코딩의 중간쯤입니다.

**말로 해야 하니까 논술이고, 정확해야 하니까 코딩입니다.** 애매하게 시키면 애매한 게 나옵니다. 그리고 나온 답이 맞는지 판단하려면 반대 근거를 떠올릴 줄 알아야 합니다. 논술에서 반론을 처리하는 일과 같습니다.

그래서 AI를 잘 쓰는 아이는 도구를 빨리 익힌 아이가 아닙니다. **뭘 시킬지 정확히 말할 줄 알고, 나온 걸 의심할 줄 아는 아이**입니다.

## 하지 마셔야 할 것

**논술 학원 대신 코딩 학원에 보내라는 이야기가 아닙니다.** 논술은 논술로 준비해야 합니다. 읽고 쓰는 양은 다른 걸로 대체되지 않습니다.

**"코딩하면 논술 점수 오른다"고 기대하지도 마십시오.** 그렇게 말하는 곳이 있으면 걸러 들으시는 게 좋습니다. 점수는 그렇게 단순하게 움직이지 않습니다.

다만 아이가 글을 못 쓸 때, 원인을 글솜씨에서만 찾지 마십시오. **무엇을 묻는지 못 잡아서, 순서를 못 세워서, 뭘 버릴지 못 정해서**일 수 있습니다. 그건 다른 방법으로도 훈련이 됩니다.`,
};

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

await pool.query(
  `insert into academy.posts (slug,title,summary,body,category,tags,published,published_at,updated_at)
   values ($1,$2,$3,$4,$5,$6,$7,$8,now())
   on conflict (slug) do update set
     title=excluded.title, summary=excluded.summary, body=excluded.body,
     category=excluded.category, tags=excluded.tags, published=excluded.published,
     published_at=coalesce(academy.posts.published_at, excluded.published_at),
     updated_at=now()`,
  [POST.slug, POST.title, POST.summary, POST.body, POST.category, POST.tags,
   PUBLISH, PUBLISH ? new Date() : null],
);

const paras = POST.body.split("\n\n").filter((x) => x.trim() && !x.startsWith("##"));
const good = paras.filter((x) => x.length >= 80 && x.length <= 400).length;
console.log(POST.title);
console.log(`  ${POST.body.length}자 · 인용 좋은 문단 ${good}/${paras.length} · ${PUBLISH ? "공개" : "초안"}`);
console.log(`  https://robotncoding.com/blog/${POST.slug}`);
await pool.end();
