import { NextResponse } from "next/server";
import { isAdmin, cookieValue, COOKIE_NAME, COOKIE_MAX_AGE, safeAdminPath } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 옛 열쇠(?key=) 주소를 로그인 쿠키로 바꿔 주는 입구.
 *
 * 즐겨찾기한 /admin/inquiry?key=… 로 들어오면 화면은 열리는데, 폼의 서버 동작은 쿠키로만 관리자를 가려
 * 저장 버튼이 막혔다(KG-8b). 2026-09-23 서버 동작 전부에 관리자 검사를 넣으면서 이 구멍이 모든 화면으로 번질 뻔했다.
 * 열쇠가 맞으면 쿠키를 심고, 주소에서 열쇠를 뺀 화면으로 돌려보낸다 — 열쇠가 기록·공유 화면에 남지 않게.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  // 돌려보낼 곳은 관리 화면 안쪽만 (login·signIn 과 같은 검사)
  const safeTo = safeAdminPath(url.searchParams.get("to"));

  if (!key || !(await isAdmin(key))) {
    return NextResponse.redirect(new URL(`/admin/login?to=${encodeURIComponent(safeTo)}`, url.origin));
  }
  const res = NextResponse.redirect(new URL(safeTo, url.origin));
  res.cookies.set(COOKIE_NAME, cookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
