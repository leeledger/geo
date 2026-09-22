"use server";

import { revalidatePath } from "next/cache";
import { setLeadStatus } from "./leads";

import { isAdmin } from "./admin-auth";

/** 서버 동작은 동작 번호만 알면 누구나 부를 수 있다. 화면이 관리자 전용이어도 동작 자체를 막아야 한다(2026-09-23 발견) */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}


export async function changeLeadStatus(form: FormData) {await guard();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id) return;
  await setLeadStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/admin/ops");
}
