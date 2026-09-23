import { inqPool } from "./inquiries";

/**
 * 초안 재료 — 읽기와 상수, 그리고 개인정보 가리기.
 *
 * 자동 초안이 일반론이 되는 이유는 모델이 아니라 재료다. 원장만 쓸 수 있는 말이
 * 한 줄도 없으면 모델은 빈자리를 「한 학부모가」로 채운다. 그 초안을 원장이 버린다.
 *
 * 쓰기(서버 액션)는 material-actions.ts 에 따로 있다.
 * "use server" 모듈은 내보내는 것이 전부 async 함수여야 해서,
 * 상수·타입·순수 함수를 같이 두면 빌드가 "Failed to collect configuration" 으로 죽는다.
 */

/** 재료 종류. 자유 입력으로 두면 나중에 셀 수가 없다 */
export const KINDS = ["상담", "수업", "질문", "사례", "숫자"] as const;
export type Kind = (typeof KINDS)[number];

export type Material = {
  id: string;
  day: string;
  kind: string;
  said: string;
  context: string;
  usedIn: string[];
  origin: string;
};

/**
 * 성씨 사전. 「한글 2~4자 + 학생」만 보면 「우리 학생」 「여자 학생」이 ○○ 로 망가진다.
 * 성으로 시작하는 것만 이름으로 본다. 그래도 남는 겹침은 아래 제외 목록으로 뺀다.
 */
const 성씨 = "김이박최정강조윤장임한오서신권황안송류전홍고문손배백허남심노하곽성차주구민진지엄채원천염변";
/** 두 글자 성. 한 글자 사전으로는 「남궁민 학생」이 안 걸린다 (Richard 2026-09-23) */
const 복성 = ["선우", "남궁", "제갈", "사공", "황보", "독고", "서문"];
/** 성씨로 시작하지만 이름이 아닌 말. 여기 없는 겹침이 보이면 한 줄 더 넣는다 */
const 이름아님 = new Set([
  "우리", "여자", "남자", "그냥", "이번", "저희", "요즘", "해당", "다른", "모든",
  "어린", "초등", "중등", "고등", "한명", "지금", "전에", "최근", "당시", "본인",
  "신입", "재원", "고학", "저학", "정규", "심화", "기초", "성적", "주변", "상담",
]);

// 호칭 뒤 조사는 허용한다 — 「김민준 학생이」를 놓치면 가리는 뜻이 없다
const 호칭 = "어머님|어머니|아버님|아버지|학생|군|양";
const 뒤 = `(?=[\\s,.!?)\\]」'"]|이|가|은|는|을|를|과|와|의|에|도|님|$)`;
const 이름꼴 = new RegExp(
  `(^|[^가-힣])((?:${복성.join("|")})[가-힣]{1,2}|[${성씨}][가-힣]{1,3})\\s?(${호칭})${뒤}`,
  "g",
);

/**
 * 개인정보를 가린다. 저장을 막지 않고 가린 뒤 저장한다 —
 * 30초 안에 끝나야 하는 입력이라 되돌려 보내면 다음부터 안 적는다.
 * 학년(초5)은 개인정보가 아니다. 남긴다.
 */
export function 가리기(s: string): { 값: string; 가린것: string[] } {
  let v = String(s ?? "");
  const 가린것: string[] = [];
  const 표시 = (what: string) => { if (!가린것.includes(what)) 가린것.push(what); };

  // 메일이 먼저다. 나중에 돌리면 메일 속 숫자가 전화번호로 먼저 잡힌다
  v = v.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, () => { 표시("메일 주소"); return "***@***"; });

  // 휴대전화 — 010-1234-5678 · 01012345678 · 010 1234 5678
  v = v.replace(/\b01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, () => { 표시("전화번호"); return "010-****-****"; });
  // 지역번호·대표번호
  v = v.replace(/\b0\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, () => { 표시("전화번호"); return "0**-***-****"; });

  // 남은 7자리 이상 연속 숫자 — 주민번호 앞자리·계좌·긴 번호
  v = v.replace(/\d{7,}/g, (m) => { 표시("긴 숫자"); return "*".repeat(Math.min(m.length, 12)); });

  // 이름 + 호칭
  v = v.replace(이름꼴, (whole, pre: string, name: string, 호칭: string) => {
    if (이름아님.has(name.slice(0, 2)) || 이름아님.has(name)) return whole;
    표시("이름");
    return `${pre}○○ ${호칭}`;
  });

  return { 값: v, 가린것 };
}

/** 안 쓴 재료가 몇 개인가. 3개 밑이면 자동 초안이 일반론이 된다 */
export async function materialCounts(clientId = 1): Promise<{ unused: number; total: number; last: string | null }> {
  const { rows } = await inqPool().query(
    `select count(*)::int total,
            count(*) filter (where cardinality(used_in) = 0)::int unused,
            max(day)::text last
       from academy.materials where client_id = $1`,
    [clientId],
  );
  return { unused: rows[0]?.unused ?? 0, total: rows[0]?.total ?? 0, last: rows[0]?.last ?? null };
}

export async function listMaterials(limit = 10, clientId = 1): Promise<Material[]> {
  const { rows } = await inqPool().query(
    `select id, day::text as day, kind, said, context, used_in, origin
       from academy.materials where client_id = $1
      order by day desc, created_at desc limit $2`,
    [clientId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    day: r.day,
    kind: r.kind,
    said: r.said,
    context: r.context,
    usedIn: r.used_in ?? [],
    origin: r.origin,
  }));
}
