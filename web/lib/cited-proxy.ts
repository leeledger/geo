/**
 * cited.kr 자기 기록 — 이 요청을 어디로 보낼지 (Step 51 D164·D166).
 *
 * import 가 없어야 한다(proxy 와 node --experimental-strip-types 시험 둘 다에서 돈다).
 * 쿠키 이름 cited_admin 은 lib/admin-auth.ts COOKIE 와 같은 글자 — admin-auth 는 next/headers 를
 * 불러 proxy 에서 못 쓴다. scripts/check-proxy.mjs 가 두 글자가 같은지 본다.
 *
 * "crawl" = AI·검색 봇 → /api/crawl · "visit" = 사람일 수 있음 → readVisit 가 문서 요청인지 다시 거른다
 */
export type Route = "crawl" | "visit" | null;

const ADMIN_COOKIE = "cited_admin";

export function decide(o: { pathname: string; cookie: string | null; hasKey: boolean; isBot: boolean }): Route {
  if (!o.hasKey) return null;
  if (/^\/(api|admin)(\/|$)/.test(o.pathname)) return null;
  if (o.isBot) return "crawl";
  if ((o.cookie ?? "").split(";").some((c) => c.trim().startsWith(ADMIN_COOKIE + "="))) return null;
  return "visit";
}
