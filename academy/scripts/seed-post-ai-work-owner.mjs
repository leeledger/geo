/**
 * 「사장님 AI 업무자동화, 가게 일 중 무엇을 자동화할 수 있나요?」 — 성인 AI 업무자동화반 두 번째 글.
 *
 * 2026-09-28 첫 판(「맡긴 일·가져온 일·안 맡기는 일」 에세이)은 원장이 AI slop 으로 돌려보냈다.
 * 이 판은 결과물 목록으로 쓴다 — 가게 일마다 지금 방식 → 자동화 후 → 도구 → 몇 회차.
 *
 * 근거
 *   예시 업무   경쟁 과정 실습에서 자주 나오는 것 (research §8 (b)) — 문의 답장 초안, 파일 취합,
 *               영수증 → 장부, 명단 메일, 리뷰 분류, 현황판, FAQ 비서, 뉴스 요약 리포트
 *   회차        /ai-work CURRICULUM 과 같다. 한쪽을 고치면 다른 쪽도
 *   학원 사례   tools/naver-blog-post.mjs(사이트 글 → 네이버, 서식·태그), academy/scripts/indexnow.mjs,
 *               AI 답변 측정(MEASURE_EVERY_DAYS=1)
 *   무료 과정   소진공 2026 소상공인 AI 상생협업교육 「참가비 0원」
 *               https://www.enetnews.co.kr/news/articleView.html?idxno=54148
 * 남의 가게 장면·수강생 후기를 지어내지 않는다. 아직 수강생이 없다.
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
  title: "사장님 AI 업무자동화, 가게 일 중 무엇을 자동화할 수 있나요?",
  category: "성인 AI",
  tags: ["소상공인AI", "사장님AI", "업무자동화", "1인사업자", "송파성인코딩"],
  summary:
    "문의 답장, 주문 파일 정리, 영수증 장부, 안내 메일, 리뷰 정리, 매출 현황판, 가게 FAQ 비서, 아침 소식 요약. 성인 AI 업무자동화반에서 만들 수 있는 가게 일 8가지를 도구와 회차별로 정리했습니다.",
  body: `로봇&코딩학원 **성인 AI 업무자동화반**은 8회 과정입니다. 마지막 회에는 수강생이 처음에 고른 **내 업무 1가지**를 자동화로 완성합니다. 업무자동화 강의 실습에 자주 나오는 것 가운데 가게 일에 맞는 8가지를 골라, 어떤 도구로 몇 회차에서 만드는지 정리했습니다.

![가게 일별 자동화 도구와 회차](/blog/${SLUG}/shop.svg)

## 가게 일 8가지, 이렇게 바뀝니다

**예약·문의 답장 초안 (5회)**

- 지금: 문의가 올 때마다 비슷한 답을 새로 씁니다.
- 자동화 후: 구글 폼이나 메일로 들어온 문의를 종류별로 나누고, 종류에 맞는 답장 초안이 만들어집니다. 보내기 버튼은 사장님이 누릅니다.
- 도구: 구글 폼, 스프레드시트, Apps Script, Gmail · **5회**

**여러 곳에서 받은 주문 파일 합치기 (4회)**

- 지금: 채널마다 받은 엑셀을 열어 한 파일로 복사해 붙입니다.
- 자동화 후: 같은 폴더에 파일을 넣고 버튼 하나를 누르면 한 양식으로 합쳐지고, 빈칸과 중복이 표시됩니다.
- 도구: 엑셀 매크로, VBA · **4회**

**영수증을 장부에 옮기기 (6회)**

- 지금: 카드 영수증과 결제 메일을 보고 장부에 한 줄씩 적습니다.
- 자동화 후: 결제 메일이 오면 날짜·가게·금액을 뽑아 구글 시트 장부에 자동으로 적습니다.
- 도구: n8n 또는 Make, Gmail, 구글 시트 · **6회**

**단골 안내 메일·안내문 보내기 (4~5회)**

- 지금: 휴무·이벤트 안내를 한 명씩 이름을 바꿔 보냅니다.
- 자동화 후: 시트의 명단으로 이름이 들어간 메일을 한 번에 보내고, 안내문 파일도 명단대로 만들어집니다.
- 도구: 구글 시트, Apps Script, 엑셀 VBA · **4~5회**

**손님 리뷰 정리 (5회)**

- 지금: 리뷰를 틈틈이 읽고 기억에 의존합니다.
- 자동화 후: 모아 둔 리뷰를 칭찬·불만·요청으로 나누고, 자주 나오는 말을 한 장으로 요약합니다.
- 도구: 구글 시트, ChatGPT · **5회**

**월별 매출 현황판 (3회)**

- 지금: 월말에 계산기와 엑셀로 합계를 냅니다.
- 자동화 후: 매출 파일을 붙여넣으면 피벗테이블과 차트가 달린 현황판이 바로 갱신됩니다.
- 도구: 엑셀 함수, 피벗테이블, 차트 · **3회**

**가게 FAQ 비서 (7회)**

- 지금: 영업시간, 주차, 가격, 준비물 같은 질문에 매번 같은 답을 합니다.
- 자동화 후: 가게 안내 문서를 넣은 맞춤형 GPT 나 Gems 가 직원 대신 기본 질문에 답합니다. 문서에 없는 질문은 모른다고 답하게 만듭니다.
- 도구: GPTs, Gems, NotebookLM · **7회**

**매일 아침 업계 소식 요약 (6회)**

- 지금: 틈날 때 거래처 소식, 업계 뉴스, 동네 가게 블로그 새 글을 찾아 읽습니다.
- 자동화 후: 정해 둔 뉴스·블로그의 새 글을 모아 요약한 리포트가 매일 아침 메일이나 텔레그램으로 옵니다.
- 도구: n8n 또는 Make, RSS, Gmail · **6회**

## 학원에서 실제로 쓰는 자동화

로봇&코딩학원도 운영 일 일부를 자동화로 돌립니다. 학원 홈페이지에 글을 올리면 프로그램이 네이버 블로그로 옮기면서 소제목·굵은 글씨·구분선·태그를 붙입니다. 새 글을 검색엔진에 알리는 일과, AI 답변에 학원 이름이 나오는지 매일 확인하는 일도 예약으로 돌아갑니다.

원장은 의료정보시스템, 생산·물류 ERP, 쇼핑몰, 금융사·카드사 콜센터 시스템을 개발해 왔습니다. 수업에서는 이 자동화들을 직접 보여 드리고, 사장님 가게 일에 맞게 옮기는 과정을 함께 합니다.

## 자동화하지 않는 일

- 손님 항의에 대한 마지막 답. 초안까지만 AI 가 씁니다.
- 결제·이체·발주 확정. 누르는 건 사람입니다.
- 주민번호·계좌·진료 기록처럼 외부 AI 에 넣으면 안 되는 정보가 도는 일

8회 수업에서 이 기준을 따로 다룹니다.

## 홍보 이미지가 목적이라면

가게 홍보 이미지와 광고 문구가 급하다면 이 반보다 무료 과정이 먼저입니다. 소상공인시장진흥공단의 2026 소상공인 AI 상생협업교육이 참가비 없이 열립니다. 이 반은 위의 8가지처럼 매일·매주 반복되는 운영 업무를 다룹니다.

## 수강 안내

- 장소: 서울 송파구 석촌동 274-8 2층, 로봇&코딩학원
- 과정: 8회 (월 4회 × 2개월), 회당 120분
- 수강료: 월 4회 200,000원 (부가세 포함, 성인 수강료 기준)
- 준비물: 노트북, 구글 계정, 자동화하고 싶은 가게 일 1가지
- 반 편성·시간표: 상담 시 안내
- 문의: 전화 02-422-0525, 카카오톡 채널 「로봇&코딩학원」

회차별 커리큘럼은 [성인 AI 업무자동화반](https://robotncoding.com/ai-work) 페이지에 있습니다.`,
  확인필요: [
    "가게 일 8가지 — 경쟁 과정 실습 목록 기준 예시. 실제 수강생 결과물이 생기면 바꿔 넣기",
    "학원 자동화 3가지(네이버 이관·색인 알림·AI 답변 매일 측정) — 저장소 기준",
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

const paras = POST.body.split("\n\n").filter((x) => x.trim() && !x.startsWith("##") && !x.startsWith("![") && !x.startsWith("- ") && !x.startsWith("**"));
const good = paras.filter((x) => x.length >= 80 && x.length <= 400).length;
console.log(POST.title);
console.log(`  ${POST.body.length}자 · 인용 좋은 문단 ${good}/${paras.length} · ${PUBLISH ? "공개" : "초안"}`);
console.log(`  https://robotncoding.com/blog/${POST.slug}`);
console.log("\n발행 전에 확인하실 것:");
for (const s of POST.확인필요) console.log("  ·", s);
await pool.end();
