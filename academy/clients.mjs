/**
 * 고객사별 측정 설정.
 *
 * 09.10 에 아이로그를 고객사로 받으면서 DB 표에 client_id 칸은 만들었는데,
 * 실제로 일하는 스크립트(노출 측정·색인 알림·점검·브리핑)는 도메인과 검색어가
 * 로봇&코딩학원으로 박힌 채였다. 그래서 아이로그는 하루가 넘도록 한 번도 안 쟀다.
 * 사람 직원이면 착수 첫날 했을 일이다.
 *
 * 이제 스크립트는 전부 이 목록을 돈다. 고객사를 받으면 여기 한 덩어리를 추가한다.
 * id 는 geo.clients.id 와 같아야 한다.
 *
 * 검색어 종류
 *   경쟁   이름 없이 찾는 말. 살 사람이 실제로 치는 말. 이것만 성과로 센다
 *   브랜드 이름이 들어간 말. 이긴 자리가 아니라 「방어되고 있는지」를 본다
 *   색인   site: 검색. 올라갔는지 보는 것이지 순위가 아니다
 */

export const CLIENTS = [
  {
    id: 1,
    slug: "robotncoding",
    name: "로봇&코딩학원",
    domain: "robotncoding.com",
    // 네이버 통합검색은 블록마다 링크 형태가 달라 이름 글자로 찾는다
    brandRe: /로봇앤코딩|로봇&amp;코딩|robotncoding/i,
    // 남의 페이지에 「우리가 올라 있나」는 이름만으로 못 가린다 — 로봇앤코딩학원이 강남·광진·서대문에도 있다.
    // 주소나 전화 끝자리가 같이 있어야 우리다 (who-wins.mjs)
    presenceRe: /석촌동\s*274-8|송파대로37길\s*52|422-?0525|1396-?0525/,
    // AI 답에 이름이 나왔나 (ai-measure.mjs · tools/ai-web-measure.mjs 가 같이 쓴다).
    // 「똑똑한 로봇&코딩학원」(glcedu.co.kr)은 다른 곳이다. 이름만 보고 세면 남의 노출을 우리 것으로 센다
    answerRe: /(?<!똑똑한\s?)(로봇\s?(&|&amp;|앤|and)\s?코딩)|robotncoding/i,
    // 사이트 저장소가 이 저장소 안에 있어 키 파일을 직접 둔다
    indexnowKeyFile: "public/indexnow-key.txt",
    // health.mjs 가 /llms.txt 가 열리는지 본다. 안 둔 고객은 빼 둔다
    llmsTxt: true,
    publishes: true,
    // 개선 루프(daily-agent.mjs) 설정 — Step 30 전까지 코드에 박혀 있던 값 그대로
    loop: {
      // 이름 질문은 질문에 이름이 들어 있어 답이 따라 말한다. 인용이나 이 말이 나와야 적중
      brandHit: /석촌/,
      // 홈 JSON-LD 가 전부 맞아야 entity 칸 통과
      homeLd: [/"address"/, /석촌|송파/],
      homeLdMissing: "홈 JSON-LD 에 address 또는 석촌·송파 없음",
      homeLdFix: "academy/app/page.tsx 의 JSON-LD 에 주소·지역을 넣고 배포합니다.",
      // 글은 write-draft 가 academy.posts 에 초안으로 쓴다
      draft: "write-draft",
      // 탐침에서 안 불린 반경 글(Step 31 D41)은 세션이 쓴다 — 세션 글 일감에 적는 자리
      draftWhere: "academy.posts 초안(원장이 /admin/drafts 에서 사실 확인 후 발행)",
      // 반경 넓힘 탐침(loop-review widen)은 송파 동네 말로만 짜여 있다
      probes: true,
      offsite: [
        "사이트 글과 검색 색인으로도 안 움직였습니다. 네이버 플레이스·Google Business Profile처럼 학원이 직접 관리할 수 있는 외부 정보의 사실 일치와 최신성을 확인합니다.",
        "사이트 글로는 안 움직였고, 답에 출처가 안 잡혀 등록할 곳을 고르지 못했습니다. 네이버 플레이스·지역 카페 노출을 먼저 확인합니다.",
      ],
    },
    queries: [
      { id: "idx", q: "site:robotncoding.com", kind: "색인" },
      { id: "c1", q: "송파구 코딩학원", kind: "경쟁" },
      { id: "c2", q: "송파 초등 코딩학원 추천", kind: "경쟁" },
      { id: "c3", q: "송파구 석촌동 코딩학원", kind: "경쟁" },
      { id: "c4", q: "잠실 초등 코딩학원", kind: "경쟁" },
      { id: "c5", q: "송파구 로봇교실", kind: "경쟁" },
      { id: "c6", q: "헬리오시티 코딩학원", kind: "경쟁" },
      // AI 답변에서 「똑똑한 로봇&코딩학원」(glcedu.co.kr) 이 우리 자리를 가져간 적이 있다
      { id: "b1", q: "로봇앤코딩학원 석촌동", kind: "브랜드" },
      { id: "b2", q: "석촌동 로봇 코딩학원", kind: "브랜드" },
    ],
  },
  {
    id: 2,
    slug: "ilog",
    name: "아이로그",
    domain: "ilog.ai.kr",
    /**
     * 「아이로그」 글자로 찾으면 안 된다.
     * 네이버 통합검색 「아이로그」 첫 화면에 그 글자가 444번 나오는데 전부 다른 곳이다 —
     * (주)아이로그(ilog.co.kr, SI 회사), ILOG(ilog.kr), 포항 미용실.
     * 글자로 세면 남의 노출을 우리 노출로 센다. 도메인으로만 센다.
     */
    brandRe: /ilog\.ai\.kr/i,
    /**
     * AI 답은 이름도 센다(Step 30 D34). 「학원 관리 프로그램」 질문의 답에서 아이로그는 우리다.
     * 동명 SI 회사는 「(주)아이로그」「㈜아이로그」「주식회사 아이로그」로 불리니 그 꼴은 뺀다. 「ilog」 단독은 안 센다 — 영어 답의 IBM ILOG 와 겹친다.
     * DB(geo.clients.answer_pattern)에는 academy/scripts/seed-ilog-panel.mjs 가 이 원문을 넣는다
     */
    answerRe: /(?<!(?:\(주\)|㈜|주식회사)\s?)아이로그|ilog\.ai\.kr/i,
    // 사이트 저장소가 밖에 있다. 키 파일은 전달 파일(deliverables/ilog/public)로 넘긴다
    indexnowKey: "7c1e9a4b2f6d8053a1c4e7b9d2f05a68",
    // deliverables/ilog/public/llms.txt 로 넘겼고 열린다(2026-09-30 확인 200)
    llmsTxt: true,
    publishes: false,
    loop: {
      /**
       * 이름 질문(「아이로그 …」)은 답이 이름을 따라 말한다. 우리 제품을 실제로 아는 답인지는 기능 말로 가린다 —
       * 출결·알림톡·수업 피드백은 lib/guides.ts 에 적힌 아이로그 기능이다. 동명 SI 회사·미용실 답에는 안 나온다
       */
      brandHit: /출결|알림톡|수업\s?피드백/,
      // 홈 JSON-LD 는 SoftwareApplication(components/seo/JsonLd.tsx, 2026-09-30 운영 주소에서 확인)
      homeLd: [/"SoftwareApplication"/, /ilog\.ai\.kr/],
      homeLdMissing: "홈 JSON-LD 에 SoftwareApplication 또는 ilog.ai.kr 없음",
      homeLdFix: "아이로그 저장소(C:\\dev\\자동피드백생성기) components/seo/JsonLd.tsx 의 SoftwareApplication 을 넣고 npx vercel --prod 로 배포합니다.",
      // 글은 DB 가 아니라 코드다. 자동 경로가 없어 Claude 세션이 이 파일에 쓴다
      draft: "session",
      draftWhere: "C:\\dev\\자동피드백생성기 lib/guides.ts",
      /**
       * 넓힐 동네가 없다. 대신 승인 검색어형 질문에서 틀 말을 뺀 기능 말(「학원 출결 관리」 등)로 변형 탐침을 만든다(Step 31 D43).
       * 기능 말은 승인 질문에 나온 말만 — 여기 목록을 두지 않고 strip 으로 뺀 나머지를 쓴다
       */
      probes: "variants",
      probeVariants: { forms: ["{기능} 앱", "{기능} 프로그램", "{기능} 무료"], strip: /추천|무료|앱|프로그램/g },
      offsite: [
        "사이트 글과 검색 색인으로도 안 움직였습니다. 아이로그가 직접 고칠 수 있는 바깥 정보(앱·서비스 소개가 올라간 곳)의 사실 일치와 최신성을 확인합니다.",
        "사이트 글로는 안 움직였고, 답에 출처가 안 잡혀 확인할 곳을 고르지 못했습니다.",
      ],
    },
    queries: [
      { id: "idx", q: "site:ilog.ai.kr", kind: "색인" },
      // 학원 원장이 프로그램을 고를 때 치는 말. 09.11 AI 기준선 질문과 같은 축이다
      { id: "c1", q: "학원 관리 프로그램", kind: "경쟁" },
      { id: "c2", q: "학원관리프로그램 추천", kind: "경쟁" },
      { id: "c3", q: "무료 학원 관리 프로그램", kind: "경쟁" },
      { id: "c4", q: "학원 출결 관리 앱", kind: "경쟁" },
      { id: "c5", q: "학원 카톡 알림 프로그램", kind: "경쟁" },
      { id: "c6", q: "학원 수업 리포트 앱", kind: "경쟁" },
      // 이름이 겹친다. 이름만으로 찾는 사람에게 우리가 보이는지가 방어의 핵심이다
      { id: "b1", q: "아이로그", kind: "브랜드" },
      { id: "b2", q: "아이로그 학원", kind: "브랜드" },
      { id: "b3", q: "아이로그 학원관리", kind: "브랜드" },
    ],
  },
];

/**
 * 어느 고객사를 돌지 고른다.
 *   --client ilog      슬러그로 한 곳
 *   CLIENT_ID=2        번호로 한 곳 (옛 호출 방식)
 *   아무것도 없으면     전부
 */
export function selectClients(argv = process.argv) {
  const i = argv.indexOf("--client");
  if (i > 0 && argv[i + 1]) {
    const c = CLIENTS.find((x) => x.slug === argv[i + 1]);
    if (!c) throw new Error(`고객사 없음: ${argv[i + 1]} (있는 것: ${CLIENTS.map((x) => x.slug).join(", ")})`);
    return [c];
  }
  if (process.env.CLIENT_ID) {
    const c = CLIENTS.find((x) => x.id === Number(process.env.CLIENT_ID));
    if (!c) throw new Error(`고객사 없음: CLIENT_ID=${process.env.CLIENT_ID}`);
    return [c];
  }
  return CLIENTS;
}

export const bySlug = (slug) => CLIENTS.find((x) => x.slug === slug);

/** 글 쓰는 길이 세션인 고객(loop.draft = "session")의 글 일감 제목. 개선 루프와 회사 루프가 같은 제목을 쓴다 */
export const 세션글제목 = (name, question) => `세션에서 ${name} 가이드 초안: 「${question}」`;
/*
 * AI 답변 측정 설정(이름 판별 answerRe)은 geo.clients.answer_pattern 이 먼저다(Step 25).
 * 여기 answerRe 는 DB 칸이 비었을 때 쓰는 대체값이고, 비어 있는 DB 칸을 처음 채우는 원문이기도 하다.
 * 외부 고객은 여기 덩어리 없이 등록 화면(/admin/pilots)에서 이름 판별 말을 받아 DB 에만 둔다 → academy/measure-targets.mjs
 */
