/**
 * 「세션 대기」 글 일감의 생애주기 (Step 30). 글 쓰는 길이 세션인 고객(clients.mjs loop.draft = "session", 아이로그)용.
 *
 *   열기    개선 루프(daily-agent)가 content 칸에서 연다. 같은 질문의 question-draft 일감이 있으면 그것을 다시 연다
 *   묶기    열린 세션 글은 고객당 1개(Step 40 D60). 열린 것이 있으면 새로 안 만들고 그 일감 payload.questions 에 질문만 덧붙인다
 *   끝냄    세션이 글을 쓰고 배포한 뒤 `daily-agent.mjs --session-done <id> "근거"` — 완료
 *   판정    다음 날 루프가 run_day 이후 완료된 같은 질문 일감을 찾아 판정 창을 연다
 *   닫기    나이로 안 닫는다. 세션이 끝내거나 원장이 닫는다. 7일 넘으면 현황판 원장 할 일 한 줄(Step 40 D61)
 *
 * 같은 질문은 한 일감 — 질문 글자(띄어쓰기·문장부호 뺀 것)로 찾고(payload.question 과 묶인 payload.questions 둘 다),
 * 없을 때만 세션글키(질문)로 새로 만든다. 회사 루프 who-wins 도 같은 규칙.
 * q 를 받는 함수들이라 가짜 q 로 시험한다(test-ilog-loop.mjs).
 */
import crypto from "node:crypto";
import { 세션글제목 } from "../clients.mjs";

/** 질문 글자 — 띄어쓰기·문장부호를 뺀다. SQL 쪽 regexp_replace(…, '[^가-힣a-zA-Z0-9]', '', 'g') 와 같은 셈 */
export const 글자만 = (s) => String(s ?? "").replace(/[^가-힣a-zA-Z0-9]/g, "");
/** 세션 글 일감 키 — 질문 글자 기준(검색어가 아니라). 같은 질문이면 개선 루프·회사 루프가 같은 키를 쓴다 */
export const 세션글키 = (question) => `qdraft-${crypto.createHash("sha1").update(글자만(question)).digest("hex").slice(0, 10)}`;
/** 한 일감에 묶는 질문 수 상한 — 넘으면 안 묶는다 */
export const 묶음상한 = 15;

/** 질문 글자가 같다 — payload.question 이나 묶인 payload.questions 원소 중 하나라도 */
const 같은질문 = `(regexp_replace(payload->>'question', '[^가-힣a-zA-Z0-9]', '', 'g') = $2
  or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(payload->'questions') = 'array' then payload->'questions' else '[]'::jsonb end) x
              where regexp_replace(x, '[^가-힣a-zA-Z0-9]', '', 'g') = $2))`;

/** 이 고객의 같은 질문 question-draft 일감(상태 무관, 열린 것 먼저) — 없으면 undefined */
export const 같은질문일감 = async (q, clientId, 질문) =>
  (await q(`select id, status, dedupe_key, payload->>'question' as question from geo.agent_tasks
             where client_id=$1 and kind='question-draft' and ${같은질문} order by (status = '세션 대기') desc, id limit 1`,
    [clientId, 글자만(질문)]))[0];

/**
 * 묶기(D60). 이 고객의 열린 「세션 대기」 question-draft(가장 오래된 것)에 질문을 덧붙인다.
 * payload.questions 는 대표 질문을 맨 앞에 둔 전체 목록 — 길이가 곧 묶인 질문 수다. 글자만() 기준으로 이미 있으면 안 늘린다.
 * 상한을 넘으면 안 넣고 evidence 에 「상한 — 안 묶음」. 돌려주는 것 { id, 말, 묶음 } — 묶음 false 는 상한(그래도 새로 만들지 않는다).
 * 열린 것이 없으면 undefined
 */
export async function 세션일감묶기(q, { c, 질문, 출처, 오늘, DRY }) {
  const [열린] = await q(`select id, payload from geo.agent_tasks where client_id=$1 and kind='question-draft' and status='세션 대기'
                          order by created_at, id limit 1`, [c.id]);
  if (!열린) return undefined;
  const pl = 열린.payload ?? {};
  const 목록 = Array.isArray(pl.questions) && pl.questions.length ? [...pl.questions] : (pl.question ? [pl.question] : []);
  if (목록.some((x) => 글자만(x) === 글자만(질문))) return { id: 열린.id, 말: `열린 세션 글 일감 #${열린.id} 에 이미 있는 질문`, 묶음: true };
  if (목록.length >= 묶음상한) {
    if (!DRY) {
      await q(`update geo.agent_tasks set updated_at=now(), evidence = left(evidence || $2, 4000) where id=$1`,
        [열린.id, `\n${오늘} ${출처} 상한 — 안 묶음: 「${질문}」`]);
    }
    return { id: 열린.id, 말: `열린 세션 글 일감 #${열린.id} 이 질문 ${묶음상한}개로 차서 「${질문}」은 안 묶음`, 묶음: false };
  }
  if (DRY) return { id: 열린.id, 말: `(dry) 열린 세션 글 일감 #${열린.id} 에 「${질문}」 묶을 차례`, 묶음: true };
  await q(`update geo.agent_tasks set payload = payload || jsonb_build_object('questions', $2::jsonb), updated_at=now(),
             evidence = left(evidence || $3, 4000) where id=$1`,
    [열린.id, JSON.stringify([...목록, 질문]), `\n${오늘} ${출처} 질문 묶음: 「${질문}」`]);
  return { id: 열린.id, 말: `열린 세션 글 일감 #${열린.id} 에 「${질문}」 묶음`, 묶음: true };
}

/**
 * 열기. x = { prompt_id, text, stage, hit, n } · 돌려주는 것 { id, 말 }.
 * 다른 세션 글이 열려 있으면 거기에 묶는다(D60). 아니면 같은 질문 일감을 다시 열거나 새로 만든다
 */
export async function 세션일감열기(q, { c, 설정, x, 경쟁, 오늘, DRY }) {
  const title = 세션글제목(c.name, x.text);
  const 할일 = `Claude 세션에서 ${설정.draftWhere} 에 씁니다`;
  const 있음 = await 같은질문일감(q, c.id, x.text);
  // 묶인 질문으로 이미 열려 있으면 제목을 덮어쓰지 않는다 — 그 일감의 대표 질문이 따로 있다
  if (있음?.status === "세션 대기" && 글자만(있음.question) !== 글자만(x.text)) return { id: 있음.id, 말: `일감 #${있음.id} 에 이미 묶여 있음` };
  if (있음?.status !== "세션 대기") {
    const 묶음 = await 세션일감묶기(q, { c, 질문: x.text, 출처: `개선 루프 ${x.prompt_id}`, 오늘, DRY });
    if (묶음) return { id: 묶음.id, 말: 묶음.말 };
  }
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

/** 판정: run_day(KST) 이후 완료된 같은 질문 일감(묶인 질문 포함) — 없으면 undefined */
export const 세션완료찾기 = async (q, clientId, 질문, runDay) =>
  (await q(`select id, done_at from geo.agent_tasks where client_id=$1 and kind='question-draft' and status='완료' and ${같은질문}
              and (done_at at time zone 'Asia/Seoul')::date >= $3::date order by done_at desc limit 1`,
    [clientId, 글자만(질문), runDay]))[0];

/**
 * 탐침에서 안 불린 반경 글(Step 31 D41). gap = loop-review gaps 한 칸 { prompt_id, text, radius, method, n, root }.
 * 같은 문장 일감이 있으면(상태 무관) 안 연다. 열린 세션 글이 있으면 그 일감에 문장만 묶는다(고객당 1편, D60). 나이로 닫지 않는다.
 * 재료(academy.materials 안 쓴 것)가 없으면 「재료 필요」를 적는다 — 재료 없이 쓰면 일반론이 된다(메모리 draft-needs-real-material).
 * 돌려주는 것 { id, 말 }
 */
export async function 탐침글일감(q, { c, 설정, gap, 곳이름, 오늘, DRY }) {
  const 있음 = await 같은질문일감(q, c.id, gap.text);
  if (있음) return { id: null, 말: `「${gap.text}」 글 일감 #${있음.id}(${있음.status}) 이 이미 있습니다` };
  const 묶음 = await 세션일감묶기(q, { c, 질문: gap.text, 출처: `탐침 ${gap.prompt_id}`, 오늘, DRY });
  if (묶음) return { id: null, 말: 묶음.말 };
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
  return 새 ? { id: 새.id, 말: `탐침 글 일감 #${새.id} 새로 만듦` } : { id: null, 말: "같은 키 일감이 있어 그대로 둠" };
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
