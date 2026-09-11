/**
 * 「아이가 AI로 숙제했는데, 그냥 둬도 되나요?」 — 학부모 안내.
 *
 * 주제 은행 topics.json 의 ai-sukje. 각도: 막으면 몰래 쓴다. 같이 쓰면서 확인하는 편이 낫다.
 * 혼낼 일이 아니라는 말이 반드시 들어가야 한다.
 *
 * 지키는 것 (CLAUDE.md):
 *  - 제목은 질문형. 학부모가 검색창에 치는 말 그대로
 *  - 문단 80~400자. 잘라 인용하기 좋은 길이
 *  - 숫자는 잰 것만. 이 글에는 지어낸 숫자를 넣지 않았다
 *  - 「우리 학원으로 오세요」로 닫지 않는다. 판단 기준을 주고 끝낸다
 *  - 하지 말아야 할 것을 한 번은 말한다
 *
 * ⚠ 발행 전 원장 확인이 필요한 문장 (사실 확인은 사람 몫):
 *  1) "요즘 상담에서 가장 자주 나오는 질문입니다" — 실제로 그런지
 *  2) "수업에서도 같은 장면을 봅니다" — 수업 중 관찰이 맞는지
 *  두 문장이 사실과 다르면 지우고 나머지는 그대로 쓰면 된다.
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
  title: "아이가 AI로 숙제했는데, 그냥 둬도 되나요?",
  category: "학부모안내",
  tags: ["AI숙제", "AI교육", "학부모", "초등코딩", "챗GPT"],
  summary:
    "막으면 몰래 씁니다. 혼낼 일이 아니라 확인할 일입니다. 집에서 3분이면 아이가 한 것인지 받아 적은 것인지 갈립니다.",
  body: `요즘 상담에서 가장 자주 나오는 질문입니다. "아이가 숙제를 AI로 한 것 같은데, 혼내야 하나요?" 먼저 답을 드리면 혼낼 일이 아닙니다. 다만 그냥 둘 일도 아닙니다. 확인할 일입니다.

## 막는 것은 이미 늦었습니다

막으면 안 쓰는 게 아니라 몰래 씁니다. 몰래 쓰기 시작하면 부모가 볼 수 있는 것은 결과물뿐이라, 아이가 무엇을 했고 무엇을 안 했는지 알 방법이 사라집니다. 집에서 못 쓰게 해도 친구 휴대폰, 학교 태블릿, 검색창에 붙어 나오는 AI 요약까지 막을 수는 없습니다. 지금 아이들에게 AI는 쓰느냐 마느냐가 아니라 어떻게 쓰느냐의 문제가 됐습니다.

## 그래도 그냥 두면 안 되는 이유

AI가 써 준 글은 대체로 그럴듯합니다. 문장이 매끄럽고 분량도 맞습니다. 그래서 초등학교 때는 대개 그냥 넘어갑니다. 문제는 중학교부터입니다. 과제에 "왜 이렇게 했는지 설명하기"가 붙습니다. 수행평가가 그렇고 발표가 그렇습니다.

이때 자기가 정하고 시킨 아이는 설명할 것이 있고, 받아 적은 아이는 설명할 것이 없습니다. 실력이 갑자기 벌어진 게 아니라 그동안 안 보이던 차이가 그제야 보이는 것입니다.

## 집에서 3분이면 갈립니다

아이가 가져온 숙제를 놓고 세 가지만 물어보십시오. 검사가 아니라 대화로 하시면 됩니다. **"이거 나한테 설명해 줄래?"** — 자기가 정하고 시킨 아이는 설명하고, 받아 적은 아이는 두 번째 문장에서 막힙니다. **"이 부분은 왜 이렇게 썼어?"** — 고른 이유를 말할 수 있으면 아이가 판단한 것입니다. **"AI가 틀린 데는 없었어?"** — 답이 나오면 검토를 한 것이고, "몰라요"가 나오면 그대로 낸 것입니다.

## 같이 쓰면 남는 것이 생깁니다

수업에서도 같은 장면을 봅니다. AI에게 시킨 아이와 AI에게 맡긴 아이는 결과물이 아니라 과정에서 갈립니다. 같이 쓰실 때는 순서를 바꿔 보십시오. 먼저 아이가 자기 생각을 세 줄이라도 적고, 그다음에 AI에게 물어보고, 마지막에 둘을 비교하게 하는 것입니다.

이 순서면 AI가 답을 주는 도구가 아니라 자기 생각을 확인하는 도구가 됩니다. 무엇을 물었고 무엇을 고쳤는지가 기록으로 남으니, 나중에 설명해야 할 때 꺼낼 것도 생깁니다.

## 하지 마셔야 할 것

검사 앱이나 차단 프로그램으로 몰아가는 것은 권하지 않습니다. 아이는 우회하는 법을 먼저 배우고, 부모는 확인할 통로를 잃습니다. 남는 것은 서로에 대한 불신뿐입니다. "AI 썼지?"로 시작하는 대화도 같습니다. 아이는 숨기는 쪽을 택합니다. 물어볼 것은 사용 여부가 아니라 과정입니다.

## 정리

AI를 썼는지가 기준이 아닙니다. **설명할 수 있는지**가 기준입니다. 설명이 되면 도구를 쓴 것이고, 설명이 안 되면 대신 시킨 것입니다. 이 기준 하나만 집에서 지켜도, 도구가 또 바뀌어도 아이는 대체로 괜찮습니다.`,
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
     from academy.posts where client_id = 1`,
);
console.log(`\n공개 ${rows[0].pub}편 · 초안 ${rows[0].dr}편`);
await pool.end();
