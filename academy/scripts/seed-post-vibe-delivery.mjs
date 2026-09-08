/**
 * 「AI로 짰는데 왜 네 번 다시 했나」 — 실제 납품 사례 글.
 *
 * 사실은 전부 저장소에서 잰 것이다 (C:/dev/e_sem_kyo).
 *   기간   2026-04-01 ~ 09-08
 *   커밋   1,148
 *   코드   194파일 · 85,067줄 · 화면 31
 *   이관   66,094행 · 주문 47,271 · 고객 12,393 · 시도 4회
 * 지어낸 숫자가 하나도 없어야 이 글이 값을 한다.
 *
 * 발주처는 가린다. 회사명은 물론이고 지점명도 빼야 한다 —
 * 백화점 매장 목록이 들어가면 이름을 빼도 특정된다.
 *
 *   node scripts/seed-post-vibe-delivery.mjs           초안
 *   node scripts/seed-post-vibe-delivery.mjs --publish 공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");

const POST = {
  slug: "ai-ro-jjatneunde-wae-ne-beon",
  title: "AI가 코드를 다 써줬는데, 왜 네 번이나 다시 했을까요?",
  category: "교육관점",
  tags: ["AI코딩", "바이브코딩", "문제정의", "AI교육", "실무"],
  summary:
    "AI로 회사 시스템 하나를 만들어 납품했습니다. 코드는 AI가 썼는데 5개월이 걸렸고, 데이터 이관은 네 번 다시 했습니다. 막힌 자리가 어디였는지 적었습니다.",
  body: `요즘 "AI로 하루 만에 앱 만들었다"는 이야기가 많습니다. 저도 궁금해서 장난이 아니라 **실제로 돈 받는 일**에 써 봤습니다.

결론부터 말씀드리면, 코드는 정말 AI가 거의 다 썼습니다. 그런데 **5개월이 걸렸고, 한 부분은 네 번 다시 만들었습니다.**

## 무엇을 만들었나

전국에 매장을 둔 한 유통업체(A사)의 사내 통합 시스템입니다. 발주·생산·재고·판매·정산을 한 곳에서 보는 프로그램이고, 매장 계산대에서도 같은 시스템을 씁니다.

숫자로 적으면 이렇습니다.

- 만든 기간 **5개월**
- 고친 횟수 **1,148번**
- 코드 **85,067줄**, 화면 **31개**
- 옮겨야 할 옛 데이터 **8년치 66,094줄**

## AI가 잘한 것

솔직히 말하면 많습니다. 화면 만들기, 표 그리기, 데이터를 꺼내 오는 코드, 권한별로 메뉴 가리기. 이런 건 말로 설명하면 거의 바로 나왔습니다.

**혼자 5개월에 이만한 걸 만드는 건 예전 같으면 어려웠습니다.** 이 부분은 인정하고 넘어가야 합니다.

## 네 번 다시 만든 곳

문제는 다른 데서 났습니다. **8년치 옛 데이터를 새 시스템으로 옮기는 일**이었습니다.

한 번 만들어 넣고, 틀린 걸 발견하고, 전부 지우고 다시 넣었습니다. 그걸 네 번 했습니다.

## 왜 틀렸나

AI가 코드를 못 써서가 아니었습니다. **무엇을 시킬지 제가 정확히 몰랐던 것**입니다.

**하나.** 거래처를 나타내는 코드가 파일마다 달랐습니다. 같은 코드 하나가 한 파일에서는 본사인데 다른 파일에서는 다른 매장이었습니다. AI는 그걸 알 방법이 없습니다. 두 파일을 다 읽어도 어느 쪽이 맞는지는 그 회사 사람만 압니다.

**둘.** 전화번호가 없는 줄이 **16,649개** 있었습니다. 처음엔 잘못된 데이터라고 보고 버릴 뻔했습니다. 알고 보니 매장에서 그냥 사 간 손님이었습니다. 고객으로 등록할 수는 없지만 **매출에서 빼면 안 되는** 줄이었습니다.

**셋.** 같은 사람이 이름을 여러 가지로 남겨 놨습니다. 「홍길동」, 「홍길동 상호」, 「홍길동(메모)」. 이름으로 사람을 세면 한 명이 세 명이 됩니다. 그래서 **사람을 세는 기준을 이름이 아니라 전화번호로** 바꿨습니다.

이걸 알아내는 데 걸린 시간이, 코드 쓰는 시간보다 길었습니다.

## 그래서 무엇이 남는가

AI에게 "고객 목록을 만들어 줘"라고 하면 코드는 나옵니다. 그런데 **고객을 무엇으로 세는지**는 알려줘야 합니다. 이름인지 전화번호인지, 전화번호가 없는 사람은 고객인지 아닌지.

그걸 정하는 게 일의 절반이었습니다. 그리고 그건 코드를 몰라서 못 하는 게 아니라, **현장을 모르면 못 하는 일**입니다.

## 아이에게 무엇을 가르쳐야 하나

이 이야기를 학원 이야기로 돌리려는 게 아닙니다. 다만 제가 다섯 달 동안 확인한 것은 하나였습니다.

**코드를 쓰는 일은 값이 내려가고, 무엇을 시킬지 정하는 일은 값이 그대로입니다.**

그러니 아이에게 가르쳐야 할 것도 코드 문법 암기가 아닙니다. 지금 뭐가 문제인지 말로 정리해 보고, 그중에 뭐부터 풀지 정해 보고, 나온 답이 맞는지 확인해 보는 경험입니다.

## 하지 마셔야 할 것

**"그러니 AI를 빨리 배우게 하자"는 결론으로 가지 마십시오.** 도구를 먼저 배운 아이가 앞서는 게 아닙니다. 제가 다섯 달 동안 막힌 곳은 도구를 몰라서가 아니었습니다.

**그리고 "코딩은 이제 필요 없다"도 아닙니다.** AI가 쓴 코드가 틀렸을 때 어디가 틀렸는지 알아본 건, 결국 코드를 읽을 줄 알았기 때문입니다.

둘 다 필요하고, 순서가 있을 뿐입니다.`,
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

const { rows } = await pool.query(
  `select count(*) filter (where published) pub, count(*) filter (where not published) dr
     from academy.posts`,
);
console.log(`\n공개 ${rows[0].pub}편 · 초안 ${rows[0].dr}편`);
await pool.end();
