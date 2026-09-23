"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { KINDS, 가리기 } from "./materials";

/**
 * 초안 재료 넣기.
 *
 * 서버 동작은 동작 번호만 알면 누구나 부를 수 있다. 화면이 관리자 전용이어도 동작 자체를 막아야 한다
 * (14b 에서 문의·리드 동작 11개가 인증 없이 열려 있었다 — 되풀이 금지).
 *
 * 개인정보는 가린 뒤 저장한다. 되돌려 보내지 않는다 — 30초 안에 끝나야 하는 입력이라
 * 한 번 반려당하면 다음부터 안 적는다. 무엇을 가렸는지는 저장 뒤 한 줄로 알린다.
 * 가리는 규칙과 순수 함수는 materials.ts 에 있다 ("use server" 모듈은 async 만 내보낼 수 있다).
 */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}

export async function addMaterial(form: FormData) {
  await guard();

  const said = 가리기(String(form.get("said") ?? "").trim().slice(0, 400));
  if (!said.값) return;
  const context = 가리기(String(form.get("context") ?? "").trim().slice(0, 120));

  const wanted = String(form.get("kind") ?? "상담");
  const kind = (KINDS as readonly string[]).includes(wanted) ? wanted : "상담";
  const day = String(form.get("day") ?? "").trim();

  await inqPool().query(
    `insert into academy.materials (client_id, day, kind, said, context, origin)
     values ($1, coalesce($2::date, (now() at time zone 'Asia/Seoul')::date), $3, $4, $5, 'owner')`,
    [Number(form.get("client_id") ?? 1) || 1, day || null, kind, said.값, context.값],
  );

  revalidatePath("/admin/material");
  revalidatePath("/admin/ops");

  const 가린것 = [...new Set([...said.가린것, ...context.가린것])];
  redirect(가린것.length ? `/admin/material?m=${encodeURIComponent(가린것.join(","))}` : "/admin/material?ok=1");
}
