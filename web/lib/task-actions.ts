"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";

/**
 * 「원장님이 하실 일」을 끝냈다고 표시한다. 신호에서 나온 일은 신호가 남아 있으면 회사 루프가 다시 연다 —
 * 그래서 이 버튼은 거짓 완료를 만들지 못한다. 로그인·네이버 확인처럼 신호가 없는 일(sticky)을 닫는 데 쓴다.
 */
export async function finishTask(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const { rows } = await inqPool().query(
    `update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n원장이 완료 표시', 4000)
      where id=$1 and status='사람 대기' returning client_id, agent, title`, [id]);
  if (rows[0]) {
    await inqPool().query(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,$2,'원장 완료 표시',true,$3)`,
      [rows[0].client_id, rows[0].agent, rows[0].title]).catch((e) => console.error("활동 기록 실패", e));
  }
  revalidatePath("/admin/ops");
}
