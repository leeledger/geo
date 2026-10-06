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
