"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { CODE_SLUGS } from "./client-core.mjs";
import { onboard입력검사 } from "./onboard-core.mjs";

/**
 * 계약 뒤 순서의 「상황 바꾸기」(Step 54c). config.onboard 한 키만 jsonb_set 한 문장으로 합친다(D209) — 다른 config 키는 안 건드린다.
 * 서버 동작은 동작 번호만 알면 누구나 부를 수 있다 — 여기서 관리자를 다시 본다(client-actions 와 같은 guard)
 */
export async function saveOnboard(form: FormData) {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
  const slug = String(form.get("slug") ?? "");
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || CODE_SLUGS.includes(slug)) redirect("/admin/clients");
  const here = `/admin/clients/${slug}/onboard`;
  const 값 = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const r = onboard입력검사(값);
  if (!r.ok) redirect(`${here}?err=onboard#situation`);
  await inqPool().query(
    `update geo.clients set config = jsonb_set(config, '{onboard}', coalesce(config->'onboard', '{}'::jsonb) || $2::jsonb) where slug = $1`,
    [slug, JSON.stringify(r.칸)]);
  revalidatePath(here);
  redirect(`${here}?saved=1`);
}
