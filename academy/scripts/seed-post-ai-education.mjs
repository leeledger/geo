/**
 * 「코딩 교육과 AI 교육은 다른가」 — 원장 칼럼.
 *
 * 원칙 (seed-drafts2.mjs 와 같다):
 *  - 사이트에 이미 있는 사실만 쓴다.
 *  - 제목을 질문형으로 둔다. AI 는 "이 질문에 답하는 문서"를 인용한다.
 *  - 문단을 80~400자로 맞춘다. 잘라 인용하기 좋은 길이다.
 *  - "우리 학원으로 오세요"로 닫지 않는다. 판단 기준을 주고 끝낸다.
 *
 *   node scripts/seed-post-ai-education.mjs           초안으로 넣기
 *   node scripts/seed-post-ai-education.mjs --publish 바로 공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");

const POST = {
  slug: "koding-gyoyukgwa-ai-gyoyugui-chai",
  title: "코딩 교육이랑 AI 교육이 다른 건가요?",
  category: "교육관점",
  tags: ["AI교육", "코딩교육", "문제정의", "중학교", "AI리터러시"],
  summary:
    "코딩은 시키는 법을 배우고, AI 교육은 무엇을 시킬지 정하는 법을 배웁니다. 둘을 같은 것으로 두면 차이가 중학교에 가서 드러납니다.",
  body: `상담에서 자주 듣는 말입니다. "요즘 AI가 코딩을 다 해준다던데, 그럼 AI를 가르쳐야 하나요 코딩을 가르쳐야 하나요?"

같은 것으로 보이지만 다릅니다. 그리고 이 차이는 생각보다 늦게, 대개 중학교에 가서 드러납니다.

![같은 결과물에서 두 갈래로 갈라지는 그림. 위쪽은 정하고·시키고·고치는 길이고 아래쪽은 받아서 그대로 내는 길이며, 중학교를 지나면 한쪽만 설명이 된다.](/blog/koding-gyoyukgwa-ai-gyoyugui-chai/cover.svg)

## "AI로 만들었어요"라는 말

아이가 뭔가를 만들어 와서 "AI로 만들었어요"라고 합니다. 수업에서 이 말을 들으면 저는 결과물을 먼저 보지 않습니다. 같은 말이 두 가지 전혀 다른 상황을 가리키기 때문입니다.

하나는 무엇을 만들지 자기가 정하고, AI에게 시키고, 나온 것을 보고 고친 경우입니다. 다른 하나는 AI가 준 것을 그대로 낸 경우입니다.

결과물만 보면 구분이 안 됩니다. 오히려 두 번째가 더 그럴듯할 때도 많습니다. 그래서 초등학교 때는 대체로 그냥 넘어갑니다.

## 중학교에서 갈립니다

초등학교 과제는 대개 "만들어 오기"입니다. 만들어 가면 됩니다.

중학교부터는 "왜 이렇게 만들었는지 설명하기"가 붙습니다. 수행평가가 그렇고, 발표가 그렇고, 나중에 생활기록부가 그렇습니다. 저희가 입시를 지도하면서 가장 많이 확인하는 지점도 여기입니다.

이때 자기가 정하고 시킨 아이는 설명할 것이 있습니다. 받아 적은 아이는 설명할 것이 없습니다. 실력이 갑자기 벌어진 것이 아니라, **그동안 안 보이던 차이가 그제야 보이는 것**입니다.

## 그럼 무엇을 가르쳐야 하나

코딩을 가르치지 말자는 이야기가 아닙니다. 순서가 있다는 이야기입니다.

코딩에서 배우는 것은 **시키는 법**입니다. 순서를 정하고, 반복할 곳을 찾고, 조건을 나눕니다. 이건 AI가 대신 써 줘도 없어지지 않습니다. AI가 쓴 코드가 틀렸을 때 어디가 틀렸는지 아는 힘이 여기서 나옵니다.

AI 교육에서 배우는 것은 **무엇을 시킬지 정하는 법**입니다. 지금 뭐가 문제인지, 그중에 무엇부터 풀지, 나온 답이 맞는지. 이건 문법을 아무리 외워도 따라오지 않습니다. 문제를 스스로 정의해 본 적이 있어야 생깁니다.

![코딩 교육과 AI 교육의 대비. 왼쪽은 순서를 정한다·반복할 곳을 찾는다·조건을 나눈다, 오른쪽은 지금 뭐가 문제인가·그중에 무엇부터 푸는가·나온 답이 맞는가.](/blog/koding-gyoyukgwa-ai-gyoyugui-chai/two-skills.svg)

## 오히려 말과 글입니다

이과 공부만 시키면 되겠다고 생각하기 쉬운데, 저는 반대로 봅니다.

AI에게 일을 시키려면 **말로 정확하게 설명할 수 있어야** 합니다. 애매하게 시키면 애매한 것이 나옵니다. 그리고 나온 것을 보고 "이건 내가 원한 게 아니다"라고 말하려면, 원한 것이 무엇이었는지 자기가 알고 있어야 합니다.

읽고 쓰는 힘이 코딩의 반대편에 있는 게 아니라, AI를 쓰는 데 필요한 조건이 된 셈입니다. 저희가 수업에서 만든 것을 말로 설명하게 시키는 이유가 이것입니다.

## 집에서 확인해 보는 법

아이가 만든 것을 가져오면 잘 만들었는지 보지 마시고, 이렇게 물어보십시오.

"이거 왜 만들었어?"
"처음에 뭐부터 했어?"
"안 될 때 뭘 바꿨어?"

![집에서 물어볼 세 질문과 그 판단. 셋 다 답이 나오면 아이가 한 것이고, 첫 번째부터 막히면 AI가 한 것이다.](/blog/koding-gyoyukgwa-ai-gyoyugui-chai/three-questions.svg)

셋 다 답이 나오면 아이가 한 것입니다. 첫 번째부터 막히면 AI가 한 것입니다. 혼낼 일은 아닙니다. 지금 어디쯤 와 있는지 아는 데 쓰시면 됩니다.

그리고 첫 번째 질문에 답이 나오는 아이는 도구가 또 바뀌어도 대체로 괜찮습니다. 바뀌는 건 도구고, 그 질문에 답하는 힘은 도구가 바뀌어도 남습니다.`,
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
     category=excluded.category, tags=excluded.tags,
     published=excluded.published,
     published_at=coalesce(academy.posts.published_at, excluded.published_at),
     updated_at=now()`,
  [POST.slug, POST.title, POST.summary, POST.body, POST.category, POST.tags,
   PUBLISH, PUBLISH ? new Date() : null],
);

const paras = POST.body.split("\n\n").filter((x) => x.trim() && !x.startsWith("##"));
const good = paras.filter((x) => x.length >= 80 && x.length <= 400).length;
console.log(`${POST.title}`);
console.log(`  ${POST.body.length}자 · 인용 좋은 문단 ${good}/${paras.length} · ${PUBLISH ? "공개" : "초안"}`);
console.log(`  https://robotncoding.com/blog/${POST.slug}`);

const { rows } = await pool.query(
  `select count(*) filter (where published) pub, count(*) filter (where not published) dr
     from academy.posts`,
);
console.log(`\n공개 ${rows[0].pub}편 · 초안 ${rows[0].dr}편`);
await pool.end();
