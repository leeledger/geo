/**
 * 무인 운영에 드는 API 비용 — 한 달 기준.
 *
 * 「창을 닫아도 도나」에 「측정은 돌고 손 쓰는 일은 멈춘다」고 답했다.
 * 그 멈추는 부분을 API 로 돌리면 얼마인지 실제 작업량으로 재 본다.
 *
 * 가격은 claude.com/pricing 에서 확인한 값 (2026-09-10).
 *   Opus 5    입력 $5     출력 $25   캐시읽기 $0.50   캐시쓰기 $6.25
 *   Sonnet 5  입력 $2     출력 $10   캐시읽기 $0.20   캐시쓰기 $2.50
 *   Haiku 4.5 입력 $1     출력 $5    캐시읽기 $0.10   캐시쓰기 $1.25
 *
 * 토큰 추정은 오늘 실제로 한 일에서 잡았다. 짐작한 자리는 그렇게 적었다.
 * 실제로는 이 추정이 틀릴 수 있다 — 그래서 「적게 잡은 값」과
 * 「많이 잡은 값」을 같이 낸다. 하나만 내놓으면 그게 약속처럼 읽힌다.
 *
 *   node scripts/api-cost.mjs
 */

const PRICE = {
  opus:   { in: 5,  out: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  sonnet: { in: 2,  out: 10, cacheRead: 0.20, cacheWrite: 2.50 },
  haiku:  { in: 1,  out: 5,  cacheRead: 0.10, cacheWrite: 1.25 },
};

const FX = 1400; // 원/달러. 환율은 변한다 — 대략의 자릿수를 보기 위한 값이다.

/**
 * 하려는 일.
 *
 * runs   한 달에 몇 번
 * inK    한 번에 넣는 토큰 (천 단위)
 * outK   한 번에 나오는 토큰 (천 단위)
 * cache  입력 중 캐시로 재사용되는 비율. 같은 프로젝트를 반복해서 보므로 높다.
 * model  이 일에 맞는 모델
 */
const JOBS = [
  {
    name: "정찰 해석",
    what: "찾은 문제를 읽고 원인을 짚어 이슈에 적는다",
    runs: 30, inK: [25, 45], outK: [1.5, 3], cache: 0.7, model: "haiku",
    note: "규칙이 이미 문제를 찾아 놓는다. LLM 은 원인 추론과 문장만 맡는다",
  },
  {
    name: "주간 글쓰기",
    what: "주제 고르기 · 초안 · 고쳐쓰기 · AI 티 검사",
    runs: 4, inK: [120, 260], outK: [12, 22], cache: 0.6, model: "opus",
    note: "이건 품질이 곧 사업이라 오퍼스를 쓴다. 한 편에 여러 번 오간다",
  },
  {
    name: "도해 만들기",
    what: "SVG 설계 · 겹침 고치기 · 다시 굽기",
    runs: 4, inK: [60, 140], outK: [10, 18], cache: 0.5, model: "sonnet",
    note: "오늘 8장 만들면서 자리 겹침을 두 번 고쳤다. 반복이 붙는다",
  },
  {
    name: "일일 브리핑 해석",
    what: "숫자를 읽고 오늘 할 일 세 줄로",
    runs: 30, inK: [12, 20], outK: [0.6, 1.2], cache: 0.8, model: "haiku",
    note: "짧다. 하이쿠로 충분하다",
  },
  {
    name: "주간 정리",
    what: "한 주 숫자를 견주고 무엇이 달라졌는지",
    runs: 4, inK: [40, 80], outK: [3, 6], cache: 0.6, model: "sonnet",
  },
  {
    name: "고객사 진단 해설",
    what: "진단 점수를 읽고 전달 문서로",
    runs: 2, inK: [30, 60], outK: [4, 8], cache: 0.4, model: "sonnet",
    note: "고객사가 늘면 여기가 는다. 지금은 두 곳 기준",
  },
];

function cost(job, side) {
  const p = PRICE[job.model];
  const i = job.inK[side] * 1000;
  const o = job.outK[side] * 1000;
  const cached = i * job.cache;
  const fresh = i - cached;

  // 캐시는 처음 한 번 쓰고(비쌈) 그 뒤로는 읽는다(쌈).
  // 한 달에 runs 번 도는데 캐시 수명이 짧아 매번 다시 쓴다고 본다 — 보수적으로.
  const per =
    (fresh / 1e6) * p.in +
    (cached / 1e6) * p.cacheWrite * 0.35 +   // 일부만 다시 쓴다
    (cached / 1e6) * p.cacheRead * 0.65 +
    (o / 1e6) * p.out;
  return per * job.runs;
}

console.log("════════════════════════════════════════════════════════");
console.log("  무인 운영 API 비용 — 한 달");
console.log("════════════════════════════════════════════════════════");
console.log("  가격 출처: claude.com/pricing (2026-09-10 확인)");
console.log(`  환율 ${FX}원 기준. 토큰은 오늘 실제 작업에서 잡은 추정치입니다.\n`);

let loSum = 0, hiSum = 0;
for (const j of JOBS) {
  const lo = cost(j, 0), hi = cost(j, 1);
  loSum += lo; hiSum += hi;
  console.log(`  ${j.name}  (${j.model}, 월 ${j.runs}회)`);
  console.log(`    ${j.what}`);
  console.log(`    $${lo.toFixed(2)} ~ $${hi.toFixed(2)}   약 ${Math.round(lo * FX).toLocaleString()} ~ ${Math.round(hi * FX).toLocaleString()}원`);
  if (j.note) console.log(`    ${j.note}`);
  console.log();
}

console.log("────────────────────────────────────────────────────────");
console.log(`  합계  $${loSum.toFixed(2)} ~ $${hiSum.toFixed(2)}`);
console.log(`        약 ${Math.round(loSum * FX).toLocaleString()} ~ ${Math.round(hiSum * FX).toLocaleString()}원 / 월`);
console.log("────────────────────────────────────────────────────────");

// 모델을 낮춰 보면
const allSonnet = JOBS.reduce((s, j) => s + cost({ ...j, model: "sonnet" }, 1), 0);
const allHaiku = JOBS.reduce((s, j) => s + cost({ ...j, model: "haiku" }, 1), 0);
console.log(`
  모델을 바꾸면 (많이 잡은 쪽 기준)
    지금 섞어 쓰는 안   $${hiSum.toFixed(2)}   약 ${Math.round(hiSum * FX).toLocaleString()}원
    전부 소넷          $${allSonnet.toFixed(2)}   약 ${Math.round(allSonnet * FX).toLocaleString()}원
    전부 하이쿠         $${allHaiku.toFixed(2)}   약 ${Math.round(allHaiku * FX).toLocaleString()}원

  글쓰기만 오퍼스로 두고 나머지를 낮추는 게 값이 가장 잘 맞습니다.
  글은 품질이 곧 사업이라 여기서 아끼면 안 됩니다.
`);

// 지금 쓰는 요금제와 견주기
console.log("  참고");
console.log("    지금은 클로드 코드 구독으로 쓰고 있어 API 비용이 따로 안 나갑니다.");
console.log("    아래 값은 「사람 없이 돌리려고 API 를 따로 붙일 때」의 추가 비용입니다.");
console.log("    로그인이 필요한 일(구글 색인, 네이버 이관, 플레이스)은 여기 안 들어갑니다 —");
console.log("    그건 돈 문제가 아니라 쿠키를 클라우드에 올릴 것인가의 문제입니다.");
