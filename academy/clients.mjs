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
    // 사이트 저장소가 이 저장소 안에 있어 키 파일을 직접 둔다
    indexnowKeyFile: "public/indexnow-key.txt",
    publishes: true,
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
    // 사이트 저장소가 밖에 있다. 키 파일은 전달 파일(deliverables/ilog/public)로 넘긴다
    indexnowKey: "7c1e9a4b2f6d8053a1c4e7b9d2f05a68",
    publishes: false,
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
