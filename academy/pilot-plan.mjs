/**
 * 30일 파일럿의 날짜 — 착수·기준선·30일·최종 창 (Step 26 D5, Richard 리뷰 뒤 Arch 결정 2026-09-30).
 *
 *   착수     질문 20개 승인 뒤 첫 측정을 시작한 날(KST). 승인 시각(questions_approved_at)의 KST 날짜 이후 첫 측정일
 *   기준선   착수부터 7일(착수 포함, +6)
 *   30일     구축 없음(needs_build=none) → 입금 확인일(paid_on) 포함 30일(+29). 고객 승인이 늦어진 기간도 들어간다
 *            (research/paid-pilot-order-form.md 8행). 입금 확인일이 없으면 「입금 확인 전」 — 30일을 시작하지 않는다(null)
 *            구축·세팅(setup|build) → 사이트 연 날(site_launch_on) 포함 30일(신청서 「순서」). 연 날이 없으면 아직 모른다(null)
 *   최종 창  30일의 마지막 7일
 *
 * research/pilot-measurement-sop.md 「회차」 그대로다.
 * 순수 함수는 DB 없이 가짜 행으로 시험한다. 날짜는 'YYYY-MM-DD' 글자로만 다룬다 — Date 를 거치면 UTC 로 하루 밀린다.
 */

export const 더하기 = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** 한 순간의 KST 날짜. 00~09시(KST)가 UTC 로는 전날이다 */
export const kst날짜 = (t = new Date()) => new Date(new Date(t).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const 날 = (x) => (x == null || x === "" ? null : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).slice(0, 10));

export const 구축있음 = (needs) => needs === "setup" || needs === "build";

/**
 * 구축·세팅 고객이 사이트 연 날을 안 넣으면 착수 뒤 며칠까지 「구축 대기」로 재는가(Step 28 D22).
 * 이날(착수+60)부터 측정 대상에서 빼고(measure-targets.mjs) 원장 할 일 pilot-launch-<id> 를 올린다(company.mjs)
 */
export const 구축대기한도 = 60;

/** 승인 시각과 잰 날 목록('YYYY-MM-DD')으로 착수일. 승인 KST 날짜 이후 첫 측정일, 없으면 null */
export function 착수찾기(approvedAt, days) {
  if (!approvedAt) return null;
  const 승인일 = kst날짜(approvedAt);
  return [...days].map(날).filter((d) => d && d >= 승인일).sort()[0] ?? null;
}

/**
 * p: { kickoff_on, paid_on, needs_build, site_launch_on }
 * 돌려주는 것: { 착수, 구축, 기준선, 보고기한, 시작, 끝, 최종 } — 모르는 것은 null
 *   착수가 없으면 기준선·보고기한이 null, 시작이 없으면(입금 확인 전 · 사이트 연 날 미입력) 끝·최종이 null
 */
export function 파일럿일정(p) {
  const 착수 = 날(p.kickoff_on);
  const 구축 = 구축있음(p.needs_build);
  const 시작 = 구축 ? 날(p.site_launch_on) : 날(p.paid_on);
  const 끝 = 시작 ? 더하기(시작, 29) : null;
  return {
    착수, 구축,
    기준선: 착수 ? { from: 착수, to: 더하기(착수, 6) } : null,
    보고기한: 착수 ? 더하기(착수, 7) : null,
    시작, 끝,
    최종: 끝 ? { from: 더하기(끝, -6), to: 끝 } : null,
  };
}

/**
 * geo.pilots 에 적을 started_on·ends_on. 30일을 알면 그것.
 * 모르면(입금 확인 전 · 구축·세팅 중) 착수 +29 를 임시로 두고, 착수도 모르면 null(등록 때 값 그대로 둔다).
 * 구축 대기 동안의 측정은 measure-targets.mjs 가 따로 「구축 대기」로 잡는다
 */
export function 기간칸(p) {
  const s = 파일럿일정(p);
  if (s.시작) return { started_on: s.시작, ends_on: s.끝 };
  if (s.착수) return { started_on: s.착수, ends_on: 더하기(s.착수, 29) };
  return null;
}

/** 업무 기한의 기준 날짜. 등록은 파일럿을 만든 날(KST) */
export function 기준날짜(p, anchor) {
  if (anchor === "등록") return 날(p.registered_on);
  const s = 파일럿일정(p);
  return anchor === "착수" ? s.착수 : anchor === "시작" ? s.시작 : anchor === "끝" ? s.끝 : null;
}

/**
 * 착수일·시작·종료·업무 기한을 한 곳에서 맞춘다(company.mjs 가 매시 부른다).
 *   착수일   승인 시각이 있고 착수일이 비었으면, 승인 KST 날짜 이후 첫 측정일(승인 질문 q1~q20)로 채운다. 한 번 정하면 안 바꾼다
 *   기간     기간칸() 으로 started_on·ends_on — 입금 확인일·사이트 연 날을 고치면 따라 바뀐다
 *   업무     기준(anchor)이 있는 안 끝난 업무만 기준 날짜 + offset_days 로. 옛 파일럿 업무(anchor 없음)는 안 건드린다
 * 착수·입금 확인일·사이트 연 날이 다 없는 파일럿(학원 리허설 등)은 아무것도 안 바뀐다. 바꾼 것 목록을 돌려준다
 */
export async function 파일럿날짜맞추기(q) {
  const 바뀜 = [];
  const ps = await q(`select p.id, p.client_id, p.kickoff_on::text as kickoff_on, p.questions_approved_at, p.needs_build,
      p.paid_on::text as paid_on, p.site_launch_on::text as site_launch_on, p.started_on::text as started_on, p.ends_on::text as ends_on,
      ((p.created_at at time zone 'Asia/Seoul')::date)::text as registered_on
    from geo.pilots p where p.cancelled_on is null`);
  for (const p of ps) {
    let 새착수 = null;
    if (!p.kickoff_on && p.questions_approved_at) {
      const days = (await q(`select distinct measured_on::text as d from academy.ai_measurements
          where client_id = $1 and prompt_id ~ '^q[0-9]+$' and measured_on >= ($2::timestamptz at time zone 'Asia/Seoul')::date - 1
          order by 1 limit 3`, [p.client_id, p.questions_approved_at])).map((r) => r.d);
      새착수 = 착수찾기(p.questions_approved_at, days);
      if (새착수) p.kickoff_on = 새착수;
    }
    const 칸 = 기간칸(p);
    if (칸 && (새착수 || 칸.started_on !== p.started_on || 칸.ends_on !== p.ends_on)) {
      await q(`update geo.pilots set kickoff_on = $2, started_on = $3, ends_on = $4 where id = $1`, [p.id, p.kickoff_on, 칸.started_on, 칸.ends_on]);
      바뀜.push(`${p.id} 착수 ${p.kickoff_on ?? "전"} · ${칸.started_on}~${칸.ends_on}`);
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
    `alter table geo.pilots add column if not exists paid_on date`,
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
