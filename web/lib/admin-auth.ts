import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * 관리자 인증.
 *
 * 앞선 판은 `/admin?key=토큰` 이었다. 그러면 토큰이 주소창에 그대로 남는다 —
 * 방문 기록, 스크린샷, 바깥 링크를 눌렀을 때의 리퍼러까지. 화면을 남에게
 * 보여줄 일이 있는 관리 화면에서 이건 곤란하다.
 *
 * 지금은 아이디·비밀번호로 들어가고 쿠키를 남긴다. 쿠키에는 비밀번호가 아니라
 * 비밀번호로 서명한 값만 들어간다. 쿠키가 새도 비밀번호 자체는 안 샌다.
 *
 * 환경변수
 *   ADMIN_ID        아이디 (안 정하면 "admin")
 *   ADMIN_PASSWORD  비밀번호 (없으면 ADMIN_TOKEN 을 쓴다 — 기존 값을 그대로 살린다)
 */

const COOKIE = "cited_admin";
const MAX_AGE = 60 * 60 * 12; // 12시간. 하루 일과보다 조금 길게.

const adminId = () => process.env.ADMIN_ID || "admin";
const secret = () => process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "";

/** 쿠키에 넣을 값. 비밀번호로 아이디를 서명한다. */
function sign(id: string) {
  return crypto.createHmac("sha256", secret()).update(id).digest("hex");
}

/** 길이가 달라도 던지지 않는 비교. 타이밍으로 새는 걸 막는다. */
function same(a: string, b: string) {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

export function credentialsOk(id: string, pw: string) {
  const s = secret();
  if (!s) return false;                    // 설정 전에는 아무도 못 들어온다
  return same(id, adminId()) && same(pw, s);
}

export function cookieValue() {
  return sign(adminId());
}

/**
 * 지금 들어온 사람이 관리자인가.
 *
 * `key` 는 주소에 붙은 옛 토큰이다. 아직 받아 준다 — 북마크와 스크립트가
 * 그걸 쓰고 있어서, 끊으면 그것들이 한꺼번에 막힌다. 다만 화면에서는
 * 더 이상 안내하지 않는다.
 */
export async function isAdmin(key?: string): Promise<boolean> {
  const s = secret();
  if (!s) return true;                     // 로컬 개발 — 토큰 미설정이면 열어 둔다

  const jar = await cookies();
  const c = jar.get(COOKIE)?.value;
  if (c && same(c, sign(adminId()))) return true;

  const legacy = process.env.ADMIN_TOKEN;
  if (legacy && key && same(key, legacy)) return true;

  return false;
}

export const COOKIE_NAME = COOKIE;
export const COOKIE_MAX_AGE = MAX_AGE;
