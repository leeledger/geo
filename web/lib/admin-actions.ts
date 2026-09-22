"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { credentialsOk, cookieValue, COOKIE_NAME, COOKIE_MAX_AGE, safeAdminPath } from "./admin-auth";

/**
 * 로그인·로그아웃.
 *
 * "use server" 를 붙인 파일은 내보내는 것이 전부 async 함수여야 한다.
 * 상수나 타입을 같이 두면 빌드가 깨진다 — 한 번 당했다.
 * 그래서 판정 로직은 admin-auth.ts 에 두고 여기는 동작만 둔다.
 */

export async function signIn(prev: string | null, form: FormData): Promise<string | null> {
  const id = String(form.get("id") ?? "");
  const pw = String(form.get("pw") ?? "");

  if (!credentialsOk(id, pw)) {
    // 무차별 대입을 조금이라도 성가시게 만든다
    await new Promise((r) => setTimeout(r, 700));
    return "아이디나 비밀번호가 맞지 않습니다.";
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, cookieValue(), {
    httpOnly: true,          // 스크립트가 못 읽는다
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect(safeAdminPath(String(form.get("to") ?? "")));
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/admin/login");
}
