"use server";

import { revalidatePath } from "next/cache";

import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { HOURS_DDL } from "./hours";

/** 서버 동작은 동작 번호만 알면 누구나 부를 수 있다. 동작 자체를 막는다(inquiry-actions.ts 와 같다) */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}

/** 오늘 한 일 · 분 — 한 줄. 표는 company.mjs 가 매시 시작에서 만든다(Step 27 D16). 그 전에 입력이 먼저 와도 되게 여기서도 한 번 */
export async function addHours(form: FormData) {
  await guard();
  const clientId = Number(form.get("client_id"));
  const minutes = Math.round(Number(form.get("minutes")));
  const what = String(form.get("what") ?? "").trim().slice(0, 200);
  const day = String(form.get("day") ?? "").trim();
  if (!Number.isInteger(clientId) || clientId <= 0) return;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return;
  if (!what) return;

  await inqPool().query(HOURS_DDL);
  await inqPool().query(
    `insert into geo.client_hours (client_id, day, minutes, what)
     values ($1, coalesce($2::date, (now() at time zone 'Asia/Seoul')::date), $3, $4)`,
    [clientId, /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null, minutes, what]);
  revalidatePath("/admin/pilots");
}
