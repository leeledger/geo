"use server";

import { revalidatePath } from "next/cache";
import { inqPool } from "./inquiries";

/**
 * 폼에서 부르는 동작만 여기 둔다.
 *
 * "use server" 를 붙인 모듈은 내보내는 것이 전부 async 함수여야 한다.
 * 상수나 타입을 같이 내보내면 빌드가 "Failed to collect configuration" 으로 죽는다.
 * 한 파일에 다 두었다가 그렇게 깨졌다. 읽기와 상수는 inquiries.ts 에 있다.
 */

export async function addInquiry(form: FormData) {
  const src = String(form.get("source") ?? "").trim();
  if (!src) return;

  await inqPool().query(
    `insert into academy.inquiries (day, source, said, channel, grade, enrolled, note, client_id)
     values (coalesce($1::date, current_date), $2, $3, $4, $5, $6, $7, $8)`,
    [
      String(form.get("day") ?? "") || null,
      src,
      String(form.get("said") ?? "").slice(0, 300),
      String(form.get("channel") ?? "전화"),
      String(form.get("grade") ?? ""),
      form.get("enrolled") === "yes" ? true : form.get("enrolled") === "no" ? false : null,
      String(form.get("note") ?? "").slice(0, 300),
      Number(form.get("client_id") ?? 1),
    ],
  );
  revalidatePath("/admin/inquiry");
  revalidatePath("/admin/ops");
}

export async function markEnrolled(id: string, yes: boolean) {
  await inqPool().query(`update academy.inquiries set enrolled = $2 where id = $1`, [id, yes]);
  revalidatePath("/admin/inquiry");
  revalidatePath("/admin/ops");
}

/** 결과가 비어 있는 상담을 업무로 남겨 두고, 확인한 순간 바로 닫는다. */
export async function resolveInquiry(form: FormData) {
  const id = String(form.get("id") ?? "");
  const result = String(form.get("result") ?? "");
  if (!id || !["yes", "no"].includes(result)) return;
  await inqPool().query(`update academy.inquiries set enrolled = $2 where id = $1`, [id, result === "yes"]);
  revalidatePath("/admin/inquiry");
  revalidatePath("/admin/ops");
}
