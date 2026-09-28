/**
 * 「혼자 일하는 사장님, AI 에게 무엇을 맡길 수 있나요?」 — 성인 AI 업무자동화반 두 번째 글.
 *
 * 재료는 원장 본인의 1인 회사 운영 기록뿐이다. 남의 가게 장면을 지어내지 않는다.
 *   AI 직원 8개 역할   academy/agents/ (audit·content·deliver·illustrate·pm·repair·research·sales)
 *   예약 작업 9개      .github/workflows/*.yml — cron 10개(wake.yml 은 cron 없음) 중 sales 는 9/24 부터 멈춤
 *   사람 몫            CLAUDE.md 「사람만 할 수 있는 일」 — 로그인·발행 전 사실 확인·상담 질문
 *   버린 초안          9/22 두 편, 9/23 한 편 (활동 기록 「초안 버림」, 메모리 draft-needs-real-material)
 *   공공 교육          소진공 2026 소상공인 AI 상생협업교육 「참가비 0원」, 구글 과정 9/29~11/3
 *                      https://www.enetnews.co.kr/news/articleView.html?idxno=54148
 * 고객사 이름은 쓰지 않는다. 1인 회사 이름도 쓰지 않는다(학원 글이 대행사 광고가 되면 안 된다).
 *
 *   node scripts/seed-post-ai-work-owner.mjs           초안
 *   node scripts/seed-post-ai-work-owner.mjs --publish 공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");
const SLUG = "honja-ilhaneun-sajangnim-ai-matgil-il";

const POST = {
  slug: SLUG,
  title: "혼자 일하는 사장님, AI 에게 무엇을 맡길 수 있나요?",
  category: "성인 AI",
  tags: ["1인사업자", "소상공인AI", "업무자동화", "AI직원", "사장님AI"],
  summary:
    "학원과 별개로 1인 회사를 AI 로 돌리고 있습니다. 맡겨서 잘 도는 일, 맡겼다가 도로 가져온 일, 처음부터 안 맡기는 일을 나눠 적었습니다.",
  body: `저는 학원 일과 별개로 1인 회사를 하나 꾸립니다. 직원은 없습니다. 대신 일을 AI 직원 8개 역할로 나눴습니다. 글 쓰는 역할, 그림 그리는 역할, 점검하는 역할, 고장 난 곳을 고치는 역할 같은 식입니다. 예약 작업 9개가 정해진 시각에 이들을 깨웁니다. 영업 역할은 9월 24일부터 쉬게 했습니다.

이렇게 쓰면 다 맡긴 것처럼 들립니다. 아닙니다. **맡긴 일, 맡겼다가 도로 가져온 일, 처음부터 안 맡기는 일**이 따로 있습니다. 사장님이 AI 에게 무엇을 맡길지 정할 때 이 구분이 제일 쓸모 있었습니다.

## 맡겨서 잘 도는 일

학원 홈페이지에 글을 올리면 프로그램이 네이버 블로그로 옮깁니다. 소제목 크기, 굵은 글씨, 구분선, 태그까지 붙입니다. 이 과정엔 제 손이 안 갑니다.

검색엔진에 새 글이 생겼다고 알리는 일도, AI 에게 정해진 질문을 던져 답에 학원 이름이 나오는지 재는 일도 예약으로 돕니다. 공통점은 **매번 모양이 같다**는 겁니다. 입력이 정해져 있고, 결과가 맞는지 기계가 확인할 수 있습니다.

## 맡겼다가 도로 가져온 일

글 초안입니다. 밤사이 AI 가 쓴 초안을 9월 22일에 두 편, 23일에 한 편 버렸습니다. 문장은 매끄러웠습니다. 그런데 학원 블로그라고 보기엔 너무 일반론이었고, 겪지도 않은 상담 장면을 그럴듯하게 지어 넣었습니다.

모델 탓이 아니었습니다. **재료를 안 줬기 때문**입니다. 상담에서 실제로 들은 말, 수업에서 실제로 있었던 일 없이 쓰라고 하면 AI 는 빈자리를 지어낸 것으로 채웁니다. 지금은 재료가 없으면 경험 글을 쓰지 않게 막아 두었습니다.

![맡긴 일, 도로 가져온 일, 안 맡기는 일](/blog/${SLUG}/split.svg)

## 처음부터 안 맡기는 일

**발행 전 사실 확인.** 숫자 하나가 틀리면 가게 신뢰가 통째로 흔들립니다. AI 가 초안에 넣은 숫자는 제가 근거를 찾아 대조합니다.

**손님에게 「어떻게 알고 오셨어요」 묻기.** 상담에서 사람이 물어야 나오는 답입니다. 매출이 어디서 왔는지 알 수 있는 유일한 고리라서 기록 화면까지 만들어 두고 제가 직접 적습니다.

**로그인과 보안 확인 문자.** 네이버·구글 로그인, 캡차는 우회하지 않습니다. 사람이 10초면 끝냅니다. 이걸 자동으로 뚫으려는 순간 계정이 위험해집니다.

## 사장님 가게에 옮겨 보면

주문 엑셀 정리, 예약 확인 문자 초안, 자주 오는 문의의 답 찾기, 장부 취합은 모양이 매번 같습니다. 맡길 만합니다. 항의에 대한 마지막 답, 돈이 나가는 확정, 손님 개인정보가 도는 일은 초안까지만 맡기거나 아예 안 맡깁니다.

홍보 이미지와 광고 문구가 급하다면 저희보다 무료 과정이 먼저입니다. 소상공인시장진흥공단의 2026 소상공인 AI 상생협업교육은 참가비가 없고, 구글 과정이 9월 29일부터 11월 3일까지 열립니다.

## 하지 마셔야 할 것

**처음부터 전부 맡기지 마세요.** 저도 초안을 세 편 버리고 나서야 무엇을 줘야 하는지 알았습니다. 한 건을 맡기고, 한 주 돌려 보고, 틀린 곳을 본 다음에 다음 건으로 넘어가세요.

**틀렸을 때 알 방법 없이 돌리지 마세요.** 자동화는 조용히 틀립니다. 결과를 누가, 언제 확인하는지 정해 두지 않으면 몇 주 뒤에 발견합니다. 저는 같은 일이 여러 번 실패하면 아침 보고에 「확인 필요」로 올라오게 해 두었습니다.

## 판단 기준

맡길지 말지는 세 가지로 정합니다. 매번 모양이 같은가. 결과가 맞는지 확인할 방법이 있는가. 틀렸을 때 사람이 한 번 보고 잡을 수 있는가. 셋 다 「예」인 일부터 하나 고르세요.

저희 학원 [성인 AI 업무자동화반](/ai-work)은 그 한 건을 들고 와서 실제로 돌아가게 만드는 수업입니다. 혼자 해 보셔도 기준은 같습니다. 셋 중 하나라도 「아니오」면, 그 일은 아직 사람 손에 두세요.`,
  확인필요: [
    "AI 직원 8개 역할·예약 작업 9개(cron 10 − 멈춘 sales) — 저장소 기준",
    "초안 버림 9/22 두 편·9/23 한 편 — 활동 기록 기준",
    "여러 번 실패한 일이 아침 보고 「확인 필요」에 오른다 — PM 보고(Step 19, 5번 이상) 기준",
    "소진공 구글 과정 9/29~11/3 — 기사 기준",
  ],
};

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});

await pool.query(
  `insert into academy.posts (slug,title,summary,body,category,tags,published,published_at,client_id,updated_at)
   values ($1,$2,$3,$4,$5,$6,$7,$8,1,now())
   on conflict (slug) do update set
     title=excluded.title, summary=excluded.summary, body=excluded.body,
     category=excluded.category, tags=excluded.tags, published=excluded.published,
     published_at=coalesce(academy.posts.published_at, excluded.published_at),
     updated_at=now()`,
  [POST.slug, POST.title, POST.summary, POST.body, POST.category, POST.tags,
   PUBLISH, PUBLISH ? new Date() : null],
);

const paras = POST.body.split("\n\n").filter((x) => x.trim() && !x.startsWith("##") && !x.startsWith("!["));
const good = paras.filter((x) => x.length >= 80 && x.length <= 400).length;
console.log(POST.title);
console.log(`  ${POST.body.length}자 · 인용 좋은 문단 ${good}/${paras.length} · ${PUBLISH ? "공개" : "초안"}`);
console.log(`  https://robotncoding.com/blog/${POST.slug}`);
console.log("\n발행 전에 확인하실 것:");
for (const s of POST.확인필요) console.log("  ·", s);
await pool.end();
