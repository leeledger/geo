/**
 * 파일럿 등록 때 만드는 글자들 — 자동 질문 20개 · 정합성 출처 · 가림 별칭 (Step 27 D15).
 *
 * 처음엔 학원만 생각하고 썼다. 치과·카페를 등록하면 「체험수업에서 확인할 것은?」「교육청 공개정보」가 나갔다.
 * 학원 문장은 업종이 학원일 때만 쓰고, 나머지는 업종을 안 가리는 문장으로 쓴다.
 * 학원 20문항은 예전과 한 글자도 다르지 않다 — 학원 리허설 파일럿과 비교가 되게.
 * "use server" 모듈(pilot-actions.ts)은 async 만 내보낼 수 있어 따로 둔다.
 */

/** 업종 칸에 학원·교습소·공부방·교실·과외가 있으면 학원 문장을 쓴다(Arch 2026-09-30) */
export const isAcademy = (category: string) => /학원|교습소|공부방|교실|과외/.test(category);

/**
 * 받침 보고 조사를 붙인다. 학원 문장은 옛 글자 그대로 두려고 일반 문장에만 쓴다.
 * 으로/로 는 ㄹ받침이면 로. 한글로 안 끝나면(영문·숫자) 받침 없는 쪽.
 */
const JOSA = { 은: ["은", "는"], 이: ["이", "가"], 을: ["을", "를"], 과: ["과", "와"], 으로: ["으로", "로"] } as const;
export function josa(word: string, kind: keyof typeof JOSA): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = c >= 0 && c <= 11171 ? c % 28 : 0;
  const has = kind === "으로" ? jong !== 0 && jong !== 8 : jong !== 0;
  return word + JOSA[kind][has ? 0 : 1];
}

/** 20개. 지역 8 · 문제 5 · 비교 4 · 브랜드 3 (pilot-actions.ts 가 순서로 단계를 붙인다) */
export function makeQuestions(brand: string, district: string, neighborhood: string, category: string, audience: string): string[] {
  if (isAcademy(category)) return [
    `${district}에서 ${audience} ${category} 추천해줘`, `${neighborhood} 근처 ${category} 어디가 좋아?`, `${district} ${category} 중 상담을 잘해주는 곳 알려줘`, `${neighborhood}에서 가까운 ${category} 비교해줘`, `${district} ${category} 비용은 보통 얼마야`, `${district}에서 후기 말고 수업 근거가 분명한 ${category} 알려줘`, `${audience}가 다닐 ${district} ${category} 고르는 기준 알려줘`, `${district} ${category} 중 소규모로 가르치는 곳 있어?`,
    `${audience}에게 ${category}가 필요한지 판단하는 법은?`, `${category}를 시작하기 좋은 시기는 언제야?`, `${category} 상담 때 무엇을 물어봐야 해?`, `${category}를 다녀도 효과 없는 경우는?`, `${category}에서 실제로 무엇을 배우는지 확인하는 법은?`,
    `대형 ${category}와 동네 ${category} 중 어디가 나아?`, `${category} 온라인 수업과 오프라인 학원 차이는?`, `${district} ${category} 두 곳을 비교할 때 볼 기준은?`, `${category} 체험수업에서 확인할 것은?`,
    `${brand}은 어떤 곳이야?`, `${brand}의 위치와 수업 대상을 알려줘`, `${brand}을 선택해도 되는 사람과 안 맞는 사람을 알려줘`,
  ];
  const J = josa;
  return [
    `${district}에서 ${audience} ${category} 추천해줘`, `${neighborhood} 근처 ${category} 어디가 좋아?`, `${district} ${category} 중 설명을 잘해주는 곳 알려줘`, `${neighborhood}에서 가까운 ${category} 비교해줘`, `${district} ${category} 비용은 보통 얼마야`, `${district}에서 후기 말고 근거가 분명한 ${category} 알려줘`, `${J(audience, "이")} 이용할 ${district} ${category} 고르는 기준 알려줘`, `${district} ${category} 중 오래 운영한 곳 있어?`,
    `${J(audience, "이")} ${category} 고를 때 뭘 봐야 해?`, `${category}에 처음 가기 전에 알아둘 것은?`, `${category}에 문의할 때 무엇을 물어봐야 해?`, `${category} 잘 고른 건지 어떻게 알아?`, `${category}의 실력을 미리 확인하는 법은?`,
    `대형 ${J(category, "과")} 동네 ${category} 중 어디가 나아?`, `${category} 가격이 싼 곳과 비싼 곳 차이는?`, `${district} ${category} 두 곳을 비교할 때 볼 기준은?`, `${category} 처음 방문할 때 확인할 것은?`,
    `${J(brand, "은")} 어떤 곳이야?`, `${brand}의 위치와 주요 서비스를 알려줘`, `${J(brand, "을")} 선택해도 되는 사람과 안 맞는 사람을 알려줘`,
  ];
}

/** 정합성 점검 출처. 교육청 공개정보는 학원만 있다 */
export const auditSources = (category: string) =>
  ["공식 사이트", "네이버 플레이스", "Google Business Profile", ...(isAcademy(category) ? ["교육청 공개정보"] : [])];

/** 출처마다 맞춰 볼 칸. 「과정·대상」은 학원 말이라 다른 업종은 「서비스·대상」 */
export const auditFields = (category: string) =>
  ["상호", "주소", "전화", "운영시간", isAcademy(category) ? "과정·대상" : "서비스·대상"];

/** 0 → A, 25 → Z, 26 → AA */
const letters = (n: number): string => (n < 26 ? "" : letters(Math.floor(n / 26) - 1)) + String.fromCharCode(65 + (n % 26));

/**
 * 가림 별칭 「고객 A」「고객 B」…. 지역·업종을 넣으면 조합으로 특정된다(CLAUDE.md 고객사는 가린다).
 * 이미 쓴 「고객 X」를 피해 가장 앞 글자를 준다.
 */
export function nextAlias(used: (string | null)[]): string {
  const taken = new Set(used);
  for (let n = 0; ; n++) if (!taken.has(`고객 ${letters(n)}`)) return `고객 ${letters(n)}`;
}
