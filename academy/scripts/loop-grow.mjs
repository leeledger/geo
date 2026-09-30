/**
 * 성과가 개수로 늘어나는 고리 (Step 31). daily-agent 가 부른다.
 *
 * 전에는 루프가 안 불리는 질문(<50%)만 다뤘다. 「효과 있음」은 기록만 되고 아무도 안 읽었고,
 * 불린 탐침은 다음 반경 탐침만 만들고 질문·글로 안 이어졌다(원장 2026-09-30 「성과가 있으면 갯수가 늘어나야 하는데」).
 *
 *   전파     「효과 있음」 처방을 같은 단계의 안 해 본 질문 사다리 첫 칸으로 (D38)
 *   후보     후퇴한 질문 맨 앞 → 단계 → 경쟁사 우세 → 적중률 (D39·D42)
 *   승격     불린 탐침을 원장에게 「승인 질문 후보」로 묻고, 「했어요」면 확장 질문으로 넣는다 (D40)
 *   확장줄   「확장 질문 n개 중 k개 불림」 (현황판·아침 보고)
 *
 * 확장 질문 = geo.pilot_questions 에 stage 'extend', approved=false, 자리 101 부터.
 * approved=false 라 승인 20문항을 읽는 곳(측정 ai_measurements·판정·케이스 리포트·파일럿 보고)은 손대지 않아도 안 섞인다.
 * 측정은 탐침과 같은 길(ai-measure 탐침재기 → academy.ai_probe_measurements)이다.
 * 점수·가중치는 만들지 않는다. 숫자는 DB 에서 센 것만.
 */
import { 점유, 이름정규식 } from "../pilot-report-core.mjs";

export const 확장자리 = 100;
const 글자만 = (s) => String(s ?? "").replace(/[^가-힣a-zA-Z0-9]/g, "");

/** 단계별 가장 최근 「효과 있음」 행동. Map stage → run */
export function 전파찾기(runs, stageOf) {
  const m = new Map();
  for (const r of runs.filter((x) => x.verdict === "효과 있음" && x.action_kind).sort((a, b) => a.run_day.localeCompare(b.run_day))) {
    const s = stageOf[r.target_prompt];
    if (s) m.set(s, r);
  }
  return m;
}

/** 이 질문에 전파할 처방. 원래 질문이거나 그 처방을 이미 해 봤으면 null */
export function 전파칸(원, x, tried) {
  if (!원 || 원.target_prompt === x.prompt_id || tried.has(원.action_kind)) return null;
  return 원;
}

/** 사다리에서 처방 하나를 첫 칸으로. 사다리에 없는 칸이면 그대로 */
export const 사다리짓기 = (ladder, kind) => (kind && ladder.includes(kind) ? [kind, ...ladder.filter((k) => k !== kind)] : ladder);

/**
 * 최근 7일 답 원문에서 (경쟁사 이름이 나온 답 수 합 − 우리 이름이 나온 답 수). 경쟁사가 없으면 0.
 * pilot-report-core 점유 그대로 — 보고서와 같은 셈
 */
export function 경쟁우세(rows, 우리re, 경쟁사) {
  if (!경쟁사?.length || !우리re) return 0;
  const 이름들 = [{ key: "우리", re: 우리re }, ...경쟁사.map((n, i) => ({ key: `c${i}`, re: 이름정규식(n) }))];
  const s = 점유(rows, 이름들);
  return 경쟁사.reduce((sum, _, i) => sum + s.이름별[`c${i}`].k, 0) - s.이름별.우리.k;
}

/**
 * 오늘 후보. 후퇴한 질문(D39)은 50% 미만 필터와 무관하게 맨 앞.
 * 나머지는 50% 미만 · 정렬 단계 → 경쟁사 우세(큰 것 먼저, D42) → 적중률. 우세가 전부 0 이면 Step 31 전 순서와 같다
 */
export function 후보고르기(표, { 열림, 버린, 후퇴 = new Set(), 우세 = {}, 단계순 }) {
  const 열린것 = (x) => 열림.has(x.prompt_id) || 버린.has(x.prompt_id);
  const 단계 = (a, b) => (단계순[a.stage] ?? 9) - (단계순[b.stage] ?? 9);
  const 앞 = 표.filter((x) => 후퇴.has(x.prompt_id) && !열린것(x)).sort(단계).map((x) => ({ ...x, 후퇴: true }));
  const 뒤 = 표.filter((x) => !후퇴.has(x.prompt_id) && x.n > 0 && x.rate < 50 && !열린것(x))
    .sort((a, b) => 단계(a, b) || (우세[b.prompt_id] ?? 0) - (우세[a.prompt_id] ?? 0) || a.rate - b.rate);
  return [...앞, ...뒤];
}

/** 후퇴한 질문의 불리던 글 — 앞 창에서 인용된 우리 주소 중 발행 글. 없으면 제목 겹침이 가장 큰 글(0.4 이상)은 호출부가 고른다 */
export function 불리던글(urls, published) {
  for (const u of urls ?? []) {
    const slug = /\/blog\/([^/?#]+)/.exec(u)?.[1];
    const p = slug && published.find((x) => x.slug === decodeURIComponent(slug));
    if (p) return p;
  }
  return null;
}

/**
 * 「확장 질문 n개 중 k개 불림」. 질문마다 한 곳이라도 7일 안 2번 넘게 재서 절반 넘게 불렸으면 불림.
 * 2번이 안 된 질문은 따로 센다 — 한 번 맞은 것(1/1)을 불렸다고 하지 않는다. 확장 질문이 없으면 null
 */
export function 확장줄(질문들, rows) {
  if (!질문들.length) return null;
  let k = 0, 덜 = 0;
  for (const x of 질문들) {
    const mine = rows.filter((r) => r.prompt_id === x.prompt_id);
    const 곳들 = [...new Set(mine.map((r) => r.collection_method))].map((m) => mine.filter((r) => r.collection_method === m));
    const 잰곳 = 곳들.filter((l) => l.length >= 2);
    if (!잰곳.length) { 덜++; continue; }
    if (잰곳.some((l) => l.filter((r) => r.mentioned || r.cited).length * 2 >= l.length)) k++;
  }
  return `확장 질문 ${질문들.length}개 중 ${k}개 불림(최근 7일${덜 ? ` · ${덜}개는 아직 덜 잼` : ""})`;
}

/**
 * 불린 탐침 → 원장 할 일 「승인 질문 후보」(D40). dedupe probe-promote-<탐침 id>.
 * 사람 대기면 숫자만 새로, 닫힘이면 30일 뒤에만 다시 연다. 완료(원장이 넣기로 함)는 다시 안 연다 — 확장넣기가 탐침을 끈다
 */
export async function 승격일감(q, { clientId, p, 곳이름, DRY }) {
  const key = `probe-promote-${p.prompt_id}`;
  const title = `승인 질문 후보: 「${p.text}」 (탐침 ${p.hit}/${p.n})`;
  if (DRY) return { key, title, 말: "(dry) 쓰지 않음" };
  const detail = `${곳이름} 에서 최근 7일 ${p.n}번 물어 ${p.hit}번 이름이 나왔습니다. ` +
    "「했어요」를 누르면 승인 20문항은 그대로 두고 「확장 질문」으로 넣어 계속 잽니다. 영업 숫자와 효과 판정에는 안 들어갑니다. 넣지 않을 거면 그냥 두셔도 됩니다.";
  const r = await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload)
     values ($1, 'measure', 'probe-promote', $2, $3, $4, '사람 대기', 30, $5::jsonb)
     on conflict (client_id, dedupe_key) do update set status='사람 대기', title=excluded.title, detail=excluded.detail,
       payload=excluded.payload, done_at=null, updated_at=now()
     where geo.agent_tasks.status = '사람 대기'
        or (geo.agent_tasks.status = '닫힘' and (geo.agent_tasks.done_at is null or geo.agent_tasks.done_at <= now() - interval '30 days'))
     returning id`,
    [clientId, key, title, detail, JSON.stringify({ sticky: true, probe: p.prompt_id, text: p.text, method: p.method, hit: p.hit, n: p.n })]);
  return { key, title, 말: r.length ? `일감 #${r[0].id}` : "30일 안에 닫혔거나 이미 넣음 — 그대로 둠" };
}

/**
 * 원장이 「했어요」 한 승격 일감을 확장 질문으로 넣는다. 넣은 자리는 payload.extend 에 적어 다시 안 넣는다.
 * 같은 글자의 확장 질문이 이미 있으면 새로 안 만든다. 탐침은 끈다(같은 문장을 두 번 재지 않는다). 돌려주는 것: 기록 줄들
 */
export async function 확장넣기(q, { clientId, 오늘, DRY }) {
  const 할것 = await q(`select id, payload from geo.agent_tasks
                        where client_id=$1 and kind='probe-promote' and status='완료' and not (payload ? 'extend')`, [clientId]);
  if (!할것.length) return [];
  if (DRY) return 할것.map((t) => `(dry) 확장 질문으로 넣을 차례: 「${t.payload.text}」 (일감 #${t.id})`);
  const [pilot] = await q(`select id from geo.pilots where client_id=$1 order by id limit 1`, [clientId]);
  if (!pilot) return 할것.map((t) => `파일럿이 없어 「${t.payload.text}」 를 확장 질문으로 못 넣었습니다 (일감 #${t.id})`);
  const 기록 = [];
  for (const t of 할것) {
    const 있는 = await q(`select position, text from geo.pilot_questions where pilot_id=$1 and stage='extend'`, [pilot.id]);
    const 같은 = 있는.find((x) => 글자만(x.text) === 글자만(t.payload.text));
    let 자리 = 같은?.position;
    if (!같은) {
      const [m] = await q(`select greatest($2::int, coalesce(max(position), 0)) + 1 as n from geo.pilot_questions where pilot_id=$1`, [pilot.id, 확장자리]);
      자리 = m.n;
      await q(`insert into geo.pilot_questions (pilot_id, position, stage, text, approved) values ($1, $2, 'extend', $3, false)
               on conflict (pilot_id, position) do nothing`, [pilot.id, 자리, t.payload.text]);
    }
    await q(`update academy.ai_probe_questions set active=false where client_id=$1 and prompt_id=$2`, [clientId, t.payload.probe]);
    await q(`update geo.agent_tasks set payload = payload || $2::jsonb, updated_at=now(), evidence = left(evidence || $3, 4000) where id=$1`,
      [t.id, JSON.stringify({ extend: 자리 }), `\n${오늘} 확장 질문 q${자리} 로 넣음 · 탐침 ${t.payload.probe} 끔`]);
    기록.push(`「${t.payload.text}」 → 확장 질문 q${자리} (일감 #${t.id}, 탐침 ${t.payload.probe} 끔)`);
  }
  return 기록;
}
