/**
 * 「AI 강의를 들었는데 왜 업무는 그대로일까요?」 — 성인 AI 업무자동화반을 여는 첫 글.
 *
 * 상담 기록(academy.inquiries)에 성인 발화가 아직 없다. 그래서 상담 장면으로 열지 않고
 * 공개된 칼럼 원문으로 연다. 지어낸 장면이 하나도 없어야 한다.
 *   칼럼   오픈애즈 「AI 강의를 듣지 않게 된 이유」 웹핏, 2026-09-07 (원문 대조함)
 *          https://www.openads.co.kr/content/contentDetail?contsId=20354
 *   가격   패스트캠퍼스 판매 페이지 2026-09-28 — 직장인 업무자동화 289,000원(VOD 약 50시간·31개 툴·40가지 잡무)
 *   후기   인프런 n8n 강의 수강평 「진짜 초보자분들에게는 여전히 난이도가 있어보이고」
 *   학원   /ai-work 수강료 = 홈 수강료 표 성인 기준
 * 조사 전체: handoff/research/ai-work-course-2026-09-28.md
 *
 *   node scripts/seed-post-ai-work-gap.mjs           초안
 *   node scripts/seed-post-ai-work-gap.mjs --publish 공개
 */
import fs from "node:fs";
import { Pool } from "pg";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PUBLISH = process.argv.includes("--publish");
const SLUG = "ai-gangui-deureotneunde-eommu-geudaero";

const POST = {
  slug: SLUG,
  title: "AI 강의를 들었는데 왜 업무는 그대로일까요?",
  category: "성인 AI",
  tags: ["AI업무자동화", "직장인AI", "챗GPT활용", "업무자동화강의", "성인코딩"],
  summary:
    "강의가 모자라서가 아닙니다. 내 일 중 무엇을 맡길지 고르지 않았고, 막히는 자리에서 혼자였기 때문입니다. 맡길 일을 고르는 세 가지 기준과 하지 말아야 할 것을 적었습니다.",
  body: `오픈애즈에 올라온 칼럼 한 편이 있습니다. 제목이 「AI 강의를 듣지 않게 된 이유」입니다. 필자는 이렇게 씁니다. 「배운 것은 분명히 많아졌습니다. 사용할 수 있는 도구도 늘었습니다. 그런데 이상하게도 실제 업무는 그만큼 달라지지 않았습니다.」

같은 글에 이유도 있습니다. **「강의가 제 일의 조건까지 대신 판단해 줄 수는 없습니다.」** 저는 이 문장이 답이라고 봅니다. 강의가 모자란 게 아닙니다. 내 일에 붙이는 단계가 통째로 비어 있습니다.

## 강의가 틀린 건 아닙니다

강의는 도구를 빨리 알게 해 줍니다. 남이 어떻게 쓰는지 보여 주고, 처음 만지는 도구의 시행착오를 줄여 줍니다. 여기까지는 영상이 사람보다 쌉니다.

문제는 파는 방식입니다. 한 대형 플랫폼의 직장인 업무자동화 강의는 영상 약 50시간에 툴 31개, 잡무 40가지를 담았습니다. 할인가 289,000원입니다. 양이 많을수록 잘 팔립니다. 그런데 **툴 31개를 한 번씩 만져 본 사람보다 자동화 하나를 매일 돌리는 사람이 일이 줄어듭니다.**

## 비어 있는 두 자리

첫째, 고르는 자리입니다. 강의의 예제는 강사의 일입니다. 여행 계획, 뉴스 요약 봇. 내 책상 위 엑셀과는 모양이 다릅니다. 내 일 가운데 무엇을 맡길지는 아무도 정해 주지 않습니다.

둘째, 막히는 자리입니다. 한 n8n 강의 수강평에 이런 말이 있습니다. 「진짜 초보자분들에게는 여전히 난이도가 있어보이고」. 실제로 막히는 곳은 자동화의 원리가 아닙니다. 계정 연결, API 키 발급, 예약 설정입니다. 옆에 누가 있으면 몇 분이면 넘는 곳에서 혼자면 며칠을 씁니다.

![강의가 채우는 자리와 비어 있는 자리](/blog/${SLUG}/gap.svg)

## 맡길 일을 고르는 세 가지 기준

**하나, 한 주에 몇 번, 몇 분.** 두 숫자를 곱합니다. 한 주 30분이 안 되는 일은 자동화를 만드는 시간이 더 듭니다. 그냥 하시는 게 낫습니다.

**둘, 모양이 매번 같은가.** 같은 양식의 파일, 같은 종류의 메일. 입력 모양이 정해져 있어야 AI 에게 정확히 시킬 수 있습니다. 매번 사정이 다른 일은 자동화하면 예외에서 사고가 납니다.

**셋, 틀렸을 때 얼마나 아픈가.** 보고서 초안이 틀리면 사람이 고치면 됩니다. 발주 수량이 틀리면 돈이 나갑니다. 아픈 일일수록 AI 는 초안까지만 쓰고 마지막 버튼은 사람이 누릅니다.

## 하지 마셔야 할 것

**고객 개인정보를 외부 AI 에 넣지 마세요.** 주민번호, 진료 기록, 계좌번호. 편하다는 이유로 한 번 넣으면 되돌릴 수 없습니다. 회사 파일이 필요하면 칸 모양만 같은 가짜 데이터로 먼저 만듭니다.

**유료 요금제를 미리 여러 개 결제하지 마세요.** 무료 한도에 실제로 걸리는 지점이 오면 그때 하나를 고르면 됩니다. 결제부터 하면 도구가 목적이 됩니다.

**「이걸로 월 천」을 약속하는 강의는 거르세요.** 자동화가 줄여 주는 건 시간입니다. 얼마나 줄지는 가져온 일에 달렸고, 그건 강사가 미리 알 수 없습니다.

## 누구에게 무엇이 맞나

챗GPT 를 아직 안 써 봤다면 무료 공공 과정이 먼저입니다. 서울시50플러스재단(40세 이상)과 송파구 디지털 문해학습장이 기초를 다룹니다. 혼자 끝까지 들을 자신이 있다면 VOD 가 시간당 훨씬 쌉니다.

써 봤는데 일이 그대로인 분이 남습니다. 저희 학원은 이런 분을 위해 [성인 AI 업무자동화반](/ai-work)을 엽니다. 본인 업무 한 건을 들고 와서 돌아가는 자동화로 들고 가는 수업입니다.

어느 쪽이든 판단은 같습니다. 내 일 하나를 골라 **한 주 몇 번, 몇 분**을 적어 보세요. 그 숫자가 30분을 넘고 모양이 매번 같다면, 강의를 하나 더 사기 전에 그 일부터 붙여 볼 차례입니다.`,
  확인필요: [
    "칼럼 인용 두 문장 — 2026-09-28 원문 대조함",
    "패스트캠퍼스 289,000원·50시간·31개 툴·40가지 잡무 — 가격은 바뀔 수 있다",
    "「한 주 30분」 기준 — 원장 판단 기준으로 괜찮은지",
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
