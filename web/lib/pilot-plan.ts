/**
 * 파일럿 기본 업무와 Step 26 칸 (D5·D9·D11).
 *
 * 업무는 신청서(research/paid-pilot-order-form.md) 「제공」 여섯 줄과 SOP(research/pilot-measurement-sop.md) 「회차」다.
 * 기한은 기준 날짜(anchor) + 며칠(offset_days)로 둔다. 기준은 등록일 · 착수 · 시작(30일 첫날) · 끝(30일 마지막 날).
 * 등록할 때는 착수·시작을 모르니 임시 기한을 넣고, 착수일·사이트 연 날이 생기면 company.mjs 가 안 끝난 업무의 기한을 고친다
 * (academy/pilot-plan.mjs 기준날짜). anchor 가 없는 옛 파일럿 업무는 건드리지 않는다.
 */

export const NEEDS_BUILD = ["none", "setup", "build"];
export const NEEDS_BUILD_LABEL: Record<string, string> = { none: "구축 없음", setup: "기술 세팅", build: "사이트 구축" };

export type Anchor = "등록" | "착수" | "시작" | "끝";
type TaskDef = { code: string; title: string; anchor: Anchor; offset: number; owner: string; buildOnly?: boolean };

const TASKS: TaskDef[] = [
  { code: "intake", title: "사업자·공식 정보와 관리자 권한 수령", anchor: "등록", offset: 0, owner: "고객" },
  { code: "questions", title: "목표 질문 20개 고객 승인", anchor: "등록", offset: 1, owner: "고객" },
  { code: "inquiry-sheet", title: "상담 유입 기록표 전달 (제공 6)", anchor: "등록", offset: 1, owner: "사이티드" },
  { code: "measure-start", title: "승인 질문 20개를 4곳에 날짜별로 묻기 시작 — 답 원문·출처 보관 확인 (제공 1)", anchor: "착수", offset: 0, owner: "사이티드" },
  { code: "local-audit", title: "상호·주소·전화·운영시간 곳마다 점검과 수정안 (제공 3)", anchor: "착수", offset: 5, owner: "사이티드" },
  { code: "manual-baseline", title: "구글 AI 개요·네이버 AI 브리핑 손 확인 1회와 캡처 (제공 2)", anchor: "착수", offset: 6, owner: "사이티드" },
  { code: "baseline-report", title: "기준선 보고 — 착수 뒤 첫 7일 곳별 비율 (pilot-report --stage baseline)", anchor: "착수", offset: 7, owner: "사이티드" },
  { code: "site-launch", title: "구축·세팅을 마치고 사이트 연 날 입력", anchor: "착수", offset: 7, owner: "사이티드", buildOnly: true },
  { code: "content-draft", title: "근거 콘텐츠 1편 초안 (제공 4)", anchor: "시작", offset: 10, owner: "사이티드" },
  { code: "content-approve", title: "콘텐츠 사실 확인·승인 (제공 4)", anchor: "시작", offset: 13, owner: "고객" },
  { code: "content-publish", title: "콘텐츠 게시·색인 요청 (제공 4)", anchor: "시작", offset: 15, owner: "사이티드" },
  { code: "manual-day30", title: "30일 차 구글 AI 개요·네이버 AI 브리핑 손 확인과 캡처 (제공 2)", anchor: "끝", offset: 0, owner: "사이티드" },
  { code: "final-report", title: "30일 차 같은 질문·같은 방법 최종 보고 (pilot-report --stage final) (제공 5)", anchor: "끝", offset: 1, owner: "사이티드" },
  { code: "renewal", title: "성공 판정 확인 — 성공일 때만 월 구독 안내, 아니면 실패 원인 기록", anchor: "끝", offset: 1, owner: "사이티드" },
];

/**
 * 등록일에서 센 임시 기한(일). 착수는 승인(등록+1) 다음 날 첫 측정으로 본다.
 * 구축·세팅은 기준선 7일 뒤 사이트를 연다고 보고 센다 — 실제 날짜가 들어오면 고쳐진다
 */
export function pilotTasks(needsBuild: string) {
  const build = needsBuild === "setup" || needsBuild === "build";
  const 착수 = 2, 시작 = build ? 착수 + 7 : 착수;
  const base: Record<Anchor, number> = { 등록: 0, 착수, 시작, 끝: 시작 + 29 };
  return TASKS.filter((t) => build || !t.buildOnly).map((t) => ({ ...t, provisional: base[t.anchor] + t.offset }));
}

/** 폼의 날짜 칸 — 'YYYY-MM-DD' 만 받는다. 비었거나 틀리면 null */
export function ymd(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : null;
}

/** academy/pilot-plan.mjs 파일럿칸준비 와 같은 줄(파일럿 칸만). 등록이 처음 도는 날 칸이 없으면 만든다 */
export const PILOT_COLUMNS = [
  `alter table geo.pilots add column if not exists kickoff_on date`,
  `alter table geo.pilots add column if not exists questions_approved_at timestamptz`,
  `alter table geo.pilots add column if not exists baseline_sent_at timestamptz`,
  `alter table geo.pilots add column if not exists site_launch_on date`,
  `alter table geo.pilots add column if not exists needs_build text not null default 'none'`,
  `alter table geo.pilots add column if not exists competitors text not null default ''`,
  `alter table geo.pilots add column if not exists biz_type text`,
  `alter table geo.pilots add column if not exists refund_terms_sent_on date`,
  `alter table geo.pilots add column if not exists invoice_issued_on date`,
  `alter table geo.pilots add column if not exists cancelled_on date`,
  `alter table geo.pilots add column if not exists refund_amount int`,
  `alter table geo.pilot_tasks add column if not exists anchor text`,
  `alter table geo.pilot_tasks add column if not exists offset_days int`,
];

/** 신청서 「환불」 절 그대로. 착수 전 전액 · 기준선 보고 전 50% · 뒤 0원 — 30일 파일럿 390,000원에만 */
export function refundGuide(p: { kickoff_on?: unknown; baseline_sent_at?: unknown }) {
  if (!p.kickoff_on) return "착수 전 취소 — 390,000원 모두 돌려드림";
  if (!p.baseline_sent_at) return "기준선 보고 전 취소 — 195,000원(50%) 돌려드림";
  return "기준선 보고 뒤 취소 — 돌려드리지 않음";
}
