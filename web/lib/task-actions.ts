"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { 창요청 } from "./login-core.mjs";

/**
 * 「원장님이 하실 일」을 끝냈다고 표시한다. 신호에서 나온 일은 신호가 남아 있으면 회사 루프가 다시 연다 —
 * 그래서 이 버튼은 거짓 완료를 만들지 못한다. 로그인·네이버 확인처럼 신호가 없는 일(sticky)을 닫는 데 쓴다.
 */
export async function finishTask(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  // 네이버 이관 확인은 여기서 못 닫는다 — 닫기만 하면 naver_log_no 가 비어 같은 글이 또 올라간다. resolveNaverAttempt 를 쓴다
  const { rows } = await inqPool().query(
    `update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n원장이 완료 표시', 4000)
      where id=$1 and status='사람 대기' and kind <> 'naver-attempt' returning client_id, agent, title`, [id]);
  if (rows[0]) {
    await inqPool().query(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,$2,'원장 완료 표시',true,$3)`,
      [rows[0].client_id, rows[0].agent, rows[0].title]).catch((e) => console.error("활동 기록 실패", e));
  }
  revalidatePath("/admin/ops");
}

/**
 * 네이버 이관이 올라갔는지 모호할 때 원장이 확인한 결과를 적는다.
 *   올라가 있음  글 번호(logNo)를 적는다 → 다시 안 올린다
 *   안 올라감    시도 기록을 닫는다 → 다음 로컬 에이전트 실행이 다시 올린다
 */
export async function resolveNaverAttempt(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const id = Number(form.get("id"));
  const outcome = String(form.get("outcome") ?? "");
  const logNo = String(form.get("logNo") ?? "").trim().match(/(\d{6,})/)?.[1] ?? "";
  if (!Number.isInteger(id)) return;
  const db = inqPool();
  const { rows } = await db.query(
    `select client_id, payload->>'slug' slug, title from geo.agent_tasks where id=$1 and kind='naver-attempt' and status='사람 대기'`, [id]);
  const t = rows[0];
  if (!t?.slug) return;
  if (outcome === "posted") {
    if (!logNo) return; // 번호 없이 「올라가 있음」은 받지 않는다 — 빈 칸이면 다시 올라간다
    await db.query(`update academy.posts set naver_log_no=$2, naver_at=coalesce(naver_at, now()) where slug=$1 and naver_log_no is null`, [t.slug, logNo]);
    await db.query(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence=left(evidence || E'\n원장 확인: 올라가 있음 logNo=' || $2, 4000) where id=$1`, [id, logNo]);
  } else if (outcome === "retry") {
    await db.query(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence=left(evidence || E'\n원장 확인: 안 올라감 — 다시 시도', 4000) where id=$1`, [id]);
  } else return;
  await db.query(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,'deliver','원장 네이버 확인',true,$2)`,
    [t.client_id, `${t.title} · ${outcome === "posted" ? `올라가 있음 ${logNo}` : "다시 시도"}`]).catch((e) => console.error("활동 기록 실패", e));
  revalidatePath("/admin/ops");
}

/**
 * 「로그인 창 열기」(Step 39b) — 사람 대기 login-* 일감이면 open-login 일감을 로컬 대기로 올린다. 원장 PC 의 login-poll 이 매분 집어 창을 연다.
 * 두 번 눌러도 한 행(login-core 창요청 upsert). 그 일감 줄은 「조치 중 · 로그인 창 요청함」으로 흐려진다
 */
export async function requestLogin(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const q = (s: string, p: unknown[] = []) => inqPool().query(s, p).then((r) => r.rows);
  const r = await 창요청(q, id);
  if (r.ok && !r.이미) {
    await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id)
             select client_id, 'deliver', '로그인 창 요청', true, title, id from geo.agent_tasks where id = $1`, [id]).catch((e) => console.error("활동 기록 실패", e));
  }
  revalidatePath("/admin/ops");
}

/** 승인 기다리는 수리안 일감(Step 42). 사람 대기가 아니면(이미 합침·버림·만료) 아무것도 안 한다 */
async function 수리안일감(id: number) {
  const { rows } = await inqPool().query(
    `select id, client_id, title, payload from geo.agent_tasks where id=$1 and kind='repair-approval' and status='사람 대기'`, [id]);
  return rows[0] as { id: number; client_id: number; title: string; payload: Record<string, unknown> | null } | undefined;
}

/**
 * 「합치기」 — GitHub 에 repair.yml mode=merge 를 띄운다. 사람 계정(leeledger) 토큰이라 repair.mjs 의 「손으로」 가드가 그대로 산다.
 * 합치는 판단(비상 스위치·멈춤·가지 머리·가드·재검토)은 전부 repair.mjs 가 한다 — 여기서는 요청만.
 * 상태는 사람 대기 그대로 둔다(승인합치기는 사람 대기만 합친다). 30분 안에 또 누르면 무시
 */
export async function approveRepair(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const t = await 수리안일감(id);
  if (!t) return;
  const p = t.payload ?? {};
  const 요청 = typeof p.merge_requested_at === "string" ? Date.parse(p.merge_requested_at) : NaN;
  if (Number.isFinite(요청) && Date.now() - 요청 < 30 * 60000 && !p.merge_result) return;
  const task = Number(p.task_id);
  const db = inqPool();
  const 남김 = (patch: Record<string, unknown>) =>
    db.query(`update geo.agent_tasks set payload = coalesce(payload, '{}'::jsonb) || $2::jsonb, updated_at=now() where id=$1`, [id, JSON.stringify(patch)]);
  const 활동 = (ok: boolean, summary: string) =>
    db.query(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id) values ($1,'repair','원장 합치기 요청',$2,$3,$4)`,
      [t.client_id, ok, summary, id]).catch((e) => console.error("활동 기록 실패", e));
  const token = process.env.GH_DISPATCH_TOKEN?.trim();
  let why: string | null = null;
  if (!token) why = "토큰 없음";
  else if (!Number.isInteger(task) || task <= 0) why = "수리안 번호 없음";
  else {
    try {
      const r = await fetch("https://api.github.com/repos/leeledger/geo/actions/workflows/repair.yml/dispatches", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
        body: JSON.stringify({ ref: "main", inputs: { mode: "merge", task: String(task) } }),
      });
      if (r.status !== 204) why = `요청 실패 ${r.status}`;
    } catch (e) {
      console.error("합치기 요청 실패", e);
      why = "요청 실패 0";
    }
  }
  if (why) {
    await 남김({ merge_result: { at: new Date().toISOString(), why } });
    await 활동(false, `${t.title} · ${why}`);
  } else {
    await 남김({ merge_requested_at: new Date().toISOString(), merge_result: null });
    await 활동(true, t.title);
  }
  revalidatePath("/admin/ops");
}

/** 「버리기」 — 승인 일감을 닫는다. 다음 수리 실행의 거절처리가 수리안을 「거절」로 적고 그 조사는 더 자동으로 고치지 않는다(기존 길) */
export async function discardRepair(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const t = await 수리안일감(id);
  if (!t) return;
  const db = inqPool();
  await db.query(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n원장이 버림', 4000)
    where id=$1 and status='사람 대기'`, [id]);
  await db.query(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id) values ($1,'repair','원장 버림',true,$2,$3)`,
    [t.client_id, t.title, id]).catch((e) => console.error("활동 기록 실패", e));
  revalidatePath("/admin/ops");
}
