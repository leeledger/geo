/**
 * AI 답변 측정 대상 목록 — 누구를 어떤 순서로 재는가 (Step 25).
 *
 * 전에는 실행기(optimize.yml → ai-measure.mjs, pc-runner → ai-web-measure.mjs)가 고객을 안 줬고
 * 스크립트는 기본값 robotncoding 만 쟀다. 외부 고객이 결제해도 아무도 안 쟀을 것이다.
 *
 *   대상    진행 중 파일럿(오늘이 시작일~종료일+7일) 고객 · measure_active 고객 · 학원(항상)
 *   순서    유료 파일럿 고객 → 학원 → 자사 고객(relation 자사 — 아이로그·문서딱) → 그 밖의 측정 고객. 탐침은 실행기가 맨 끝에, 유료 고객이 없는 날만
 *   이름    geo.clients.answer_pattern(정규식 원문)을 먼저 쓰고, 비었으면 clients.mjs 의 answerRe
 *   도메인  clients.mjs 덩어리가 있으면 그것(지금 재는 값 그대로), 없으면 geo.clients.domain
 *
 * 설정이 없는 고객도 목록에 남는다(conf=null). 실행기가 그 고객 id 로 「측정 설정 없음」 일감을 올린다 — 조용히 빼지 않는다.
 */
import { CODE_CLIENTS, 코드덩어리, 고객설정, 도메인정리 } from "./clients.mjs";
import { 더하기, 구축있음, 구축대기한도, 파일럿칸준비 } from "./pilot-plan.mjs";

export const HOUSE = "robotncoding";

/** 두 컬럼을 더하고, 덩어리에 정규식이 있는 고객은 비어 있을 때만 그 원문으로 채운다(학원·아이로그 — 지금과 같은 값) */
export async function 측정설정준비(q) {
  await q(`alter table geo.clients add column if not exists answer_pattern text`);
  await q(`alter table geo.clients add column if not exists measure_active boolean not null default false`);
  for (const c of CODE_CLIENTS) {
    if (!(c.answerRe instanceof RegExp)) continue;
    await q(`update geo.clients set answer_pattern = $2 where slug = $1 and coalesce(answer_pattern, '') = ''`, [c.slug, c.answerRe.source]);
  }
}

export { 도메인정리 };

/**
 * 고객 설정 칸(Step 37) — 사람이 넣은 말(config)과 사이트를 읽어 얻은 값(derived). 지우거나 바꾸지 않고 더하기만.
 * company.mjs 시작 준비가 부른다. 실패해도 계속 — loadClients 는 to_jsonb 로 읽어 칸이 없어도 돈다
 */
export async function 고객설정준비(q) {
  await q(`alter table geo.clients add column if not exists config jsonb not null default '{}'::jsonb`);
  await q(`alter table geo.clients add column if not exists derived jsonb not null default '{}'::jsonb`);
}

/**
 * 한 고객의 측정 설정. 이름 정규식과 도메인이 둘 다 있어야 잰다. 없으면 null.
 * 정규식은 늘 대소문자 무시(i) — clients.mjs 의 두 덩어리가 다 i 였다.
 */
export function 측정설정(row) {
  // loadClients 와 같은 설정 — 코드 덩어리가 있으면 그것, 없으면 고객설정(row). 동기라 DB 를 다시 읽지 않는다
  const 덩어리 = 코드덩어리(row.slug) ?? 고객설정(row);
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
 * 연 날이 착수+60일(구축대기한도)까지 안 들어오면 그날부터 뺀다 — 끝없이 재지 않는다. 원장 할 일은 company.mjs 가 올린다(Step 28 D22)
 */
export function 대상고르기(rows, 오늘) {
  const 진행중 = (r) => {
    if (r.cancelled_on) return false;
    const 처음 = r.kickoff_on || r.started_on;
    if (!처음 || 처음 > 오늘) return false;
    if (r.kickoff_on && 구축있음(r.needs_build) && !r.site_launch_on) return 오늘 < 더하기(r.kickoff_on, 구축대기한도);
    return Boolean(r.ends_on) && 오늘 <= 더하기(r.ends_on, 7);
  };
  const 유료 = [], 학원 = [], 자사 = [], 측정 = [];
  for (const r of rows) {
    if (r.slug === HOUSE) 학원.push({ ...r, 묶음: "학원" });
    else if (진행중(r) && Number(r.price) > 0) 유료.push({ ...r, 묶음: "유료" });
    else if ((진행중(r) || r.measure_active === true) && r.relation === "자사") 자사.push({ ...r, 묶음: "자사" });
    else if (진행중(r) || r.measure_active === true) 측정.push({ ...r, 묶음: "측정" });
  }
  const 차례 = (a, b) => String(a.started_on ?? "").localeCompare(String(b.started_on ?? "")) || a.id - b.id;
  return [...유료.sort(차례), ...학원, ...자사.sort(차례), ...측정.sort(차례)].map((r) => ({ ...r, conf: 측정설정(r) }));
}

/**
 * 오늘 학원 밖에 잴 고객이 몇 곳인가 — 상한을 고객 수만큼 늘린다(Step 32 D45, 원장 「예산은 고객 수만큼」).
 * 유료 파일럿 고객, 또는 승인 질문이 있는 자사 고객(아이로그·문서딱). 승인 질문이 없는 자사 고객은 안 재니 안 센다.
 * 학원만 있는 날은 0. 순수 함수 — 가짜 행으로 시험한다
 */
export const 고객수 = (대상) => 대상.filter((r) => r.묶음 === "유료" || (r.묶음 === "자사" && Number(r.approved_n) > 0)).length;

const 고객행 = `select c.id, c.slug, c.name, c.domain, c.answer_pattern, c.measure_active, c.relation,
    p.price, p.started_on::text as started_on, p.ends_on::text as ends_on,
    p.kickoff_on::text as kickoff_on, p.needs_build, p.site_launch_on::text as site_launch_on, p.cancelled_on::text as cancelled_on,
    (select count(*) from geo.pilot_questions pq where pq.pilot_id = p.id and pq.approved)::int as approved_n
  from geo.clients c left join geo.pilots p on p.client_id = c.id`;
// 시험 고객(status test, Step 37)은 이름으로 콕 집을 때만 잰다 — company·daily-agent 와 같은 규칙. 돈 쓰는 길이라 구조로 막는다
const 시험빼고 = " where coalesce(c.status, '') <> 'test'";

/**
 * 오늘 학원 밖 측정 대상 고객 수 k(고객수). 모든 실행기(claude-code.mjs·ai-measure·ai-web-measure)가
 * 이것 하나로 상한을 골라야 하루 합이 맞는다 — --client 로 한 고객만 재도 DB 전체로 판단한다.
 * 칸 준비(ALTER)는 하지 않는다. 못 읽으면 0 — 가장 작은 상한으로 돈다
 */
export async function 고객측정일(q, 오늘) {
  try { return 고객수(대상고르기(await q(고객행 + 시험빼고), 오늘)); } catch { return 0; }
}

/**
 * 하루 상한(Step 32 D45). k = 학원 밖 측정 대상 고객 수. 고객 한 곳마다 승인 20문항 몫을 더한다.
 *   Claude 하루 40+20k · 측정 몫 22+20k · 화면 60+60k질의   (k=0 → 40·22·60, k=1 → 60·42·120 — Step 28·30 값 그대로)
 * 측정 아닌 몫(claude − reserve)은 k 와 상관없이 18 이다. 몫은 유료 → 학원 → 자사 순서로 쓰고, 탐침은 맨 끝이다.
 * env(CLAUDE_DAILY_MAX·CLAUDE_MEASURE_RESERVE·WEB_MEASURE_DAILY_MAX)에 숫자가 있으면 그것이 먼저다. 빈 글자("")는 없는 것으로 친다(Actions 가 안 정한 vars 를 "" 로 넘긴다)
 */
export function 측정상한(k, env = process.env) {
  const 값 = (v) => (/^\d+$/.test(String(v ?? "").trim()) ? Number(String(v).trim()) : null);
  const n = Math.max(0, Math.floor(Number(k) || 0));
  const claude = 값(env.CLAUDE_DAILY_MAX) ?? 40 + 20 * n;
  // 측정 몫은 하루 상한을 넘을 수 없다 — 한쪽 vars 만 넣으면 측정 아닌 몫이 음수가 돼 초안·수리·감사가 다 막힌다(Richard 28)
  const reserve = Math.min(값(env.CLAUDE_MEASURE_RESERVE) ?? 22 + 20 * n, claude);
  return { claude, reserve, web: 값(env.WEB_MEASURE_DAILY_MAX) ?? 60 + 60 * n };
}

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
  return 대상고르기(await q(고객행 + 시험빼고), 오늘);
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
