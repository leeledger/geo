/**
 * 30일 파일럿의 날짜 — 착수·기준선·30일·최종 창 (Step 26 D5).
 *
 *   착수     질문 20개 승인 뒤 첫 측정을 시작한 날(KST). 승인 시각(questions_approved_at)의 KST 날짜 이후 첫 측정일
 *   기준선   착수부터 7일(착수 포함, +6)
 *   30일     구축 없음(needs_build=none) → 착수 포함 30일(+29)
 *            구축·세팅(setup|build) → 사이트 연 날(site_launch_on) 포함 30일. 연 날이 없으면 아직 모른다(null)
 *   최종 창  30일의 마지막 7일
 *
 * research/paid-pilot-order-form.md 「순서」·research/pilot-measurement-sop.md 「회차」 그대로다.
 * 순수 함수는 DB 없이 가짜 행으로 시험한다. 날짜는 'YYYY-MM-DD' 글자로만 다룬다 — Date 를 거치면 UTC 로 하루 밀린다.
 */

export const 더하기 = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** 한 순간의 KST 날짜. 00~09시(KST)가 UTC 로는 전날이다 */
export const kst날짜 = (t = new Date()) => new Date(new Date(t).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const 날 = (x) => (x == null || x === "" ? null : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).slice(0, 10));

export const 구축있음 = (needs) => needs === "setup" || needs === "build";

/** 승인 시각과 잰 날 목록('YYYY-MM-DD')으로 착수일. 승인 KST 날짜 이후 첫 측정일, 없으면 null */
export function 착수찾기(approvedAt, days) {
  if (!approvedAt) return null;
  const 승인일 = kst날짜(approvedAt);
  return [...days].map(날).filter((d) => d && d >= 승인일).sort()[0] ?? null;
}

/**
 * p: { kickoff_on, needs_build, site_launch_on }
 * 돌려주는 것: null(착수 전) 또는 { 착수, 구축, 기준선:{from,to}, 보고기한, 시작, 끝, 최종:{from,to}|null }
 * 시작·끝이 null 이면 구축·세팅 중(사이트 연 날 미입력)이다
 */
export function 파일럿일정(p) {
  const 착수 = 날(p.kickoff_on);
  if (!착수) return null;
  const 구축 = 구축있음(p.needs_build);
  const 시작 = 구축 ? 날(p.site_launch_on) : 착수;
  const 끝 = 시작 ? 더하기(시작, 29) : null;
  return {
    착수, 구축,
    기준선: { from: 착수, to: 더하기(착수, 6) },
    보고기한: 더하기(착수, 7),
    시작, 끝,
    최종: 끝 ? { from: 더하기(끝, -6), to: 끝 } : null,
  };
}

/**
 * geo.pilots 에 적을 started_on·ends_on. 착수 전이면 null(등록 때 값 그대로 둔다).
 * 구축·세팅 중(연 날 미입력)에는 착수 +29 를 임시 끝으로 둔다 — 측정 대상 판정은 따로 「구축 대기」로 잡는다(measure-targets.mjs)
 */
export function 기간칸(p) {
  const s = 파일럿일정(p);
  if (!s) return null;
  return { started_on: s.시작 ?? s.착수, ends_on: s.끝 ?? 더하기(s.착수, 29) };
}

/** 업무 기한의 기준 날짜. 등록은 파일럿을 만든 날(KST) */
export function 기준날짜(p, anchor) {
  const s = 파일럿일정(p);
  if (anchor === "등록") return 날(p.registered_on);
  if (!s) return null;
  return anchor === "착수" ? s.착수 : anchor === "시작" ? s.시작 : anchor === "끝" ? s.끝 : null;
}

/**
 * 착수일·시작·종료·업무 기한을 한 곳에서 맞춘다(company.mjs 가 매시 부른다).
 *   착수일   승인 시각이 있고 착수일이 비었으면, 승인 KST 날짜 이후 첫 측정일(승인 질문 q1~q20)로 채운다. 한 번 정하면 안 바꾼다
 *   기간     기간칸() 으로 started_on·ends_on
 *   업무     기준(anchor)이 있는 안 끝난 업무만 기준 날짜 + offset_days 로. 옛 파일럿 업무(anchor 없음)는 안 건드린다
 * 승인 시각이 없는 파일럿(Step 26 전에 만든 학원 리허설 파일럿 등)은 건드리지 않는다. 바꾼 것 목록을 돌려준다
 */
export async function 파일럿날짜맞추기(q) {
  const 바뀜 = [];
  const ps = await q(`select p.id, p.client_id, p.kickoff_on::text as kickoff_on, p.questions_approved_at, p.needs_build,
      p.site_launch_on::text as site_launch_on, p.started_on::text as started_on, p.ends_on::text as ends_on,
      ((p.created_at at time zone 'Asia/Seoul')::date)::text as registered_on
    from geo.pilots p where p.questions_approved_at is not null and p.cancelled_on is null`);
  for (const p of ps) {
    let 새착수 = null;
    if (!p.kickoff_on) {
      const days = (await q(`select distinct measured_on::text as d from academy.ai_measurements
          where client_id = $1 and prompt_id ~ '^q[0-9]+$' and measured_on >= ($2::timestamptz at time zone 'Asia/Seoul')::date - 1
          order by 1 limit 3`, [p.client_id, p.questions_approved_at])).map((r) => r.d);
      새착수 = 착수찾기(p.questions_approved_at, days);
      if (!새착수) continue;
      p.kickoff_on = 새착수;
    }
    const 칸 = 기간칸(p);
    if (새착수 || 칸.started_on !== p.started_on || 칸.ends_on !== p.ends_on) {
      await q(`update geo.pilots set kickoff_on = $2, started_on = $3, ends_on = $4 where id = $1`, [p.id, p.kickoff_on, 칸.started_on, 칸.ends_on]);
      바뀜.push(`${p.id} 착수 ${p.kickoff_on} · ${칸.started_on}~${칸.ends_on}`);
    }
    for (const anchor of ["착수", "시작", "끝"]) {
      const d = 기준날짜(p, anchor);
      if (!d) continue;
      await q(`update geo.pilot_tasks set due_on = $3::date + offset_days
                where pilot_id = $1 and anchor = $2 and status <> '완료' and offset_days is not null
                  and due_on is distinct from $3::date + offset_days`, [p.id, anchor, d]);
    }
  }
  return 바뀜;
}

/** Step 26 칸. 코드의 if not exists 로만 — academy/db/schema.sql · web/db/schema.sql 과 같은 줄 */
export async function 파일럿칸준비(q) {
  for (const s of [
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
    `create table if not exists geo.pilot_manual_checks (
      id bigserial primary key, pilot_id uuid not null references geo.pilots(id) on delete cascade,
      question text not null,
      surface text not null check (surface in ('google_ai_overview','naver_ai_briefing','google_ai_mode')),
      checked_on date not null, shown text not null check (shown in ('이름','링크','안 나옴','화면 없음')),
      note text not null default '', capture bytea, capture_type text,
      created_at timestamptz not null default now())`,
    `alter table geo.pilot_manual_checks enable row level security`,
  ]) await q(s);
}
