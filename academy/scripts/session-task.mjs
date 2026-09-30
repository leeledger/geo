/**
 * 「세션 대기」 글 일감의 생애주기 (Step 30). 글 쓰는 길이 세션인 고객(clients.mjs loop.draft = "session", 아이로그)용.
 *
 *   열기    개선 루프(daily-agent)가 content 칸에서 연다. 같은 질문의 question-draft 일감이 있으면 그것을 다시 연다
 *   끝냄    세션이 글을 쓰고 배포한 뒤 `daily-agent.mjs --session-done <id> "근거"` — 완료
 *   판정    다음 날 루프가 run_day 이후 완료된 같은 질문 일감을 찾아 판정 창을 연다
 *   닫기    14일 동안 안 끝나면 루프가 run 을 「미처리」로 두고 일감도 닫힘으로
 *
 * 원장 할 일(사람 대기)에는 넣지 않는다(Arch — 현황판 할 일은 원장 몫만). 현황판은 상자 밖 「세션에서 할 일 n건」.
 * 같은 질문은 한 일감 — 질문 글자(띄어쓰기·문장부호 뺀 것)로 찾고, 없을 때만 세션글키(질문)로 새로 만든다. 회사 루프 who-wins 도 같은 규칙.
 * q 를 받는 함수들이라 가짜 q 로 시험한다(test-ilog-loop.mjs).
 */
import crypto from "node:crypto";
import { 세션글제목 } from "../clients.mjs";

/** 질문 글자 — 띄어쓰기·문장부호를 뺀다. SQL 쪽 regexp_replace(…, '[^가-힣a-zA-Z0-9]', '', 'g') 와 같은 셈 */
export const 글자만 = (s) => String(s ?? "").replace(/[^가-힣a-zA-Z0-9]/g, "");
/** 세션 글 일감 키 — 질문 글자 기준(검색어가 아니라). 같은 질문이면 개선 루프·회사 루프가 같은 키를 쓴다 */
export const 세션글키 = (question) => `qdraft-${crypto.createHash("sha1").update(글자만(question)).digest("hex").slice(0, 10)}`;

const 같은질문 = `regexp_replace(payload->>'question', '[^가-힣a-zA-Z0-9]', '', 'g') = $2`;

/** 이 고객의 같은 질문 question-draft 일감(상태 무관) — 없으면 undefined */
export const 같은질문일감 = async (q, clientId, 질문) =>
  (await q(`select id, status, dedupe_key from geo.agent_tasks where client_id=$1 and kind='question-draft' and ${같은질문} order by id limit 1`,
    [clientId, 글자만(질문)]))[0];

/** 열기. x = { prompt_id, text, stage, hit, n } · 돌려주는 것 { id, 말 } */
export async function 세션일감열기(q, { c, 설정, x, 경쟁, 오늘, DRY }) {
  const title = 세션글제목(c.name, x.text);
  const 할일 = `Claude 세션에서 ${설정.draftWhere} 에 씁니다`;
  const 있음 = await 같은질문일감(q, c.id, x.text);
  if (DRY) return { id: 있음?.id ?? null, 말: 있음 ? `(dry) 일감 #${있음.id}(${있음.status}) 다시 엶` : "(dry) 새 세션 일감" };
  if (있음) {
    await q(`update geo.agent_tasks set status='세션 대기', title=$2, done_at=null, updated_at=now(), last_error=$3,
               payload = payload || $4::jsonb, evidence = left(evidence || $5, 4000) where id=$1`,
      [있음.id, title, 할일, JSON.stringify({ sticky: true, session: true, prompt_id: x.prompt_id }), `\n${오늘} 개선 루프가 ${x.prompt_id} 로 다시 엶`]);
    return { id: 있음.id, 말: `일감 #${있음.id} 다시 엶` };
  }
  const detail = `개선 루프: ${x.prompt_id} 최근 7일 적중 ${x.hit}/${x.n}. ${설정.draftWhere} 에 이 질문에 답하는 가이드를 씁니다.\n이기는 곳: ${경쟁.join(", ")}`;
  const [새] = await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, last_error, payload)
     values ($1, 'content', 'question-draft', $2, $3, $4, '세션 대기', 35, $5, $6::jsonb)
     on conflict (client_id, dedupe_key) do update set status='세션 대기', title=excluded.title, detail=excluded.detail,
       last_error=excluded.last_error, payload = geo.agent_tasks.payload || excluded.payload, done_at=null, updated_at=now()
     returning id`,
    [c.id, 세션글키(x.text), title, detail, 할일,
      JSON.stringify({ sticky: true, session: true, prompt_id: x.prompt_id, question: x.text, stage: x.stage, sources: 경쟁 })]);
  return { id: 새.id, 말: `일감 #${새.id} 새로 만듦` };
}

/** 판정: run_day(KST) 이후 완료된 같은 질문 일감 — 없으면 undefined */
export const 세션완료찾기 = async (q, clientId, 질문, runDay) =>
  (await q(`select id, done_at from geo.agent_tasks where client_id=$1 and kind='question-draft' and status='완료' and ${같은질문}
              and (done_at at time zone 'Asia/Seoul')::date >= $3::date order by done_at desc limit 1`,
    [clientId, 글자만(질문), runDay]))[0];

/** 14일 닫기: 같은 질문의 세션 대기 일감도 닫힘으로. 닫은 일감 id 목록 */
export async function 세션일감닫기(q, { clientId, 질문, 오늘, DRY }) {
  if (DRY) return [];
  return (await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = left(evidence || $3, 4000)
                    where client_id=$1 and kind='question-draft' and status='세션 대기' and ${같은질문} returning id`,
    [clientId, 글자만(질문), `\n${오늘} 14일 동안 세션이 안 끝내 개선 루프가 닫음`])).map((r) => r.id);
}

/**
 * 탐침에서 안 불린 반경 글(Step 31 D41). gap = loop-review gaps 한 칸 { prompt_id, text, radius, method, n, root }.
 * 열린 세션 글은 고객당 1편 — 세션 대기 question-draft 가 하나라도 있으면 안 연다. 같은 문장 일감이 있으면(상태 무관) 안 연다.
 * 14일 동안 안 끝난 탐침 글 일감은 먼저 닫는다(안 닫으면 1편 규칙에 영영 막힌다).
 * 재료(academy.materials 안 쓴 것)가 없으면 「재료 필요」를 적는다 — 재료 없이 쓰면 일반론이 된다(메모리 draft-needs-real-material).
 * 돌려주는 것 { id, 말 }
 */
export async function 탐침글일감(q, { c, 설정, gap, 곳이름, 오늘, DRY }) {
  const 닫음 = DRY ? [] : (await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = left(evidence || $2, 4000)
                        where client_id=$1 and kind='question-draft' and status='세션 대기' and payload ? 'probe'
                          and updated_at <= now() - interval '14 days' returning id`,
    [c.id, `\n${오늘} 14일 동안 세션이 안 끝내 개선 루프가 닫음`])).map((r) => r.id);
  const 앞말 = 닫음.length ? `탐침 글 일감 #${닫음.join(", #")} 14일 지나 닫음 · ` : "";
  const [열린] = await q(`select id from geo.agent_tasks where client_id=$1 and kind='question-draft' and status='세션 대기' order by id limit 1`, [c.id]);
  if (열린) return { id: null, 말: `${앞말}열린 세션 글 일감 #${열린.id} 이 있어 「${gap.text}」 글은 아직 안 넘깁니다` };
  const 있음 = await 같은질문일감(q, c.id, gap.text);
  if (있음) return { id: null, 말: `${앞말}「${gap.text}」 글 일감 #${있음.id}(${있음.status}) 이 이미 있습니다` };
  const [m] = await q(`select count(*)::int n from academy.materials where client_id=$1 and cardinality(used_in)=0`, [c.id]).catch(() => [{ n: 0 }]);
  const 재료 = m?.n ?? 0;
  const title = `세션에서 ${c.name} 글 초안: 「${gap.text}」${재료 ? "" : " — 재료 필요"}`;
  if (DRY) return { id: null, 말: `(dry) ${title}` };
  const detail = `탐침 ${gap.prompt_id}(${gap.radius}) 을 ${곳이름} 에서 7일 ${gap.n}번 물었는데 한 번도 이름이 안 나왔습니다. 한 칸 좁은 쪽(${gap.root}에서 시작한 사슬)에서는 나왔습니다. ` +
    `${설정.draftWhere} 에 이 문장에 답하는 글을 씁니다.` +
    (재료 ? `\n안 쓴 재료 ${재료}건(/admin/material)이 있습니다. 재료에 있는 말·사실로만 씁니다.`
      : "\n재료 필요 — 상담에서 들은 말·수업 사실이 /admin/material 에 없습니다. 재료 없이 쓰면 일반론이 되니 재료가 들어온 뒤에 씁니다.");
  const [새] = await q(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, last_error, payload)
     values ($1, 'content', 'question-draft', $2, $3, $4, '세션 대기', 35, $5, $6::jsonb)
     on conflict (client_id, dedupe_key) do nothing returning id`,
    [c.id, 세션글키(gap.text), title, detail, `Claude 세션에서 ${설정.draftWhere} 에 씁니다`,
      JSON.stringify({ sticky: true, session: true, probe: gap.prompt_id, question: gap.text, stage: "probe", 재료 })]);
  return 새 ? { id: 새.id, 말: `${앞말}탐침 글 일감 #${새.id} 새로 만듦` } : { id: null, 말: `${앞말}같은 키 일감이 있어 그대로 둠` };
}

/** 끝냄(--session-done). 근거가 없으면 거부 — 근거 없는 완료는 감사(R3)가 잡는다. { ok, 말 } */
export async function 세션끝냄(q, { id, 근거, 시각, DRY }) {
  if (!Number.isInteger(id) || !String(근거 ?? "").trim()) return { ok: false, 말: `--session-done <일감번호> "근거(쓴 파일·배포)" 로 부르세요` };
  if (DRY) return { ok: true, 말: `(dry) 세션 글 일감 #${id} 을 완료로 닫을 차례 — 쓰지 않음` };
  const hit = await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || $2, 4000)
                        where id=$1 and kind='question-draft' and status='세션 대기' returning id`, [id, `\n${시각} 세션이 끝냄 · ${String(근거).trim()}`]);
  return hit.length
    ? { ok: true, 말: `세션 글 일감 #${id} 완료 · 다음 날 개선 루프가 효과 측정을 시작합니다` }
    : { ok: false, 말: `세션 대기인 글 일감 #${id} 이 없습니다` };
}
