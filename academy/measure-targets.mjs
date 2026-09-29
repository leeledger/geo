/**
 * AI 답변 측정 대상 목록 — 누구를 어떤 순서로 재는가 (Step 25).
 *
 * 전에는 실행기(optimize.yml → ai-measure.mjs, pc-runner → ai-web-measure.mjs)가 고객을 안 줬고
 * 스크립트는 기본값 robotncoding 만 쟀다. 외부 고객이 결제해도 아무도 안 쟀을 것이다.
 *
 *   대상    진행 중 파일럿(오늘이 시작일~종료일+7일) 고객 · measure_active 고객 · 학원(항상)
 *   순서    유료 파일럿 고객 → 학원 → 그 밖의 측정 고객. 탐침은 실행기가 맨 끝에, 유료 고객이 없는 날만
 *   이름    geo.clients.answer_pattern(정규식 원문)을 먼저 쓰고, 비었으면 clients.mjs 의 answerRe
 *   도메인  clients.mjs 덩어리가 있으면 그것(지금 재는 값 그대로), 없으면 geo.clients.domain
 *
 * 설정이 없는 고객도 목록에 남는다(conf=null). 실행기가 그 고객 id 로 「측정 설정 없음」 일감을 올린다 — 조용히 빼지 않는다.
 */
import { bySlug, CLIENTS } from "./clients.mjs";
import { 더하기, 구축있음, 파일럿칸준비 } from "./pilot-plan.mjs";

export const HOUSE = "robotncoding";

/** 두 컬럼을 더하고, 덩어리에 정규식이 있는 고객은 비어 있을 때만 그 원문으로 채운다(학원·아이로그 — 지금과 같은 값) */
export async function 측정설정준비(q) {
  await q(`alter table geo.clients add column if not exists answer_pattern text`);
  await q(`alter table geo.clients add column if not exists measure_active boolean not null default false`);
  for (const c of CLIENTS) {
    if (!(c.answerRe instanceof RegExp)) continue;
    await q(`update geo.clients set answer_pattern = $2 where slug = $1 and coalesce(answer_pattern, '') = ''`, [c.slug, c.answerRe.source]);
  }
}

const 도메인정리 = (d) => String(d ?? "").trim().toLowerCase()
  .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");

/**
 * 한 고객의 측정 설정. 이름 정규식과 도메인이 둘 다 있어야 잰다. 없으면 null.
 * 정규식은 늘 대소문자 무시(i) — clients.mjs 의 두 덩어리가 다 i 였다.
 */
export function 측정설정(row) {
  const 덩어리 = bySlug(row.slug);
  let answerRe = null;
  const 원문 = String(row.answer_pattern ?? "").trim();
  if (원문) {
    try { answerRe = new RegExp(원문, "i"); } catch { answerRe = null; }
  }
  if (!answerRe && 덩어리?.answerRe instanceof RegExp) answerRe = 덩어리.answerRe;
  const domain = 덩어리?.domain ?? 도메인정리(row.domain);
  if (!answerRe || !domain) return null;
  return { id: row.id, slug: row.slug, name: row.name, domain, answerRe };
}

/**
 * 가짜 행으로 시험할 수 있게 DB 와 떨어뜨린 순수 함수.
 * rows: { id, slug, name, domain, answer_pattern, measure_active, price, started_on, ends_on,
 *         kickoff_on, needs_build, site_launch_on, cancelled_on } (날짜는 'YYYY-MM-DD' 글자)
 * 돌려주는 것: [{ ...row, 묶음: "유료"|"학원"|"측정", conf }] — 잴 순서대로
 *
 * 진행 중(Step 26 D5): 착수일(없으면 등록 때 시작일)부터 종료+7일까지. 착수 전에도 재야 착수일이 생긴다.
 * 구축·세팅 고객은 착수 뒤 사이트 연 날이 들어오기 전까지 「구축 대기」로 계속 잰다 — 기준선과 30일 사이가 끊기지 않게.
 * 사이트 연 날을 앞날로 넣어도 착수일부터 재니 빠지지 않는다. 취소(cancelled_on)한 파일럿은 안 잰다
 */
export function 대상고르기(rows, 오늘) {
  const 진행중 = (r) => {
    if (r.cancelled_on) return false;
    const 처음 = r.kickoff_on || r.started_on;
    if (!처음 || 처음 > 오늘) return false;
    if (r.kickoff_on && 구축있음(r.needs_build) && !r.site_launch_on) return true;
    return Boolean(r.ends_on) && 오늘 <= 더하기(r.ends_on, 7);
  };
  const 유료 = [], 학원 = [], 측정 = [];
  for (const r of rows) {
    if (r.slug === HOUSE) 학원.push({ ...r, 묶음: "학원" });
    else if (진행중(r) && Number(r.price) > 0) 유료.push({ ...r, 묶음: "유료" });
    else if (진행중(r) || r.measure_active === true) 측정.push({ ...r, 묶음: "측정" });
  }
  const 차례 = (a, b) => String(a.started_on ?? "").localeCompare(String(b.started_on ?? "")) || a.id - b.id;
  return [...유료.sort(차례), ...학원, ...측정.sort(차례)].map((r) => ({ ...r, conf: 측정설정(r) }));
}

const 고객행 = `select c.id, c.slug, c.name, c.domain, c.answer_pattern, c.measure_active,
    p.price, p.started_on::text as started_on, p.ends_on::text as ends_on,
    p.kickoff_on::text as kickoff_on, p.needs_build, p.site_launch_on::text as site_launch_on, p.cancelled_on::text as cancelled_on
  from geo.clients c left join geo.pilots p on p.client_id = c.id`;

/**
 * 오늘 잴 대상. --client 를 주면 그 고객 하나(지금처럼 — 나누지 않는다).
 * 오늘은 KST 날짜('YYYY-MM-DD'). 없는 슬러그는 conf=null · id=null 로 돌려준다
 */
export async function 측정대상(q, 오늘, slug = null) {
  // 칸이 이미 있으면 준비가 실패해도(ALTER 권한 등) 잰다. 칸이 없으면 아래 select 가 실패해 멈춘다 — 그게 맞다
  await 측정설정준비(q).catch((e) => console.log(`  ⚠ 측정 설정 칸 준비 실패: ${e.message}`));
  await 파일럿칸준비(q).catch((e) => console.log(`  ⚠ 파일럿 칸 준비 실패: ${e.message}`));
  if (slug) {
    const [r] = await q(`${고객행} where c.slug = $1`, [slug]);
    const row = r ?? { id: null, slug, name: slug };
    return [{ ...row, 묶음: slug === HOUSE ? "학원" : "지정", conf: r ? 측정설정(r) : null }];
  }
  return 대상고르기(await q(고객행), 오늘);
}

/**
 * 예산이 모자라 못 잰 고객 — 사람 대기 일감. 상한을 올릴지는 원장이 정한다.
 * 실행기마다 키를 따로 둔다(measure-budget-<slug>-claude / -web). 한 키면 화면 측정이 다 잰 날 Claude 쪽 부족 일감까지 닫는다.
 */
export async function 예산부족알림(q, t, 실행기, 무엇, 상한설명) {
  if (!t.id) return;
  await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
     values ($1, 'measure', 'human', $2, $3, $4, '사람 대기', 20, '{"sticky":true}'::jsonb)
     on conflict (client_id, dedupe_key) do update set status='사람 대기', title=excluded.title, detail=excluded.detail,
       done_at=null, updated_at=now()`,
    [t.id, `measure-budget-${t.slug}-${실행기}`, `오늘 측정 예산이 모자라 ${t.name} 를 못 쟀습니다 — 상한을 올릴지 정해 주세요`,
      `${무엇}. ${상한설명} 순서는 유료 파일럿 고객 → 학원 → 탐침입니다.`]);
}

/** 그 실행기로 오늘 다 쟀으면 닫는다. 근거를 남긴다 — 빈 근거 완료는 감사(R3)가 잡는다 */
export async function 예산부족닫기(q, t, 실행기, 근거) {
  if (!t.id) return;
  await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence=$3
            where client_id=$1 and dedupe_key=$2 and status='사람 대기'`,
    [t.id, `measure-budget-${t.slug}-${실행기}`, 근거]);
}
