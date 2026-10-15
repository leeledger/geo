/**
 * 홈페이지가 없는 사장님의 진단 — 블로그·SNS·플레이스 주소를 받아 그 플랫폼의 봇 규칙을 그 자리에서 읽는다.
 *
 * 플랫폼마다 규칙이 다르고 수시로 바뀐다. 그래서 여기엔 호스트 → 이름만 적고, 봇 정책은 한 줄도 적지 않는다(D153).
 * 점수를 매기지 않는다 — 플랫폼 규칙은 사장님이 바꿀 수 있는 게 아니다(D160).
 * 브라우저 흉내를 내지 않는다. 429 를 받으면 「확인하지 못했습니다」로 끝낸다(D157).
 */

import { BOTS, UA, stripTags } from "./scan";
import { robotsState, verdict } from "./robots";
import { josa } from "./no-site";

/** 봇 id → 사장님이 알아듣는 이름 */
export const BOT_PLAIN: Record<string, string> = {
  "OAI-SearchBot": "ChatGPT 검색",
  "ChatGPT-User": "ChatGPT(손님이 주소를 줄 때)",
  "PerplexityBot": "Perplexity 검색",
  "Perplexity-User": "Perplexity(손님이 주소를 줄 때)",
  "ClaudeBot": "Claude",
  "Googlebot": "구글 검색",
  "Bingbot": "빙·Copilot 검색",
  "Yeti": "네이버 검색",
  "GPTBot": "ChatGPT 학습",
  "Google-Extended": "Gemini 학습",
  "CCBot": "공개 웹 수집(Common Crawl)",
};

type PlatformDef = { id: string; name: string; hosts: string[] | RegExp; self: string | null };

/** 호스트 → 이름. 봇 정책은 적지 않는다 */
export const PLATFORMS: PlatformDef[] = [
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

const SMARTPLACE = ["smartplace.naver.com", "new.smartplace.naver.com"];

const ERR_ADDR = "주소를 다시 확인해 주세요. (예: blog.naver.com/아이디)";
const ERR_SMARTPLACE = "스마트플레이스 관리 화면 주소입니다. 네이버 지도에서 우리 가게를 열고 공유 주소를 넣어 주세요.";
const ERR_ROOT = "블로그·계정 주소 전체를 넣어 주세요. (예: blog.naver.com/아이디)";

export function platformOf(host: string): PlatformDef | null {
  const h = host.toLowerCase();
  return PLATFORMS.find((p) => (Array.isArray(p.hosts) ? p.hosts.includes(h) : p.hosts.test(h))) ?? null;
}

export type Target =
  | { kind: "error"; msg: string }
  | { kind: "site" }
  | { kind: "platform"; id: string; url: string };

/** 입력 하나를 세 길로 가른다. 플랫폼은 호스트 정확 일치(tistory 만 정규식) */
export function classifyTarget(raw: string): Target {
  const t = (raw || "").trim();
  if (!t) return { kind: "error", msg: ERR_ADDR };
  const scheme = t.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme && !/^https?$/i.test(scheme[1])) return { kind: "error", msg: ERR_ADDR };
  let u: URL;
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

export type Fetched = { ok: boolean; status: number; url: string; body: string };

const MAX_HOPS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;

/** 본문을 2MB 까지만 읽는다 */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  while (n < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(n, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, all.length - off));
    all.set(part, off);
    off += part.length;
    if (off >= all.length) break;
  }
  return new TextDecoder().decode(all);
}

/**
 * 허용한 플랫폼 호스트만 연다. https 만, 리다이렉트는 손으로 3홉까지, 홉마다 다음 호스트가 허용 목록인지 본다.
 * 8초 · 쿠키·인증 없음 · 본문 2MB. 실패는 status 0 또는 받은 상태로 돌려준다(던지지 않는다).
 */
export async function safeFetch(url: string, fetchImpl: typeof fetch = fetch): Promise<Fetched> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let cur = url;
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const u = new URL(cur);
      if (u.protocol !== "https:" || u.port || u.username || u.password || !platformOf(u.hostname)) {
        return { ok: false, status: 0, url: cur, body: "" };
      }
      const res = await fetchImpl(u.href, {
        headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9,en;q=0.8" },
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!loc || hop === MAX_HOPS) return { ok: false, status: res.status, url: cur, body: "" };
        cur = new URL(loc, u).href;
        continue;
      }
      const body = await readCapped(res);
      return { ok: res.ok, status: res.status, url: cur, body: res.ok ? body : "" };
    }
  } catch {
    return { ok: false, status: 0, url: cur, body: "" };
  }
  return { ok: false, status: 0, url: cur, body: "" };
}

export type BotVerdict = { id: string; plain: string; allowed: boolean | null; self: boolean; group: "own" | "*" | "none" | null; rule: string | null };
export type HostResult = { host: string; label: "PC 주소" | "모바일 주소" | null; robots: "ok" | "none" | "fail"; status: number; bots: BotVerdict[] };
export type PageResult = { fetched: boolean; status: number; title: string | null; description: string | null; textLen: number | null; iframe: boolean };
export type PlatformResult = {
  kind: "platform";
  platform: { id: string; name: string };
  url: string;
  checkedAt: string;
  hosts: HostResult[];
  page: PageResult;
  lines: string[];
};

/** 받은 규칙 파일 하나로 봇마다 판정한다. 순수 함수 */
export function judgeHost(host: string, label: HostResult["label"], status: number, body: string, path: string, selfBot: string | null): HostResult {
  const st = robotsState(status, body);
  const bots = BOTS.map((b): BotVerdict => {
    const self = b.id === selfBot;
    const plain = BOT_PLAIN[b.id] ?? b.id;
    if (st.robots === "fail") return { id: b.id, plain, allowed: null, self, group: null, rule: null };
    if (st.robots === "none") return { id: b.id, plain, allowed: true, self, group: "none", rule: null };
    const v = verdict(st.groups!, b.id, path);
    return { id: b.id, plain, allowed: v.allowed, self, group: v.group, rule: v.rule };
  });
  return { host, label, robots: st.robots, status, bots };
}

const decode = (s: string) =>
  s.replace(/&quot;/g, "\"").replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").trim();

function metaContent(html: string, attr: "name" | "property", key: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const k = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    if (k?.toLowerCase() !== key) continue;
    const c = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
    const v = decode(c?.[1] ?? c?.[2] ?? "");
    if (v) return v;
  }
  return null;
}

export function readPage(f: Fetched): PageResult {
  if (!f.ok) return { fetched: false, status: f.status, title: null, description: null, textLen: null, iframe: false };
  const html = f.body;
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null;
  const description = metaContent(html, "name", "description") ?? metaContent(html, "property", "og:description");
  const textLen = stripTags(html).length;
  return { fetched: true, status: f.status, title, description, textLen, iframe: /<iframe\b/i.test(html) && textLen < 600 };
}

/** 화면에 그대로 찍을 문장. 실측에서 나온 것만(D158) */
export function buildLines(name: string, hosts: HostResult[], page: PageResult): string[] {
  const lines: string[] = [];
  const checked = hosts.filter((h) => h.robots !== "fail");
  const ids = BOTS.map((b) => b.id);
  const isSelf = (id: string) => hosts.some((h) => h.bots.find((b) => b.id === id)?.self);
  const blocked = ids.filter((id) => !isSelf(id) && checked.some((h) => h.bots.find((b) => b.id === id)?.allowed === false));
  if (blocked.length) {
    lines.push(`${name}${josa(name, "은", "는")} ${blocked.map((id) => BOT_PLAIN[id] ?? id).join(" · ")} 봇을 막아 두었습니다. 이 봇들은 이 주소의 글을 읽어 가지 않습니다.`);
  } else if (checked.length) {
    const n = ids.filter((id) => !isSelf(id) && checked.some((h) => h.bots.find((b) => b.id === id)?.allowed !== null)).length;
    lines.push(`${name}${josa(name, "은", "는")} 확인한 AI·검색 봇 ${n}개를 막지 않습니다.`);
  }
  if (checked.length === 2 && ids.some((id) => !isSelf(id) && checked[0].bots.find((b) => b.id === id)?.allowed !== checked[1].bots.find((b) => b.id === id)?.allowed)) {
    lines.push("PC 주소와 모바일 주소의 규칙이 다릅니다.");
  }
  for (const h of hosts) {
    if (h.robots === "fail") lines.push(`${h.host}의 봇 규칙을 확인하지 못했습니다. 잠시 뒤 다시 눌러 주세요.`);
    else if (h.robots === "none") lines.push(`${h.host}에는 봇 규칙 파일이 없습니다. 모든 봇이 들어올 수 있습니다.`);
  }
  if (!page.fetched) {
    lines.push(`이 주소를 열어 보지 못했습니다. (응답 ${page.status || "없음"})`);
  } else if (page.iframe) {
    lines.push(`글 본문이 안쪽 틀(iframe)로 따로 열립니다. 이 주소의 첫 화면에는 글자가 ${page.textLen}자뿐입니다.`);
  } else {
    lines.push(`사이티드가 받아 본 첫 화면에 글자가 ${page.textLen}자 있습니다.`);
    if (!page.title) lines.push("제목이 없습니다.");
    if (!page.description) lines.push("소개 문구(description)가 없습니다.");
  }
  lines.push(`이 규칙은 ${name}${josa(name, "이", "가")} 정합니다. 사장님이 바꿀 수 있는 설정이 아닙니다.`);
  return lines;
}

/** 플랫폼 주소 하나를 그 자리에서 확인한다. 외부 요청: 페이지 ≤3홉 + 규칙 파일 ≤2 */
export async function checkPlatform(id: string, url: string, fetchImpl: typeof fetch = fetch): Promise<PlatformResult> {
  const checkedAt = new Date().toISOString();
  const pageRes = await safeFetch(url, fetchImpl);

  let def = PLATFORMS.find((p) => p.id === id)!;
  let target = url;
  // 짧은 주소는 리다이렉트 끝이 실제 대상이다. 끝 호스트로 다시 가른다
  if (def.id === "naver_short") {
    const end = pageRes.ok ? classifyTarget(pageRes.url) : null;
    const endDef = end?.kind === "platform" ? PLATFORMS.find((p) => p.id === end.id) : null;
    if (!end || end.kind !== "platform" || !endDef || endDef.id === "naver_short") {
      const page = readPage({ ...pageRes, ok: false });
      return {
        kind: "platform", platform: { id: def.id, name: def.name }, url, checkedAt, hosts: [], page,
        lines: [`이 주소를 열어 보지 못했습니다. (응답 ${page.status || "없음"})`],
      };
    }
    def = endDef;
    target = end.url;
  }

  const u = new URL(target);
  const path = u.pathname + u.search;
  const pairs: [string, HostResult["label"]][] = def.id === "naver_blog"
    ? [["blog.naver.com", "PC 주소"], ["m.blog.naver.com", "모바일 주소"]]
    : [[u.hostname, null]];
  const hosts = await Promise.all(pairs.map(async ([host, label]) => {
    const r = await safeFetch(`https://${host}/robots.txt`, fetchImpl);
    return judgeHost(host, label, r.status, r.body, path, def.self);
  }));
  const page = readPage(pageRes);
  return {
    kind: "platform", platform: { id: def.id, name: def.name }, url: target, checkedAt, hosts, page,
    lines: buildLines(def.name, hosts, page),
  };
}
