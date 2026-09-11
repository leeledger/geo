"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "./admin-auth";
import { saveCutoff } from "./brief";

/**
 * 마감 시각 바꾸기. 폼에서만 부른다.
 * "use server" 모듈은 async 함수만 내보내야 한다 — 읽기는 brief.ts 에 있다.
 */
export async function setCutoff(form: FormData) {
  if (!(await isAdmin())) return;
  const v = String(form.get("cutoff") ?? "").trim().slice(0, 5);
  try {
    await saveCutoff(v);
  } catch {
    return;
  }
  revalidatePath("/admin/ops");
}
