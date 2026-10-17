/**
 * 플랫폼 호스트 목록 하나(Step 55a D235) — platform-check.ts(공개 진단)·client-core.mjs(고객 체크리스트)·auto-setup-core.mjs·academy 가 같이 쓴다.
 * platform-check.ts 에서 옮겨 왔다(바깥 모양 그대로 다시 내보낸다). 봇 정책은 한 줄도 적지 않는다(D153).
 *
 * 플랫폼 = 남의 서비스 위 계정(블로그·플레이스·SNS). 고객이 손댈 사이트가 아니다.
 * 빌더 = 하위도메인이 고객 몫인 사이트 빌더(Wix·아임웹). 고객 사이트지만 파일을 직접 못 올린다.
 * 종료 = 서비스가 끝난 빌더(네이버 modoo! 2025-06-26 종료 — 모든 하위도메인이 종료 안내로 200). 홈페이지 없음과 같다(D237).
 */

/** 호스트 → 이름. 봇 정책은 적지 않는다 */
export const PLATFORMS = [
  { id: "naver_blog", name: "네이버 블로그", hosts: ["blog.naver.com", "m.blog.naver.com"], self: "Yeti" },
  { id: "naver_place", name: "네이버 플레이스", hosts: ["m.place.naver.com", "pcmap.place.naver.com", "map.naver.com"], self: "Yeti" },
  { id: "naver_store", name: "네이버 스마트스토어", hosts: ["smartstore.naver.com", "m.smartstore.naver.com"], self: "Yeti" },
  { id: "tistory", name: "티스토리", hosts: /^[a-z0-9-]+\.tistory\.com$/, self: null },
  { id: "instagram", name: "인스타그램", hosts: ["instagram.com", "www.instagram.com"], self: null },
  { id: "kakao_channel", name: "카카오톡 채널", hosts: ["pf.kakao.com"], self: null },
  { id: "kakao_place", name: "카카오맵 장소", hosts: ["place.map.kakao.com"], self: null },
  { id: "brunch", name: "브런치", hosts: ["brunch.co.kr"], self: null },
  { id: "youtube", name: "유튜브", hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"], self: null },
  { id: "naver_short", name: "네이버 짧은 주소", hosts: ["naver.me"], self: null },
];

export const SMARTPLACE = ["smartplace.naver.com", "new.smartplace.naver.com"];

/** 하위도메인이 고객 몫인 빌더. 호스트 정규식 → 이름 */
export const BUILDER_HOSTS = [
  { id: "wix", name: "Wix", hosts: /^[a-z0-9-]+\.wixsite\.com$/ },
  { id: "imweb", name: "아임웹", hosts: /^[a-z0-9-]+\.imweb\.me$/ },
];

/** 서비스가 끝난 빌더 — 홈페이지 없음으로 본다(D237) */
export const ENDED_HOSTS = [
  { id: "modoo", name: "네이버 modoo!", ended: "2025-06-26", hosts: /^([a-z0-9-]+\.)?modoo\.at$/ },
];

const ERR_ADDR = "주소를 다시 확인해 주세요. (예: blog.naver.com/아이디)";
const ERR_SMARTPLACE = "스마트플레이스 관리 화면 주소입니다. 네이버 지도에서 우리 가게를 열고 공유 주소를 넣어 주세요.";
const ERR_ROOT = "블로그·계정 주소 전체를 넣어 주세요. (예: blog.naver.com/아이디)";

export function platformOf(host) {
  const h = String(host ?? "").toLowerCase();
  return PLATFORMS.find((p) => (Array.isArray(p.hosts) ? p.hosts.includes(h) : p.hosts.test(h))) ?? null;
}

export function builderOf(host) {
  const h = String(host ?? "").toLowerCase();
  return BUILDER_HOSTS.find((b) => b.hosts.test(h)) ?? null;
}

export function endedOf(host) {
  const h = String(host ?? "").toLowerCase();
  return ENDED_HOSTS.find((b) => b.hosts.test(h)) ?? null;
}

/** 호스트 → "플랫폼" | "빌더" | "사이트" | "없음"(끝난 빌더, D237) */
export function 호스트갈래(host) {
  if (endedOf(host)) return "없음";
  if (platformOf(host)) return "플랫폼";
  if (builderOf(host)) return "빌더";
  return "사이트";
}

/** 입력 하나를 세 길로 가른다. 플랫폼은 호스트 정확 일치(tistory 만 정규식) */
export function classifyTarget(raw) {
  const t = (raw || "").trim();
  if (!t) return { kind: "error", msg: ERR_ADDR };
  const scheme = t.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme && !/^https?$/i.test(scheme[1])) return { kind: "error", msg: ERR_ADDR };
  let u;
  try { u = new URL(scheme ? t : `https://${t}`); } catch { return { kind: "error", msg: ERR_ADDR }; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return { kind: "error", msg: ERR_ADDR };
  const host = u.hostname.toLowerCase();
  if (SMARTPLACE.includes(host)) return { kind: "error", msg: ERR_SMARTPLACE };
  const p = platformOf(host);
  if (!p) return { kind: "site" };
  if (u.port) return { kind: "error", msg: ERR_ADDR };
  if ((u.pathname === "/" || !u.pathname) && p.id !== "tistory" && p.id !== "naver_short") return { kind: "error", msg: ERR_ROOT };
  // 사용자 이름·비밀번호·# 은 버리고 https 로만 연다
  return { kind: "platform", id: p.id, url: `https://${host}${u.pathname}${u.search}` };
}
