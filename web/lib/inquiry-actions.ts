"use server";

import { revalidatePath } from "next/cache";
import { inqPool } from "./inquiries";

import { isAdmin } from "./admin-auth";
import { 가리기 } from "./materials";

/** 서버 동작은 동작 번호만 알면 누구나 부를 수 있다. 화면이 관리자 전용이어도 동작 자체를 막아야 한다(2026-09-23 발견) */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}


/**
 * 폼에서 부르는 동작만 여기 둔다.
 *
 * "use server" 를 붙인 모듈은 내보내는 것이 전부 async 함수여야 한다.
 * 상수나 타입을 같이 내보내면 빌드가 "Failed to collect configuration" 으로 죽는다.
 * 한 파일에 다 두었다가 그렇게 깨졌다. 읽기와 상수는 inquiries.ts 에 있다.
 */

export async function addInquiry(form: FormData) {await guard();
  const src = String(form.get("source") ?? "").trim();
  if (!src) return;

  const said = String(form.get("said") ?? "").slice(0, 300);
  const grade = String(form.get("grade") ?? "");
  const day = String(form.get("day") ?? "") || null;
  const clientId = Number(form.get("client_id") ?? 1);

  const { rows } = await inqPool().query(
    `insert into academy.inquiries (day, source, said, channel, grade, enrolled, note, client_id)
     values (coalesce($1::date, current_date), $2, $3, $4, $5, $6, $7, $8) returning id, day`,
    [
      day,
      src,
      said,
      String(form.get("channel") ?? "전화"),
      grade,
      form.get("enrolled") === "yes" ? true : form.get("enrolled") === "no" ? false : null,
      String(form.get("note") ?? "").slice(0, 300),
      clientId,
    ],
  );

  /**
   * 상담에서 들은 말은 초안 재료이기도 하다. 원장이 같은 말을 두 곳에 치게 두지 않는다.
   * inquiries 자체를 재료 표로 쓰지는 않는다 — 거기는 유입 경로에서 등록 전환을 재는 표라
   * 수업 장면·아이 말을 넣으면 가짜 source 행이 생겨 전환율 지표가 망가진다.
   * 재료가 안 들어가도 문의 기록은 남아야 하므로 실패해도 삼킨다.
   */
  const r = rows[0];
  if (r && said.trim()) {
    const 값 = 가리기(said.trim());
    const ctx = 가리기(grade);
    await inqPool().query(
      `insert into academy.materials (client_id, day, kind, said, context, origin, inquiry_id)
       values ($1, $2, '상담', $3, $4, 'inquiry', $5)`,
      [clientId, r.day, 값.값.slice(0, 400), ctx.값.slice(0, 120), r.id],
    ).catch((e) => console.error("재료로 옮기기 실패", e));
    revalidatePath("/admin/material");
  }

  revalidatePath("/admin/inquiry");
  revalidatePath("/admin/ops");
}

export async function markEnrolled(id: string, yes: boolean) {await guard();
  await inqPool().query(`update academy.inquiries set enrolled = $2 where id = $1`, [id, yes]);
  revalidatePath("/admin/inquiry");
  revalidatePath("/admin/ops");
}

/** 결과가 비어 있는 상담을 업무로 남겨 두고, 확인한 순간 바로 닫는다. */
export async function resolveInquiry(form: FormData) {await guard();
  const id = String(form.get("id") ?? "");
  const result = String(form.get("result") ?? "");
  if (!id || !["yes", "no"].includes(result)) return;
  await inqPool().query(`update academy.inquiries set enrolled = $2 where id = $1`, [id, result === "yes"]);
  revalidatePath("/admin/inquiry");
  revalidatePath("/admin/ops");
}
