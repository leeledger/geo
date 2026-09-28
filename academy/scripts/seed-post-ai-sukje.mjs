/**
 * 「초등학생한테 챗GPT 쓰게 해도 될까요?」 — 학부모 안내.
 *
 * OpenAI 공식 연령 안내와 로봇&코딩학원의 공개된 교육 원칙만 사용한다.
 * 기존 글을 고칠 때도 같은 내용이 DB에 남도록 이 파일을 원본으로 둔다.
 *
 *   node scripts/seed-post-ai-sukje.mjs            초안으로 넣기
 *   node scripts/seed-post-ai-sukje.mjs --publish  공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");

const POST = {
  slug: "aiga-sukjereul-haetdamyeon",
  title: "초등학생한테 챗GPT 쓰게 해도 될까요?",
  category: "학부모안내",
  tags: ["AI숙제", "AI교육", "학부모", "초등코딩", "챗GPT"],
  summary: "만 13세 미만에게 ChatGPT를 혼자 쓰게 하는 것은 OpenAI 공식 안내와 맞지 않습니다. 교육 목적으로 쓰더라도 실제 대화는 어른이 맡고, 아이는 답을 검증하고 자기 말로 설명해야 합니다.",
  body: `만 13세 미만 아이에게 ChatGPT 계정을 주고 혼자 쓰게 해서는 안 됩니다. OpenAI는 ChatGPT가 만 13세 미만 어린이를 위한 서비스가 아니라고 안내합니다. 만 13세부터 18세까지는 부모나 보호자의 동의가 필요합니다.

## 초등학생이면 어른이 직접 대화해야 합니다

OpenAI의 연령 안내에는 한 가지 조건이 더 있습니다. 만 13세 미만 어린이에게 교육 목적으로 ChatGPT를 보여 줄 때도 실제 대화는 어른이 진행해야 합니다. 아이에게 부모 계정을 건네는 방식이 아니라, 어른이 옆에서 질문을 입력하고 답을 함께 보는 방식입니다.

연령 조건을 충족한 아이도 주의가 필요합니다. OpenAI는 원치 않는 답을 줄이기 위한 조치를 했지만, 모든 연령에 알맞은 답만 나온다고 보장하지는 않습니다. 그래서 "청소년용 보호 기능이 있으니 혼자 써도 된다"고 해석하면 안 됩니다.

## 답을 받기 전에 아이 생각을 먼저 남깁니다

로봇&코딩학원은 [홈페이지에 공개한 교육 원칙](https://robotncoding.com/#ai)에 따라 AI를 쓰기 전에 아이가 풀려는 문제와 자기 생각을 먼저 적게 합니다. 그다음 어른이 ChatGPT에 정답 대신 힌트나 반례를 요청합니다. 돌아온 답은 직접 실행하거나 교과서·선생님·공식 자료와 맞춰 봅니다. 마지막에는 아이가 무엇을 고쳤는지 자기 말로 설명합니다.

![아이가 가져온 숙제를 놓고 묻는 세 가지. 이거 나한테 설명해 줄래, 이 부분은 왜 이렇게 썼어, AI가 틀린 데는 없었어. 스스로 한 아이는 설명하고 이유를 대고 틀린 데를 짚는다. 받아 적은 아이는 두 번째 문장에서 막히고 이유를 못 대고 몰라요라고 한다.](/blog/aiga-sukjereul-haetdamyeon/three-questions.svg)

아이가 숙제에 AI를 썼다면 사용 여부만 묻지 않습니다. **"이 답을 네 말로 설명해 줄래?"**, **"어느 부분을 네가 고쳤어?"**, **"다른 자료와 확인했어?"**를 묻습니다. 세 질문에 답할 수 없다면 결과물을 제출하기 전에 과정을 다시 밟아야 합니다.

## 같이 쓰면 남는 것이 생깁니다

순서는 간단합니다. 아이 생각을 먼저 남기고, 어른이 AI와 대화하고, 답을 다른 자료와 비교한 뒤, 아이가 바꾼 이유를 설명합니다. 이 기록이 있으면 AI가 대신 한 부분과 아이가 판단한 부분을 구분할 수 있습니다.

![AI를 같이 쓸 때 순서를 바꾼다. 아이가 먼저 자기 생각을 세 줄이라도 적고, 그다음 AI에게 묻고, 마지막에 둘을 비교해 고친다. 그러면 AI는 자기 생각을 확인하는 도구가 된다.](/blog/aiga-sukjereul-haetdamyeon/order-swap.svg)

## 하지 마셔야 할 것

AI 검사 결과만으로 아이가 베꼈다고 단정하지 마십시오. OpenAI도 자사가 시험한 AI 작성 탐지기가 판단에 쓸 만큼 신뢰할 수 없었다고 설명합니다. 대신 사용한 대화와 출처를 남기고, 아이가 풀이 과정을 설명하게 하는 방법을 권합니다.

만 13세 미만이라면 아이가 ChatGPT와 직접 대화하게 하지 않습니다. 만 13세 이상이어도 보호자 동의만 받고 끝내지 않습니다. 학교가 정한 AI 사용 규칙을 확인하고, 답을 그대로 제출하지 않으며, 사용한 대화와 확인한 출처를 함께 남깁니다.

## 출처

- [OpenAI, ChatGPT는 모든 연령대에 안전한가요?](https://help.openai.com/ko-kr/articles/8313401-is-chatgpt-safe-for-all-ages)
- [OpenAI, 학생이 AI 생성물을 자신의 것으로 제출했을 때 교육자는 어떻게 대응할 수 있나요?](https://help.openai.com/en/articles/8313351-how-can-educators-respond-to-students-presenting-ai-generated-content-as-their-own)`,
};

const SOURCES = [
  "https://help.openai.com/ko-kr/articles/8313401-is-chatgpt-safe-for-all-ages",
  "https://help.openai.com/en/articles/8313351-how-can-educators-respond-to-students-presenting-ai-generated-content-as-their-own",
];
const EVIDENCE = [
  "ChatGPT는 만 13세 미만 어린이를 위한 서비스가 아니며, 13~18세는 부모 또는 보호자 동의가 필요함 — OpenAI Help Center",
  "만 13세 미만 어린이의 교육 상황에서는 ChatGPT와의 실제 상호작용을 어른이 진행해야 함 — OpenAI Help Center",
  "OpenAI가 시험한 AI 작성 탐지기는 판단에 쓸 만큼 신뢰할 수 없었고, 대화·출처 기록과 과정 설명을 대안으로 제시함 — OpenAI Help Center",
];

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

await pool.query(
  `update academy.posts set review_notes = coalesce(review_notes,'{}'::jsonb) ||
     jsonb_build_object('질문','q16','출처',$2::jsonb,'근거',$3::jsonb,'확인필요','[]'::jsonb)
   where slug=$1`,
  [POST.slug, JSON.stringify(SOURCES), JSON.stringify(EVIDENCE)],
);

const paras = POST.body.split("\n\n").filter((x) => x.trim() && !x.startsWith("##"));
const good = paras.filter((x) => x.length >= 80 && x.length <= 400).length;
console.log(`${POST.title}`);
console.log(`  ${POST.body.length}자 · 인용 좋은 문단 ${good}/${paras.length} · ${PUBLISH ? "공개" : "초안"}`);
console.log(`  https://robotncoding.com/blog/${POST.slug}`);

const { rows } = await pool.query(
  `select count(*) filter (where published) pub, count(*) filter (where not published) dr
     from academy.posts where client_id = 1`,
);
console.log(`\n공개 ${rows[0].pub}편 · 초안 ${rows[0].dr}편`);
await pool.end();
