/**
 * 「직장인 AI 업무자동화 수업, 8회 동안 무엇을 배우나요?」 — 성인 AI 업무자동화반 모집 글.
 *
 * 2026-09-28 첫 판(칼럼 인용으로 여는 에세이)은 원장이 AI slop 으로 돌려보냈다.
 * 「실제로 다른 강의하는 곳의 글을 참고해서 커리큘럼을 잘 보고 비슷하게」.
 * 그래서 이 판은 모집 글의 표준 구성을 따른다 — 대상 → 회차별 커리큘럼·실습 → 도구 → 안 맞는 분 → 수강 안내.
 *
 * 근거
 *   커리큘럼   경쟁 과정 목차에서 겹치는 순서 (handoff/research/ai-work-course-2026-09-28.md §8)
 *              패스트캠퍼스 직장인 업무자동화·n8n, 인프런, 이젠아카데미, 한국GPT협회, 서울시50플러스 고급과정
 *   수강료     홈 수강료 표 성인 기준(월 4회·120분 200,000원)
 *   무료 과정  서울시50플러스재단, 송파구 디지털 문해학습장, 소상공인시장진흥공단 AI 상생협업교육
 * 랜딩 /ai-work 의 CURRICULUM 과 회차·결과물이 같아야 한다. 한쪽을 고치면 다른 쪽도.
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
  title: "직장인 AI 업무자동화 수업, 8회 동안 무엇을 배우나요?",
  category: "성인 AI",
  tags: ["AI업무자동화", "직장인AI", "엑셀자동화", "챗GPT활용", "송파성인코딩"],
  summary:
    "로봇&코딩학원 성인 AI 업무자동화반의 8회 커리큘럼입니다. 회차마다 실습 결과물을 하나씩 만들고, 마지막 회에는 본인 업무 1가지를 자동화로 완성합니다. 대상·도구·준비물·수강료를 함께 적었습니다.",
  body: `로봇&코딩학원에서 직장인과 사업하시는 분들을 위한 **AI 업무자동화반**을 엽니다. 서울 송파구 석촌동 학원에서 직접 만나 수업하는 성인반이고, 회당 120분씩 8회 과정입니다. 회차별로 무엇을 배우고 무엇을 만드는지 아래에 적었습니다.

![AI 업무자동화반 8회 커리큘럼](/blog/${SLUG}/curriculum.svg)

## 이런 분께 맞습니다

- 엑셀 파일 합치기, 보고서 취합, 같은 내용의 메일 보내기를 매주 손으로 하는 직장인
- 주문·예약·문의·장부를 혼자 챙기는 사장님
- 챗GPT 에게 질문은 해 봤지만 업무에 붙이는 데서 멈춘 분
- 온라인 강의를 샀는데 계정 연결이나 설정에서 막혀 끝까지 못 간 분

코딩은 몰라도 됩니다. 코드가 필요한 곳은 AI 가 씁니다. 수강생은 그 코드를 붙여넣고 실행해서, 결과가 맞는지 확인하는 법을 배웁니다.

## 회차별 커리큘럼

**1회 · AI 업무 활용 시작, 자동화할 업무 고르기**

- ChatGPT·Claude·Gemini 가입과 화면, 무료와 유료의 차이
- 프롬프트 기본 구조: 역할, 맥락, 조건, 출력 형식
- 내 업무 목록 적기 — 한 주 몇 번, 한 번에 몇 분
- 과정 끝까지 가져갈 내 업무 1가지 정하기

실습 결과물: 내 업무 목록표, 자주 쓰는 지시문 모음

**2회 · 문서 업무: 회의록, 보고서, 이메일**

- 녹음 파일을 받아쓰고 회의록으로 요약하기 (클로바노트)
- PDF·긴 문서 요약, 보고서 초안 만들기 (NotebookLM)
- 상황별 이메일 초안: 거래처 회신, 일정 조율, 안내문
- AI 가 지어낸 내용을 찾아내는 법

실습 결과물: 회의록 요약 양식, 상황별 메일 초안 모음

**3회 · 엑셀 ①: 함수, 정리, 현황판**

- 상황을 설명해서 AI 에게 맞는 함수 받기 (IF, SUMIFS, XLOOKUP)
- 정렬·필터·조건부서식으로 데이터 정리, 중복값과 빈칸 찾기
- 피벗테이블과 차트로 월별 현황판 만들기

실습 결과물: 월별 매출·업무 현황판

**4회 · 엑셀 ②: 매크로와 VBA 로 반복 작업 없애기**

- 매크로 기록과 실행, VBA 편집기 쓰는 법
- AI 가 짜 준 VBA 코드를 붙여넣고 돌려 보기
- 같은 양식의 파일 여러 개를 하나로 합치기
- 명단 하나로 계약서·안내문·수료증을 한꺼번에 만들기

실습 결과물: 파일 취합 매크로, 명단 기반 문서 대량 생성

**5회 · 구글 시트와 Apps Script**

- 구글 폼으로 받은 신청·문의를 시트에 쌓기
- 시트 명단으로 Gmail 개별 메일 보내기
- 시트 안에서 AI 로 문의를 분류하고 답장 초안 만들기
- 정해진 시각에 저절로 돌게 예약(트리거) 걸기

실습 결과물: 문의 접수 → 분류 → 답장 초안 메일

**6회 · 노코드 자동화: n8n, Make**

- 트리거, 노드, 실행 기록 개념
- 받은 메일을 분류해서 시트에 기록하고 텔레그램으로 알림 보내기
- 뉴스·블로그 RSS 를 모아 요약 리포트 만들기
- 영수증 메일에서 금액을 뽑아 장부 시트에 적기

실습 결과물: 매일 아침 도착하는 요약 리포트, 영수증 → 장부 자동 기록

**7회 · 나만의 AI 비서와 작은 도구**

- 업무 매뉴얼과 FAQ 를 넣은 맞춤형 GPT(GPTs)·Gems 만들기
- 사내 문서를 근거로 답하게 하기 (NotebookLM)
- 말로 설명해서 화면이 있는 웹 도구 만들기 (바이브코딩)

실습 결과물: 우리 업무 FAQ 비서, 나만 쓰는 계산·정리 도구

**8회 · 내 업무 자동화 완성과 시연**

- 1회에 고른 업무를 끝까지 완성하기
- 멈췄을 때 실행 기록을 읽고 고치는 법
- 개인정보가 도는 일, 결제 확정은 자동화하지 않는 기준
- 본인 컴퓨터에서 실제로 돌리는 3분 시연

실습 결과물: 매주 쓰는 내 업무 자동화 1개

## 쓰는 도구

ChatGPT·Claude·Gemini 가운데 편한 것 하나를 주로 씁니다. 여기에 엑셀, 구글 스프레드시트와 Apps Script, n8n 또는 Make 를 붙입니다. 모든 도구를 다 익히는 과정은 아닙니다. 8회에는 내 업무에 맞는 도구 하나로 완성합니다.

처음에는 무료 요금제로 시작합니다. 무료 계정은 사용 횟수 제한이 있어서 긴 실습 중에 막힐 수 있습니다. 유료로 바꿀지는 몇 번 써 보고 정해도 늦지 않습니다.

## 온라인 강의와 무엇이 다른가요

판매 중이거나 모집 중인 업무자동화 과정 8곳의 목차를 살펴봤습니다. 순서는 대부분 비슷합니다. 프롬프트, 문서, 엑셀 함수와 VBA, 구글 시트, 노코드 자동화, AI 비서 순입니다. 이 반의 순서도 크게 다르지 않습니다.

다른 점은 두 가지입니다. 실습을 강사가 정한 예제가 아니라 **본인 업무로** 한다는 것, 그리고 계정 연결·API 키·예약 설정처럼 혼자 하다 막히는 곳을 **그 자리에서 같이 푼다**는 것입니다.

## 수강 안내

- 장소: 서울 송파구 석촌동 274-8 2층, 로봇&코딩학원
- 과정: 8회 (월 4회 × 2개월), 회당 120분
- 수강료: 월 4회 200,000원 (부가세 포함, 성인 수강료 기준)
- 준비물: 노트북, 구글 계정, 자동화하고 싶은 내 업무 1가지
- 반 편성·시간표: 상담 시 안내
- 문의: 전화 02-422-0525, 카카오톡 채널 「로봇&코딩학원」

과정 소개는 [성인 AI 업무자동화반](https://robotncoding.com/ai-work) 페이지에 더 자세히 있습니다.`,
  확인필요: [
    "8회 커리큘럼 — 경쟁 과정 공통 뼈대 기준. 원장님 수업 계획과 맞는지",
    "8회 = 월 4회 × 두 달 — 수강료 표 기준 산수",
    "반 편성·시간표·정원 — 원장님이 정하면 수강 안내에 추가",
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
