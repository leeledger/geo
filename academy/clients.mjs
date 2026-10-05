/**
 * 고객사별 측정 설정.
 *
 * 09.10 에 아이로그를 고객사로 받으면서 DB 표에 client_id 칸은 만들었는데,
 * 실제로 일하는 스크립트(노출 측정·색인 알림·점검·브리핑)는 도메인과 검색어가
 * 로봇&코딩학원으로 박힌 채였다. 그래서 아이로그는 하루가 넘도록 한 번도 안 쟀다.
 * 사람 직원이면 착수 첫날 했을 일이다.
 *
 * 이제 스크립트는 전부 loadClients(q) 를 돈다 — 아래 코드 덩어리 3곳 + geo.clients 에만 있는 고객(Step 37).
 * 새 고객은 덩어리 말고 geo.clients.config 에 넣는다(말만 — 정규식은 고객설정 이 lit 로 만든다).
 * 코드 덩어리 id 는 geo.clients.id 와 같아야 한다.
 *
 * 검색어 종류
 *   경쟁   이름 없이 찾는 말. 살 사람이 실제로 치는 말. 이것만 성과로 센다
 *   브랜드 이름이 들어간 말. 이긴 자리가 아니라 「방어되고 있는지」를 본다
 *   색인   site: 검색. 올라갔는지 보는 것이지 순위가 아니다
 */

export const CODE_CLIENTS = [
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
    // PC 로컬 에이전트가 매일 구글 색인 요청(submit-gsc.mjs)·빙 주소 제출(bing-submit-urls.mjs)을 도는 고객(Step 36)
    gsc: true,
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
     * DB(geo.clients.answer_pattern)에는 academy/scripts/seed-panel.mjs --client ilog 가 이 원문을 넣는다
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
  {
    /**
     * 문서딱(Step 32 D44) — 두 번째 자사 레퍼런스. 학원과 다른 업종인 무료 웹 도구(PDF·사진·HWP 5개).
     * 사실은 research/docttak-brief-2026-10-01.md 와 공개 사이트(2026-10-01 curl)에서만. 사이트 저장소는 우리가 안 건드린다.
     * id 3 은 geo.clients 시퀀스(마지막 5)가 다시 내주지 않는 빈 번호다 — seed-panel.mjs 가 이 번호로 넣는다
     */
    id: 3,
    slug: "docttak",
    name: "문서딱",
    domain: "docttak.com",
    // 검색 결과 화면에서는 도메인으로만 찾는다 — 「문서딱」 글자가 다른 곳에 없는지 아직 안 봤다
    brandRe: /docttak\.com/i,
    // AI 답은 이름도 센다. DB(geo.clients.answer_pattern)에는 seed-panel.mjs 가 이 원문을 넣는다
    answerRe: /문서딱|docttak(\.com)?/i,
    /**
     * 키는 일부러 안 넣는다. 문서딱 저장소가 배포마다 IndexNow 를 보낸다(Step 35 확인). 여기 넣으면 snapshot.yml 이 매일
     * 사이트맵 44쪽을 또 보내 겹친다. 손으로 한 번 보낼 때만: INDEXNOW 키 87c53aad239a45ff5caa9ce574b5e423 (2026-10-05 빙·네이버 200)
     */
    // https://docttak.com/llms.txt 200 text/plain (2026-10-01 확인)
    llmsTxt: true,
    publishes: false,
    /**
     * 사람 방문·크롤러 기록 장치를 달지 않는다. 정적 사이트(Cloudflare Pages)이고 추적·제3자 스크립트를 넣지 않기로 했다(브리프 「하지 말 것」).
     * 서버 숫자는 문서딱 저장소가 매주 내는 성장 리포트의 Cloudflare 합계로 본다(Step 36) — 봇이 섞인 숫자다
     */
    siteLog: "Cloudflare 주간 합계는 문서딱 성장 리포트(봇 포함)",
    // 구글 색인 요청·빙 주소 제출을 PC 에서 매일(Step 36)
    gsc: true,
    /**
     * 문서딱 저장소(공개)의 주간 성장 리포트(A-5 서치콘솔·Cloudflare)와 새 안내 페이지 후보 이슈(A-6).
     * academy/scripts/growth-import.mjs 가 매일 한 번 읽어 geo.growth_reports 에 쌓는다. 그쪽 코드는 우리가 안 고친다
     */
    growthReports: { repo: "leeledger/doc-tools-kr", dir: "reports/growth", opportunityLabel: "ops:opportunity" },
    loop: {
      // 이름 질문 3개는 도구 이름을 안 담는다. 답이 도구 이름을 대면 문서딱을 아는 답이다
      brandHit: /PDF\s?합치|PDF\s?용량|사진\s?용량|증명사진|여권\s?사진|HWP/i,
      /**
       * 홈 JSON-LD 는 WebSite·Organization 이다. WebApplication 은 도구 페이지(/pdf-merge/ 등)에만 있다(2026-10-01 curl).
       * 루프는 홈만 읽으니 홈에 실제로 있는 Organization 과 도메인으로 본다 — WebApplication 으로 보면 매일 헛경보가 난다
       */
      homeLd: [/"Organization"/, /docttak\.com/],
      homeLdMissing: "홈 JSON-LD 에 Organization 또는 docttak.com 없음",
      homeLdFix: "문서딱 사이트 코드는 문서딱 저장소 절차(설계 → 개발 → 리뷰 → 배포)로 고칩니다. 이 저장소에서는 고치지 않고 문서딱 세션에 넘깁니다.",
      // 글 쓰는 자동 경로가 없다. 세션이 안내 페이지 제안을 써서 문서딱 저장소에 넘긴다(그쪽이 /guide/* 로 반영)
      draft: "session",
      draftWhere: "deliverables/docttak/guide/ 안내 페이지 제안(문서딱 저장소가 설계·리뷰 뒤 /guide/ 로 반영)",
      /**
       * 변형 탐침(Step 31 D43 과 같은 틀). 도구 말은 승인 검색어형 질문에서 틀 말(무료·방법·사이트)을 뺀 나머지 — 새 말을 안 만든다.
       * 틀의 자리 이름은 loop-review 변형후보가 「{기능}」으로 읽는다. 여기서는 도구 말이다
       */
      probes: "variants",
      probeVariants: {
        forms: ["{기능} 무료", "{기능} 사이트"], strip: /무료|방법|사이트/g,
        // 씨앗 — 승인 질문에서 못 뽑는 실제 표현. 「pdf 병합」: 원장 2026-10-02 (사람들은 「pdf 합치기」와 함께 이렇게 친다)
        seeds: ["pdf 병합"],
      },
      offsite: [
        "사이트 글과 검색 색인으로도 안 움직였습니다. 답이 인용한 바깥 글(블로그·카페·지식iN·비교 글)에 문서딱 사실이 맞게 올라 있는지 확인하고, 정당한 소개와 사용 후기만 확보합니다(대가성이면 표시).",
        "사이트 글로는 안 움직였고, 답에 출처가 안 잡혀 확인할 곳을 고르지 못했습니다.",
      ],
    },
    /**
     * 바깥 글(Step 35 D53) — 지식iN·카페 매일 1편씩, 블로그 월·목. academy/scripts/marketing-draft.mjs 가 쓴다.
     * 승인 검색어 → 근거로 읽을 문서딱 페이지. guide 는 안내 페이지(블로그 원문 링크), tool 은 도구 페이지(지식iN 링크).
     * 둘 다 그날 사이트맵에 있어야 쓴다 — 사이트맵에 없는 주소(비공개 도구 등)는 근거로도 링크로도 안 쓴다.
     * 위에서부터 처음 맞는 줄. 맞는 줄이 없는 검색어는 초안을 안 쓴다(지어낼 근거가 없다)
     */
    marketing: {
      pages: [
        { re: /정부24/, guide: "/guide/upload-limits/", tool: "/pdf-compress/", also: ["/guide/pdf-compress/"] },
        { re: /pdf.*(합치|병합)/i, guide: "/guide/pdf-merge/", tool: "/pdf-merge/" },
        { re: /pdf.*용량/i, guide: "/guide/pdf-compress/", tool: "/pdf-compress/" },
        { re: /증명사진.*용량/, guide: "/guide/id-photo-kb/", tool: "/id-photo/" },
        { re: /사진.*(용량|kb)/i, guide: "/guide/photo-kb/", tool: "/photo-compress/" },
        { re: /여권/, guide: "/guide/passport-photo/", tool: "/id-photo/" },
        { re: /공무원/, guide: "/guide/gosi-photo/", tool: "/id-photo/" },
        { re: /큐넷/, guide: "/guide/qnet-photo/", tool: "/id-photo/" },
        { re: /증명사진.*(사이즈|규격)/, guide: "/guide/id-photo-size/", tool: "/id-photo/" },
        { re: /hwpx/i, guide: "/guide/what-is-hwpx/", tool: "/hwp-viewer/" },
        { re: /(hwp|한글파일).*pdf/i, guide: "/guide/hwp-to-pdf/", tool: "/hwp-to-pdf/" },
      ],
      // 블로그는 주 2편 — 요일(KST, 0=일)
      blogDays: [1, 4],
      // 본인 제작 공개(브리프 「대가성·본인 제작은 밝힌다」). 지식iN·카페·블로그 본문 끝에 그대로 있어야 통과
      disclosure: "제가 만든 무료 도구입니다(가입·업로드 없음).",
      /**
       * 블로그 게시(D55). 학원 블로그 세션과 섞이지 않게 따로 둔 프로필(tools/ 기준 — 로컬 에이전트가 tools 에서 돈다).
       * 블로그 아이디는 원장 PC 의 academy/.env.local NAVER_BLOG_ID_DOCTTAK. 프로필·아이디가 없으면 로컬 에이전트가 「로그인 필요」 일감을 한 번 올린다
       */
      blogProfile: ".browser-profile-docttak",
    },
    queries: [
      { id: "idx", q: "site:docttak.com", kind: "색인" },
      // 도구 5개에 하나씩. 브리프 「측정 요청」의 자동완성 검색어 원문
      { id: "c1", q: "pdf 합치기 무료", kind: "경쟁" },
      { id: "c2", q: "pdf 용량 줄이기", kind: "경쟁" },
      { id: "c3", q: "사진 용량 줄이기", kind: "경쟁" },
      { id: "c4", q: "여권사진 규격", kind: "경쟁" },
      { id: "c5", q: "hwp pdf 변환", kind: "경쟁" },
      { id: "b1", q: "문서딱", kind: "브랜드" },
      { id: "b2", q: "docttak", kind: "브랜드" },
    ],
  },
];

/**
 * 시험만 쓴다. 스크립트가 이걸 바로 읽으면 DB 고객이 조용히 빠진다(아이로그 사고) — test-clients.mjs 가드가 막는다.
 * 스크립트는 loadClients(q) / 고객고르기(argv, q)
 */
export const CLIENTS = CODE_CLIENTS;

/** 코드 덩어리 하나 — 그 고객 전용 스크립트(seed-*-panel)만. 고객 목록을 도는 데 쓰지 않는다 */
export const 코드덩어리 = (slug) => CODE_CLIENTS.find((x) => x.slug === slug) ?? null;

export const 도메인정리 = (d) => String(d ?? "").trim().toLowerCase()
  .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");

// ─────────────────────────────────────────── DB 고객 설정 (Step 37)
const 말상한 = 40, 목록상한 = 20;

/** 사람이 넣은 말 하나를 정규식 조각으로 — 특수 글자는 전부 글자 그대로 */
export const lit = (word) => String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const 글자인가 = (v) => typeof v === "string" && v.trim().length > 0;
const 객체인가 = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * config 칸 하나를 읽는다. 없으면 undefined(기본값), 형이 틀리면 빠짐에 적고 undefined.
 * 말 목록은 40자·20개까지 — 넘으면 자르지 않고 칸 전체를 기본값으로 둔다(잘린 말로 세면 남의 것을 센다)
 */
const 말목록 = (v, 칸, 빠짐) => {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || !v.every(글자인가)) { 빠짐.push(`config.${칸} 형이 틀림`); return undefined; }
  if (v.length > 목록상한 || v.some((x) => x.trim().length > 말상한)) { 빠짐.push(`config.${칸} 말이 너무 김`); return undefined; }
  return v.map((x) => x.trim());
};
const 참거짓 = (v, 칸, 빠짐) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") { 빠짐.push(`config.${칸} 형이 틀림`); return undefined; }
  return v;
};
const 한글자 = (v, 칸, 빠짐, 상한 = 300) => {
  if (v === undefined || v === null) return undefined;
  if (!글자인가(v)) { 빠짐.push(`config.${칸} 형이 틀림`); return undefined; }
  if (v.length > 상한) { 빠짐.push(`config.${칸} 말이 너무 김`); return undefined; }
  return v.trim();
};
const 말정규식 = (words, flags = "i") => new RegExp(words.map(lit).join("|"), flags);

/** 안내 페이지 줄 — all 은 묶음들, 묶음 안 말 하나만 있으면 된다. 순서 무관·대소문자 무시 */
const 페이지줄 = (p) => {
  if (!객체인가(p) || !Array.isArray(p.all) || !p.all.length || !글자인가(p.guide) || !글자인가(p.tool)) return null;
  const 묶음들 = p.all.map((g) => (Array.isArray(g) && g.length && g.every(글자인가) && g.length <= 목록상한 && g.every((x) => x.trim().length <= 말상한) ? g.map((x) => x.trim()) : null));
  if (묶음들.some((g) => !g) || 묶음들.length > 목록상한) return null;
  if (p.also !== undefined && !(Array.isArray(p.also) && p.also.every(글자인가))) return null;
  const 경로 = (s) => s.trim().startsWith("/");
  if (![p.guide, p.tool, ...(p.also ?? [])].every(경로)) return null;
  return {
    re: new RegExp(`^${묶음들.map((g) => `(?=[\\s\\S]*(?:${g.map(lit).join("|")}))`).join("")}`, "i"),
    all: 묶음들, guide: p.guide.trim(), tool: p.tool.trim(), ...(p.also ? { also: p.also.map((x) => x.trim()) } : {}),
  };
};

const JSONLD_TYPES = ["Organization", "LocalBusiness", "SoftwareApplication", "WebSite"];
const 블로그환경 = (slug) => `NAVER_BLOG_ID_${String(slug).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

/**
 * geo.clients 행 하나 → 코드 덩어리와 같은 모양의 설정. 순수 함수 — 가짜 행으로 시험한다.
 *   값 = 기본 ← derived ← config (뒤가 이김)
 *   출처 { 칸: '입력'|'점검'|'기본' }   빠짐 [ 「config.<칸> 형이 틀림」·「<칸> 없음」 … ]
 * 칸이 틀려도 고객 전체를 죽이지 않는다 — 그 칸만 기본값. 스크립트가 빠짐을 보고 그 고객의 그 일만 건너뛴다
 */
export function 고객설정(row, env = process.env) {
  const 빠짐 = [], 출처 = {};
  let config = row.config ?? {};
  if (!객체인가(config)) { 빠짐.push("config 형이 틀림"); config = {}; }
  if (config.v !== undefined && config.v !== 1) 빠짐.push(`config.v ${config.v} 모름 — v1 로 읽음`);
  const derived = 객체인가(row.derived) ? row.derived : {};
  const slug = String(row.slug), name = String(row.name ?? slug);
  const domain = 도메인정리(row.domain);
  if (!domain) 빠짐.push("domain 없음");
  const 고름 = (칸, 입력값, 점검값, 기본값) => {
    if (입력값 !== undefined) { 출처[칸] = "입력"; return 입력값; }
    if (점검값 !== undefined) { 출처[칸] = "점검"; return 점검값; }
    출처[칸] = "기본"; return 기본값;
  };
  for (const 칸 of ["id", "slug", "name", "domain"]) 출처[칸] = "입력";

  // 검색 결과 화면에서 우리로 셀 말 — 기본은 도메인(이름 글자는 남과 겹친다, 아이로그)
  const brandWords = 고름("brandRe", 말목록(config.brandWords, "brandWords", 빠짐), undefined, domain ? [domain] : []);
  const brandRe = brandWords.length ? 말정규식(brandWords) : null;

  // AI 답 이름 판별 — 등록 화면이 이스케이프해 만든 answer_pattern
  let answerRe = null;
  const 원문 = String(row.answer_pattern ?? "").trim();
  if (원문) { try { answerRe = new RegExp(원문, "i"); } catch { 빠짐.push("answer_pattern 정규식이 틀림"); } }
  else 빠짐.push("answerRe 없음");
  출처.answerRe = "입력";

  // 검색어 — 색인(site:)은 자동, 브랜드 기본 [이름], 경쟁은 사람이 넣는다
  let 경쟁 = [], 브랜드 = [name];
  출처.queries = "기본";
  if (config.queries !== undefined) {
    if (!객체인가(config.queries)) 빠짐.push("config.queries 형이 틀림");
    else {
      경쟁 = 말목록(config.queries.compete, "queries.compete", 빠짐) ?? [];
      브랜드 = 말목록(config.queries.brand, "queries.brand", 빠짐) ?? 브랜드;
      출처.queries = "입력";
    }
  }
  if (!경쟁.length) 빠짐.push("queries.compete 없음");
  const queries = [
    ...(domain ? [{ id: "idx", q: `site:${domain}`, kind: "색인" }] : []),
    ...경쟁.map((q, i) => ({ id: `c${i + 1}`, q, kind: "경쟁" })),
    ...브랜드.map((q, i) => ({ id: `b${i + 1}`, q, kind: "브랜드" })),
  ];

  const llmsTxt = 고름("llmsTxt", 참거짓(config.llmsTxt, "llmsTxt", 빠짐),
    typeof derived.llmsTxt?.ok === "boolean" ? derived.llmsTxt.ok : undefined, false);
  const gsc = 고름("gsc", 참거짓(config.gsc, "gsc", 빠짐), undefined, false);
  const siteLog = 고름("siteLog", 한글자(config.siteLog, "siteLog", 빠짐), undefined, "방문 기록 장치 없음");

  // IndexNow — 키가 있고 「우리」가 보낼 때만. 키 파일은 보내기 전에 indexnow.mjs 가 확인한다
  let indexnow = { mode: "우리" };
  출처.indexnow = "기본";
  if (config.indexnow !== undefined) {
    const x = config.indexnow;
    if (!객체인가(x) || !["우리", "고객 배포", "안 씀"].includes(x.mode)) 빠짐.push("config.indexnow 형이 틀림");
    else if (x.key !== undefined && !(typeof x.key === "string" && /^[A-Za-z0-9-]{8,128}$/.test(x.key))) {
      빠짐.push("config.indexnow.key 형이 틀림");
      indexnow = { mode: x.mode };
      출처.indexnow = "입력";
    } else { indexnow = { mode: x.mode, ...(x.key ? { key: x.key } : {}) }; 출처.indexnow = "입력"; }
  }
  const indexnowKey = indexnow.mode === "우리" && indexnow.key ? indexnow.key : undefined;

  // 개선 루프
  let 루프 = config.loop ?? {};
  if (!객체인가(루프)) { 빠짐.push("config.loop 형이 틀림"); 루프 = {}; }
  const hitWords = 고름("loop.brandHit", 말목록(config.hitWords, "hitWords", 빠짐), undefined, null);
  const 홈타입 = Array.isArray(derived.homeLdTypes) ? JSONLD_TYPES.find((t) => derived.homeLdTypes.includes(t)) : undefined;
  출처["loop.homeLd"] = 홈타입 ? "점검" : "기본";
  const homeLd = [/"@type"/, ...(domain ? [new RegExp(lit(domain), "i")] : []), ...(홈타입 ? [new RegExp(`"${홈타입}"`)] : [])];
  let offsite = 루프.offsite;
  if (offsite !== undefined && !(Array.isArray(offsite) && offsite.length === 2 && offsite.every(글자인가))) {
    빠짐.push("config.loop.offsite 형이 틀림"); offsite = undefined;
  }
  const loop = {
    brandHit: hitWords ? 말정규식(hitWords) : null,
    homeLd,
    homeLdMissing: `홈 JSON-LD 에 @type${홈타입 ? `·${홈타입}` : ""} 또는 ${domain} 없음`,
    homeLdFix: 고름("loop.homeLdFix", 한글자(루프.homeLdFix, "loop.homeLdFix", 빠짐), undefined,
      "고객 사이트는 우리 저장소에서 고치지 않습니다. 고객 담당에게 넘깁니다."),
    draft: "session",
    draftWhere: 고름("loop.draftWhere", 한글자(루프.draftWhere, "loop.draftWhere", 빠짐), undefined, `deliverables/${slug}/guide/ 제안`),
    probes: "variants",
    probeVariants: {
      forms: ["{기능} 추천", "{기능} 무료"],
      strip: /추천|무료|방법|사이트|앱|프로그램/g,
      seeds: 고름("loop.seeds", 말목록(루프.seeds, "loop.seeds", 빠짐), undefined, []),
    },
    // 문서딱 두 줄에서 문서딱 고유 말을 뺀 문장. 사실 주장이 없다 — 확인할 곳과 하지 않을 것만
    offsite: 고름("loop.offsite", offsite, undefined, [
      `사이트 글과 검색 색인으로도 안 움직였습니다. 답이 인용한 바깥 글(블로그·카페·지식iN·비교 글)에 ${name} 사실이 맞게 올라 있는지 확인하고, 정당한 소개와 사용 후기만 확보합니다(대가성이면 표시).`,
      "사이트 글로는 안 움직였고, 답에 출처가 안 잡혀 확인할 곳을 고르지 못했습니다.",
    ]),
  };

  // 바깥 글 — enabled·페이지 1줄 이상·공개 문구가 다 있어야 marketing-draft 가 돈다
  let 마케팅 = config.marketing ?? {};
  if (!객체인가(마케팅)) { 빠짐.push("config.marketing 형이 틀림"); 마케팅 = {}; }
  let pages = [];
  if (마케팅.pages !== undefined) {
    if (!Array.isArray(마케팅.pages)) 빠짐.push("config.marketing.pages 형이 틀림");
    else {
      pages = 마케팅.pages.map(페이지줄);
      if (pages.some((p) => !p)) { 빠짐.push("config.marketing.pages 형이 틀림"); pages = pages.filter(Boolean); }
    }
  }
  let blogDays = 마케팅.blogDays;
  if (blogDays !== undefined && !(Array.isArray(blogDays) && blogDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) {
    빠짐.push("config.marketing.blogDays 형이 틀림"); blogDays = undefined;
  }
  const marketing = {
    enabled: 참거짓(마케팅.enabled, "marketing.enabled", 빠짐) ?? false,
    pages,
    blogDays: 고름("marketing.blogDays", blogDays, undefined, [1, 4]),
    disclosure: 고름("marketing.disclosure", 한글자(마케팅.disclosure, "marketing.disclosure", 빠짐), undefined, null),
    blogProfile: `.browser-profile-${slug}`,
    blogId: 고름("marketing.blogId", 한글자(마케팅.blogId, "marketing.blogId", 빠짐, 60), undefined, env[블로그환경(slug)] || null),
  };
  출처["marketing.pages"] = pages.length ? "입력" : "기본";

  return {
    id: row.id, slug, name, domain, alias: row.alias ?? null, relation: row.relation ?? null, status: row.status ?? null,
    brandRe, presenceRe: null, answerRe, queries, llmsTxt, publishes: false, siteLog, gsc, indexnow, indexnowKey, loop, marketing,
    출처, 빠짐,
  };
}

/**
 * 코드 3곳 + geo.clients 에만 있는 고객. 순서 = 코드 3곳(학원 먼저, 지금 순서) → DB 고객 id 순.
 *   slug          그 고객 하나만
 *   includeTest   status 'test' 행도 (E2E·가림 검사·--client 로 콕 집을 때). 없으면 'active' 만
 *   strict        DB 를 못 읽으면 멈춘다(가림 검사 — 조용히 빼고 통과하면 안 된다)
 * q 가 없으면(일부러 DB 없이 — 시험·오프라인 모드) 코드 3곳만. DB 를 못 읽으면 코드 3곳만 + stderr 한 줄 — 학원 레퍼런스는 안 멈춘다
 * 행은 to_jsonb 로 읽는다 — config·derived 칸이 아직 없는 DB(고객설정준비 전)에서도 실패하지 않게
 */
export async function loadClients(q, { slug = null, includeTest = false, strict = false } = {}) {
  let rows = [];
  if (q) {
    try {
      rows = (await q(`select to_jsonb(c) as r from geo.clients c where c.status = any($1::text[]) order by c.id`,
        [includeTest ? ["active", "test"] : ["active"]])).map((x) => x.r);
    } catch (e) {
      if (strict) throw e;
      console.error(`DB 고객을 못 읽어 코드 고객 ${CODE_CLIENTS.length}곳만 돕니다 — ${String(e.message).slice(0, 120)}`);
      rows = [];
    }
  }
  const 코드slug = new Set(CODE_CLIENTS.map((c) => c.slug));
  for (const r of rows) {
    const c = 코드덩어리(r.slug);
    if (c && c.id !== r.id) console.error(`⚠ ${r.slug}: 코드 id ${c.id} ≠ DB id ${r.id} — 코드 설정을 씁니다`);
  }
  const 목록 = [
    ...CODE_CLIENTS.map((c) => ({ ...c, 출처: "코드", 빠짐: [] })),
    ...rows.filter((r) => !코드slug.has(r.slug)).map((r) => 고객설정(r)),
  ];
  return slug ? 목록.filter((c) => c.slug === slug) : 목록;
}

/**
 * 어느 고객사를 돌지 고른다 (옛 selectClients 의 DB 판).
 *   --client ilog      슬러그로 한 곳 (콕 집으면 status 'test' 고객도 찾는다 — E2E)
 *   CLIENT_ID=2        번호로 한 곳 (옛 호출 방식)
 *   아무것도 없으면     전부 (active 만)
 */
export async function 고객고르기(argv, q) {
  const i = argv.indexOf("--client");
  if (i > 0 && argv[i + 1]) {
    const 전부 = await loadClients(q, { includeTest: true });
    const c = 전부.find((x) => x.slug === argv[i + 1]);
    if (!c) throw new Error(`고객사 없음: ${argv[i + 1]} (있는 것: ${전부.map((x) => x.slug).join(", ")})`);
    return [c];
  }
  if (process.env.CLIENT_ID) {
    const 전부 = await loadClients(q, { includeTest: true });
    const c = 전부.find((x) => x.id === Number(process.env.CLIENT_ID));
    if (!c) throw new Error(`고객사 없음: CLIENT_ID=${process.env.CLIENT_ID} (있는 것: ${전부.map((x) => `${x.id} ${x.slug}`).join(", ")})`);
    return [c];
  }
  return loadClients(q);
}

/**
 * DB 를 잠깐 열어 fn(q) 를 돌리고 닫는다 — DB 연결이 없던 스크립트(who-wins·indexnow·health 앞부분·tools)가 고객 목록만 읽을 때.
 * 연결은 스크립트들이 쓰던 그대로(pg Pool · sslmode 지움 · DATABASE_SSL_INSECURE). DATABASE_URL 이 없으면 academy/.env.local 을 읽는다.
 * 열지 못하면 q 없이 fn(null) — loadClients 가 코드 3곳으로 돈다(stderr 한 줄)
 */
export async function 잠깐DB(fn) {
  if (!process.env.DATABASE_URL) {
    const fs = await import("node:fs");
    try {
      for (const l of fs.readFileSync(new URL("./.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
        const m = /^([A-Z_0-9]+)=(.*)$/.exec(l);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch { /* 파일 없음 — Actions 는 환경변수로 준다 */ }
  }
  let pool = null;
  try {
    const { default: pg } = await import("pg");
    const u = new URL(process.env.DATABASE_URL);
    u.searchParams.delete("sslmode");
    pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 1 });
  } catch (e) {
    console.error(`DB 고객을 못 읽어 코드 고객 ${CODE_CLIENTS.length}곳만 돕니다 — ${String(e.message).slice(0, 120)}`);
    return fn(null);
  }
  const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
  try { return await fn(q); } finally { await pool.end().catch(() => {}); }
}

/** PC 로컬 에이전트가 구글 색인 요청·빙 주소 제출을 도는 고객(gsc: true). 학원 먼저 — 한도가 먼저 차도 레퍼런스는 돈다 */
export const indexClients = (list) => list.filter((c) => c.gsc).sort((a, b) => (b.id === 1) - (a.id === 1));

export const bySlug = (slug, list) => list.find((x) => x.slug === slug);

/** 글 쓰는 길이 세션인 고객(loop.draft = "session")의 글 일감 제목. 개선 루프와 회사 루프가 같은 제목을 쓴다 */
export const 세션글제목 = (name, question) => `세션에서 ${name} 가이드 초안: 「${question}」`;
/*
 * AI 답변 측정 설정(이름 판별 answerRe)은 geo.clients.answer_pattern 이 먼저다(Step 25).
 * 여기 answerRe 는 DB 칸이 비었을 때 쓰는 대체값이고, 비어 있는 DB 칸을 처음 채우는 원문이기도 하다.
 * 외부 고객은 여기 덩어리 없이 등록 화면(/admin/pilots)에서 이름 판별 말을 받아 DB 에만 둔다 → academy/measure-targets.mjs
 */
