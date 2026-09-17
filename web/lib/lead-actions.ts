"use server";

import { revalidatePath } from "next/cache";
import { setLeadStatus } from "./leads";

export async function changeLeadStatus(form: FormData) {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id) return;
  await setLeadStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/admin/ops");
}
