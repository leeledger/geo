"use server";

import { revalidatePath } from "next/cache";
import { inqPool } from "./inquiries";

const tri = (v: FormDataEntryValue | null) => v === "yes" ? true : v === "no" ? false : null;

export async function updateOutreach(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const status = String(form.get("status") ?? "확인 전");
  const contacted = ["조건 충족", "제안 발송", "결제", "제외"].includes(status);
  await inqPool().query(`
    update geo.outreach_targets set
      owner_consults=$2, monthly_inquiries_5plus=$3, single_location=$4,
      status=$5, next_action=$6, next_due=nullif($7,'')::date, note=$8,
      contacted_at=case when $9 and contacted_at is null then now() else contacted_at end,
      updated_at=now()
    where id=$1`, [
      id, tri(form.get("owner")), tri(form.get("volume")), tri(form.get("single")), status,
      String(form.get("next") ?? "").slice(0, 200), String(form.get("due") ?? ""),
      String(form.get("note") ?? "").slice(0, 500), contacted,
    ]);
  revalidatePath("/admin/outreach");
  revalidatePath("/admin/ops");
}
