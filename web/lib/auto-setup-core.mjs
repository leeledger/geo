/**
 * 두 칸 등록 뒤 자동 세팅(Step 55d) — 이름과 홈페이지(비워도 됨)만 받아 나머지를 근거가 있는 것만 채운다.
 * 근거가 없으면 「모름」으로 멈추고 원장 몫(체크리스트 「자동 세팅」 줄 → 사람 일감)으로 올린다. 지어낸 값 0(D225·D227).
 *
 * 순수 함수 + q·fetch·lookup 주입. Vercel 은 web/ 만 올라간다 — academy 를 import 하지 않는다.
 * 화면(web/lib/auto-setup-actions.ts)·매시 고리(academy/scripts/company.mjs → 자동이어하기)·시험(test-auto-setup-core.mjs)이 같은 함수.
 *
 * 단계(config.auto.단계.<k>) — 사이트 → 업종지역 → 검색어 → 파일럿 → 질문. 상태 대기 → 도는중(90초 임대) → 됨 | 실패 | 원장.
 * 쓰기는 언제나 그 칸만 jsonb_set(D209) — 다른 config 키는 안 건드린다.
 */
import {
  ld타입, 호스트, 도메인정리, 점검저장, 홈열기, 체크리스트, 사람일감맞추기, 파일럿상태, CODE_SLUGS, 자동단계, 자동단계말, 갈래 as 행갈래,
} from "./client-core.mjs";
import { classifyTarget, 호스트갈래, builderOf } from "./platform-hosts.mjs";
import { 업종표, 업종말, 낱말업종, 낱말들, 업종낱말들, 시도표, 모든시군구, 지역짧게, 이름흔함, 동의어, 지역동, 학원업종, 의도표 } from "./auto-setup-words.mjs";

export { 자동단계, 자동단계말, 지역짧게, 업종표 };
export const 임대초 = 90;
export const 최대시도 = 3;
const 의존 = { 사이트: [], 업종지역: ["사이트"], 검색어: ["업종지역"], 파일럿: ["사이트"], 질문: ["파일럿", "검색어"] };
const 앞 = (s, n = 300) => String(s ?? "").slice(0, n);
const 한글 = /[가-힣]/;

// ─────────────────────────────────────────── 입력나누기
/** 플랫폼 id → config.onboard.channels 칸 */
const 채널칸 = { naver_blog: "blog", tistory: "blog", brunch: "blog", naver_place: "place", kakao_place: "place" };

/**
 * 홈페이지 칸 하나 → { 갈래, domain, 채널?, 원문?, 오류? }.
 *   빈칸 → 없음 · 플랫폼 호스트 → 플랫폼(domain null · 채널 = 그 주소) · 빌더 하위도메인 → 빌더 · 그 밖 → 사이트(domain = 호스트)
 * 경로가 있는 사이트 주소는 domain = 호스트, 원문은 auto.입력.homepage 에 남긴다
 */
export function 입력나누기(_name, homepage) {
  const raw = String(homepage ?? "").trim();
  if (!raw) return { 갈래: "없음", domain: null };
  if (raw.length > 300) return { 오류: "주소가 너무 깁니다(300자까지)" };
  const t = classifyTarget(raw);
  if (t.kind === "platform") return { 갈래: "플랫폼", domain: null, 채널: { 칸: 채널칸[t.id] ?? "sns", id: t.id, url: t.url } };
  if (t.kind === "error" && /스마트플레이스|전체를/.test(t.msg)) return { 오류: t.msg };
  const h = 호스트(raw);
  if (!h.host) return { 오류: h.까닭 };
  if (t.kind === "error") return { 오류: t.msg };
  const 경로 = /^(?:[a-z][a-z0-9+.-]*:\/\/)?[^/?#]+([/?#].*)?$/i.exec(raw)?.[1] ?? "";
  // 끝난 빌더(modoo!)는 홈페이지 없음과 같다 — domain 없이. 친 주소는 auto.입력.homepage 에 남는다(D237)
  if (호스트갈래(h.host) === "없음") return { 갈래: "없음", domain: null, 원문: raw };
  return { 갈래: 호스트갈래(h.host), domain: h.host, ...(경로 && 경로 !== "/" ? { 원문: raw } : {}) };
}

// ─────────────────────────────────────────── slug · 로마자
const 초성 = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const 중성 = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const 종성 = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

/**
 * 이름 → 로마자. 국어의 로마자 표기법 글자 대응만(동화·연음 규칙 없음). ㄹ 받침 뒤 ㄹ 첫소리는 ll.
 * 한글 밖 글자는 영문·숫자만 남기고 나머지는 띄어쓰기로
 */
export function 로마자(이름) {
  let out = "", 앞종 = -1;
  for (const ch of String(이름 ?? "")) {
    const c = ch.codePointAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      const 초 = Math.floor(c / 588), 중 = Math.floor((c % 588) / 28), 종 = c % 28;
      out += (초 === 5 && 앞종 === 8 ? "l" : 초성[초]) + 중성[중] + 종성[종];
      앞종 = 종;
    } else {
      out += /[a-z0-9]/i.test(ch) ? ch.toLowerCase() : " ";
      앞종 = -1;
    }
  }
  return out;
}

const slug꼴 = (s) => String(s ?? "").toLowerCase().replace(/[_.\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "");

/** 플랫폼 주소 → 블로그 아이디·계정(없으면 null) */
function 계정(채널) {
  if (!채널) return null;
  const u = new URL(채널.url);
  if (채널.id === "tistory") return u.hostname.split(".")[0];
  if (!["naver_blog", "instagram", "brunch", "youtube", "kakao_channel"].includes(채널.id)) return null;
  const 첫 = u.pathname.split("/").filter(Boolean)[0] ?? "";
  return 첫.replace(/^[@_]+/, "") || null;
}

/**
 * 관리명(slug) — 사이트·빌더: 호스트 첫 마디 · 플랫폼: 블로그 아이디·계정 · 플레이스·없음: 이름 로마자(D222).
 * 쓰이면 -2, -3… · 코드 slug·new 피함 · ^[a-z0-9-]{1,40}$ · 비면 client
 */
export function slug고르기({ 갈래, domain, 채널, name }, 쓰인 = []) {
  const 쓰임 = new Set([...쓰인, ...CODE_SLUGS, "new"]);
  let 바탕 = "";
  if ((갈래 === "사이트" || 갈래 === "빌더") && domain) 바탕 = slug꼴(domain.split(".")[0]);
  else if (갈래 === "플랫폼") 바탕 = slug꼴(계정(채널) ?? "") || slug꼴(로마자(name));
  else 바탕 = slug꼴(로마자(name));
  if (!바탕) 바탕 = "client";
  if (!쓰임.has(바탕)) return 바탕;
  for (let n = 2; ; n++) {
    const 꼬리 = `-${n}`;
    const s = `${바탕.slice(0, 40 - 꼬리.length).replace(/-$/, "")}${꼬리}`;
    if (!쓰임.has(s)) return s;
  }
}

// ─────────────────────────────────────────── 이름 판별 말 (D223·D224)
/**
 * → { terms, 흔함, 까닭 }. terms = [이름(흔하지 않고 맨 영어 낱말이 아닐 때)] + [도메인(사이트·빌더)].
 * 맨 영어 낱말 = 점 없는 라틴 글자 말(cited 판별 말과 같은 기준). 흔하면 이름을 빼고 도메인만, 도메인도 없으면 terms []
 */
export function 판별말(name, domain) {
  const n = String(name ?? "").trim().replace(/\s+/g, " ");
  const terms = [], 까닭 = [];
  const 흔함 = 이름흔함(n);
  if (!한글.test(n) && !n.includes(".")) 까닭.push(`「${n}」은(는) 맨 영어 낱말이라 판별 말에 넣지 않았습니다`);
  else if (흔함) 까닭.push(`「${n}」은(는) 업종·지역 말을 빼면 남는 글자가 2자 미만이라 남의 답에도 걸립니다`);
  else terms.push(n);
  if (domain) terms.push(domain);
  else if (!terms.length) 까닭.push("도메인도 없어 판별 말이 없습니다");
  return { terms, 흔함, 까닭: 까닭.join(" · ") };
}

// ─────────────────────────────────────────── 사실뽑기 (D225)
const 글자만 = (html) => String(html ?? "")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const 정렬 = (xs) => [...xs].sort((a, b) => b.length - a.length);
const 시도정규식 = 시도표.filter(([, g]) => g.length).map(([이름들, 시군구]) => ({
  시군구,
  re: new RegExp(`(?<![가-힣])(?:${정렬(이름들).join("|")})\\s*(${정렬(시군구).join("|")})(?:\\s+([가-힣]{1,5}구)(?![가-힣]))?`, "g"),
}));

/** 글 → 「시도 시군구」 꼴로 찾은 지역들 [{ 값, 글 }]. 시 아래 일반구가 바로 붙으면 그 구 */
function 본문지역(글) {
  const out = [];
  for (const { re } of 시도정규식) {
    for (const m of String(글).matchAll(re)) {
      const 값 = m[2] && /시$/.test(m[1]) ? m[2] : m[1];
      out.push({ 값, 글: m[0] });
    }
  }
  return out;
}

/** JSON-LD address 하나 → 지역들. 글자면 본문 꼴, 객체면 addressRegion·addressLocality 낱말에서 */
function 주소지역(addr) {
  if (typeof addr === "string") return 본문지역(addr);
  if (!addr || typeof addr !== "object") return [];
  const 글 = [addr.addressRegion, addr.addressLocality].filter((x) => typeof x === "string").join(" ");
  const 본 = 본문지역(글);
  if (본.length) return 본;
  const 말 = 낱말들(글);
  const 시도 = 시도표.find(([이름들]) => 말.some((w) => 이름들.includes(w)));
  const 후보 = 시도 ? 시도[1] : 모든시군구;
  for (let i = 0; i < 말.length; i++) {
    if (!후보.includes(말[i])) continue;
    const 다음 = 말[i + 1];
    return [{ 값: /시$/.test(말[i]) && 다음 && /^[가-힣]{1,5}구$/.test(다음) ? 다음 : 말[i], 글 }];
  }
  return [];
}

/** 홈 HTML 의 ld+json 블록 안 address 전부(@graph·배열·중첩). 깨진 블록은 건너뛴다 */
function ld주소들(html) {
  const out = [];
  const 걷기 = (x) => {
    if (Array.isArray(x)) { x.forEach(걷기); return; }
    if (!x || typeof x !== "object") return;
    for (const [k, v] of Object.entries(x)) {
      if (k === "address") (Array.isArray(v) ? v : [v]).forEach((a) => out.push(a));
      else if (v && typeof v === "object") 걷기(v);
    }
  };
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of String(html ?? "").matchAll(re)) { try { 걷기(JSON.parse(m[1].trim())); } catch { /* 깨진 블록 — 건너뜀 */ } }
  return out;
}

const 하나만 = (xs) => { const s = [...new Set(xs.map((x) => x.값))]; return s.length === 1 ? xs.find((x) => x.값 === s[0]) : null; };

/**
 * 홈 HTML·이름 → { 업종: { 값, 출처 }, 지역: { 값, 출처 } }. 값이 null 이면 출처에 까닭. 홈 본문은 저장하지 않는다.
 *   업종 ① JSON-LD @type 이 업종표에 → ② 이름에 업종표 말 → ③ 홈 title 에 업종표 말이 딱 하나
 *   지역 ① JSON-LD address 의 시군구 → ② 본문 「시도 시군구」가 서로 다른 것 하나. 둘 이상이면 모름(지점 여럿을 하나로 찍지 않는다)
 */
export function 사실뽑기(html, name) {
  const h = String(html ?? "");
  // 업종
  let 업종 = null;
  const ld업종 = [...new Set(ld타입(h).types.flatMap((t) => 업종표.filter((x) => x.ld.includes(t)).map((x) => `${x.업종}|${t}`)))];
  const ld종류 = [...new Set(ld업종.map((x) => x.split("|")[0]))];
  if (ld종류.length === 1) 업종 = { 값: ld종류[0], 출처: `홈페이지에 적힌 업종 정보(${ld업종[0].split("|")[1]})` };
  if (!업종) {
    const 이름업종 = 업종낱말들(name).map(낱말업종).filter(Boolean);
    const 종류 = [...new Set(이름업종.map((x) => x.업종))];
    if (종류.length === 1) 업종 = { 값: 종류[0], 출처: `이름 「${이름업종[0].말}」` };
  }
  if (!업종) {
    const 제목 = 글자만(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] ?? "");
    const 제목업종 = 업종낱말들(제목).map(낱말업종).filter(Boolean);
    const 종류 = [...new Set(제목업종.map((x) => x.업종))];
    if (종류.length === 1) 업종 = { 값: 종류[0], 출처: `홈 제목 「${제목업종[0].말}」` };
    else 업종 = { 값: null, 출처: 종류.length > 1 ? `모름 — 홈페이지 제목에 업종이 ${종류.length}개(${종류.join("·")})라 하나로 못 정했습니다` : "모름 — 홈페이지에서 업종을 못 찾았습니다" };
  }
  // 지역
  let 지역 = null;
  const ld지역 = ld주소들(h).flatMap(주소지역);
  const ld하나 = 하나만(ld지역);
  if (ld하나) 지역 = { 값: ld하나.값, 출처: `홈페이지에 적힌 주소 「${앞(ld하나.글, 40)}」` };
  else if (ld지역.length) 지역 = { 값: null, 출처: `모름 — 홈페이지에 적힌 주소가 ${new Set(ld지역.map((x) => x.값)).size}곳(${[...new Set(ld지역.map((x) => x.값))].join("·")})이라 하나로 못 정했습니다` };
  else {
    const 본 = 본문지역(글자만(h));
    const 본하나 = 하나만(본);
    if (본하나) 지역 = { 값: 본하나.값, 출처: `홈페이지 글 「${앞(본하나.글, 40)}」` };
    else 지역 = { 값: null, 출처: 본.length ? `모름 — 홈페이지 글에 지역이 ${new Set(본.map((x) => x.값)).size}곳(${[...new Set(본.map((x) => x.값))].join("·")})이라 하나로 못 정했습니다` : "모름 — 홈페이지에 주소가 없습니다" };
  }
  return { 업종, 지역 };
}

// ─────────────────────────────────────────── 자동완성 (D227·D228)
export const 자동완성주소 = (q) => `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(q)}&st=100&r_format=json&q_enc=UTF-8&r_enc=UTF-8`;
export const 자동완성UA = "cited-setup/1.0 (+https://cited.kr)";

/** 1차 씨앗 — 「<지역짧게> <업종>」「<지역> <업종>」「<지역짧게> <업종> 추천」(같은 것은 하나) */
export function 씨앗(업종, 지역) {
  const 짧 = 지역짧게(지역);
  return [...new Set([`${짧} ${업종}`, `${지역} ${업종}`, `${짧} ${업종} 추천`])];
}

/** 넓힌 씨앗(D246) — 동의어 「<지역짧게> <동의어>」 · 서울 동 「<동> <업종>」. 고정 표에서만 */
export const 넓힌씨앗 = (업종, 지역) => [...동의어(업종).map((s) => `${지역짧게(지역)} ${s}`), ...지역동(지역).map((d) => `${d} ${업종}`)];

/**
 * 틀 검색어(D246) — 자동완성이 모자랄 때 채우는 검색어형 질문. 지어낸 사실이 아니라 손님이 치는 꼴(지역 × 업종·동의어 × 의도).
 * 순서: 짧은 지역 × 업종 × 의도 → 서울 동 × 업종(·추천) → 짧은 지역 × 동의어(·추천) → 전체 지역 × 업종 × 의도 → 맨 꼴
 */
export function 틀검색어(업종, 지역) {
  const 짧 = 지역짧게(지역);
  const 의도 = [...의도표.공통, ...(학원업종(업종) ? 의도표.학원 : 의도표.그밖)];
  const 꼴 = (곳, 무엇, [말, 자리]) => (자리 === "앞" ? `${곳} ${말} ${무엇}` : `${곳} ${무엇} ${말}`);
  return [...new Set([
    ...의도.map((x) => 꼴(짧, 업종, x)),
    ...지역동(지역).flatMap((d) => [`${d} ${업종}`, `${d} ${업종} 추천`]),
    ...동의어(업종).flatMap((s) => [`${짧} ${s}`, `${짧} ${s} 추천`]),
    ...의도.map((x) => 꼴(지역, 업종, x)),
    `${짧} ${업종}`, `${지역} ${업종}`,
    // 지역이 한 꼴뿐이면(중구 등) 위 두 줄이 겹친다 — 고정 의도 말을 더하고, 그래도 모자랄 몫은 동의어 × 의도(D247)
    ...(짧 === 지역 ? [...의도표.더.map((x) => 꼴(지역, 업종, x)), ...동의어(업종).flatMap((s) => 의도.map((x) => 꼴(지역, s, x)))] : []),
  ])];
}

/** 자동완성 응답 JSON → 말 목록(원응답 순서) */
export function 응답말(json) {
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.flatMap((묶음) => (Array.isArray(묶음) ? 묶음 : []))
    .map((x) => (Array.isArray(x) ? x[0] : x)).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
}

const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 네이버 자동완성. 주소는 호스트 고정(사용자 입력은 q 값에만) · 정직한 UA · 요청당 3초 · 전체 25초 · 요청 사이 200ms · 최대 40번(D246).
 * 403·429 를 받으면 그 뒤 씨앗도 두드리지 않는다(막힌 곳을 다시 두드리지 않는다). 5xx·못 읽음은 그 씨앗만 실패로 적는다.
 * 다음씨앗(1차 결과) 이 있으면 1차 뒤에 2차를 같은 한도 안에서. → { fetched_at, 씨앗: [{ q, 차, status, items, 오류? }] }
 */
export async function 자동완성(씨앗들, { fetch = globalThis.fetch, 다음씨앗 = null, 한도 = 3000, 전체 = 25000, 간격 = 200, 최대 = 40, now = () => new Date() } = {}) {
  const 시작 = Date.now();
  const 결과 = { fetched_at: now().toISOString(), 씨앗: [] };
  let 막힘 = null;
  const 한번 = async (q, 차) => {
    if (막힘) { 결과.씨앗.push({ q, 차, status: null, items: [], 오류: `앞 씨앗이 막혀(${막힘}) 안 두드림` }); return; }
    if (결과.씨앗.filter((x) => x.status !== null || x.오류?.startsWith("시간")).length >= 최대) { 결과.씨앗.push({ q, 차, status: null, items: [], 오류: `최대 ${최대}번` }); return; }
    const 남음 = 전체 - (Date.now() - 시작);
    if (남음 <= 0) { 결과.씨앗.push({ q, 차, status: null, items: [], 오류: "전체 25초를 넘어 안 두드림" }); return; }
    if (결과.씨앗.some((x) => x.status !== null)) await 쉼(간격);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), Math.min(한도, 남음));
    try {
      const r = await fetch(자동완성주소(q), { headers: { "user-agent": 자동완성UA, accept: "application/json" }, redirect: "manual", signal: ac.signal });
      const status = r.status;
      if (status === 403 || status === 429) { 막힘 = status; 결과.씨앗.push({ q, 차, status, items: [] }); return; }
      if (status !== 200) { 결과.씨앗.push({ q, 차, status, items: [] }); return; }
      let items = [];
      try { items = 응답말(JSON.parse(await r.text())); } catch { 결과.씨앗.push({ q, 차, status, items: [], 오류: "응답을 못 읽음" }); return; }
      결과.씨앗.push({ q, 차, status, items });
    } catch (e) {
      결과.씨앗.push({ q, 차, status: null, items: [], 오류: ac.signal.aborted ? "시간 초과(3초)" : `못 열림(${앞(e?.cause?.code ?? e?.message ?? e, 60)})` });
    } finally { clearTimeout(t); }
  };
  for (const q of 씨앗들) await 한번(q, 1);
  if (다음씨앗) {
    const 이미 = new Set(씨앗들);
    for (const q of 다음씨앗(결과.씨앗).filter((x) => !이미.has(x))) await 한번(q, 2);
  }
  return 결과;
}

/** 원응답 → 출처 붙은 후보 [{ text, 씨앗, 순위 }] (원응답 순서) */
export const 출처붙임 = (씨앗들) => 씨앗들.flatMap((s) => (s.items ?? []).map((text, i) => ({ text, 씨앗: s.q, 순위: i + 1 })));

const 빼는말 = ["뜻", "영어로", "채용", "구인", "알바", "면접", "연봉", "월급"];
const 붙임 = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

/**
 * 손님이 칠 말만 — 업종 말(띄어쓰기 무시)이 든 것 · 고객 이름·판별 말 든 것 뺌 · 뜻·영어로·채용·구인·알바·면접·연봉·월급 뺌 ·
 * 띄어쓰기 무시 중복 제거 · 원응답 순서. items 는 글자 또는 { text, … }
 */
export function 거르기(items, { 판별말: 판별 = [], 업종, 이름 = "", 더말 = [] } = {}) {
  const 업 = [...업종말(업종), ...더말].map(붙임);
  const 이름들 = [이름, ...판별].map(붙임).filter((x) => x.length >= 2);
  const 본 = new Set();
  const out = [];
  for (const x of items) {
    const text = typeof x === "string" ? x : x?.text;
    if (typeof text !== "string") continue;
    const k = 붙임(text);
    if (!k || 본.has(k)) continue;
    if (!업.some((w) => k.includes(w))) continue;
    if (이름들.some((w) => k.includes(w))) continue;
    // 띄어쓰기 낱말마다 본다 — 붙인 글자로 보면 「중구 인테리어」가 「구인」에 걸린다(D247)
    if (String(text).toLowerCase().split(/\s+/).some((t) => 빼는말.some((w) => t.includes(w)))) continue;
    본.add(k);
    out.push(x);
  }
  return out;
}

// ─────────────────────────────────────────── 패널만들기
/**
 * keyword 17(자동완성 원문 먼저, 모자라면 틀 — 출처 칸이 「틀」/「자동완성」을 가른다) + brand 3 → [[stage, text, 출처]] 20. seed-panel 패널점검 을 통과하는 모양.
 * brand = 「<이름> 어떤 곳이야?」 · 「<도메인> 뭐 하는 곳이야?」(없으면 「<이름> 어디에 있어?」) · 「<이름>」 — 기존 패널과 같은 꼴(D171)
 */
export function 패널만들기(keyword17, name, domain) {
  const kw = keyword17.slice(0, 17).map((x) => (typeof x === "string"
    ? ["keyword", x, "네이버 자동완성"]
    : x.출처 === "틀" ? ["keyword", x.text, "틀 · 검색어형(지역 × 업종 × 의도)"]
    : ["keyword", x.text, `네이버 자동완성 · 씨앗 ${x.씨앗} · ${x.순위}위`]));
  return [
    ...kw,
    ["brand", `${name} 어떤 곳이야?`, "이름 질문 — 기존 패널과 같은 꼴"],
    ["brand", domain ? `${domain} 뭐 하는 곳이야?` : `${name} 어디에 있어?`, "이름 질문 — 기존 패널과 같은 꼴"],
    ["brand", name, "등록 브랜드 검색어"],
  ];
}

// ─────────────────────────────────────────── 두 칸 → 등록 칸
const KST날 = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/** 새 auto — 단계 전부 대기 */
export function 새auto({ 갈래, 입력, 판별, at }) {
  return {
    v: 1, at, 갈래, 입력,
    흔함: 판별.흔함,
    출처: { 판별말: `자동: ${판별.terms.join(" · ") || "없음"}${판별.까닭 ? ` — ${판별.까닭}` : ""}`, 브랜드: "자동: 이름" },
    단계: Object.fromEntries(자동단계.map((k) => [k, { 상태: "대기", 시도: 0 }])),
  };
}

/**
 * 두 칸(이름·홈페이지) → client-core 등록() 칸. 바깥 요청 없음. → { ok, 칸, 오류[] }
 *   쓰인 = 이미 있는 slug 들(겹치면 -2…). 시험·「그래도 등록」 체크는 그대로 넘긴다
 */
export function 두칸칸(f, 쓰인 = [], now = new Date()) {
  const 오류 = [];
  const name = String(f.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) 오류.push("이름은 2~40자로 넣어 주세요");
  const 갈 = 입력나누기(name, f.homepage);
  if (갈.오류) 오류.push(갈.오류);
  if (오류.length) return { ok: false, 칸: null, 오류 };
  const 판별 = 판별말(name, 갈.domain);
  const slug = slug고르기({ 갈래: 갈.갈래, domain: 갈.domain, 채널: 갈.채널, name }, 쓰인);
  const 켬 = (v) => v === "on" || v === "true" || v === true;
  const channels = 갈.채널 ? { blog: null, place: null, sns: null, [갈.채널.칸]: 갈.채널.url } : undefined;
  return {
    ok: true, 오류,
    칸: {
      name, slug, domain: 갈.domain, answerTerms: 판별.terms, answerExclude: [], compete: [], brand: [name],
      address: null, phone4: null, relation: "외부", test: 켬(f.test), wantGsc: !!갈.domain,
      이름겹침허용: 켬(f.allow_dup),
      ...(channels ? { channels } : {}),
      auto: 새auto({ 갈래: 갈.갈래, 입력: { name, homepage: String(f.homepage ?? "").trim() }, 판별, at: now.toISOString() }),
    },
  };
}

// ─────────────────────────────────────────── 단계 기계
const 지남 = (at, now) => { const t = Date.parse(at ?? ""); return !Number.isFinite(t) || +now - t >= 임대초 * 1000; };

/**
 * 다음에 돌 단계(순수) — 의존이 풀린 첫 단계 중 대기 · 실패(시도<3, 실패도 일 때) · 임대 지난 도는중(시도<3). 없으면 null.
 * 화면 판은 실패를 스스로 다시 돌리지 않는다(실패도 false) — 「다시 시도」나 매시 고리가 잇는다
 */
export function 다음단계(auto, now = new Date(), { 실패도 = true } = {}) {
  if (!auto?.단계) return null;
  for (const k of 자동단계) {
    const s = auto.단계[k] ?? { 상태: "대기" };
    if (s.상태 === "됨" || s.상태 === "원장") continue;
    if (!의존[k].every((d) => auto.단계[d]?.상태 === "됨")) continue;
    if (s.상태 === "대기") return k;
    if (s.상태 === "실패" && 실패도 && (s.시도 ?? 0) < 최대시도) return k;
    if (s.상태 === "도는중" && 지남(s.at, now) && (s.시도 ?? 0) < 최대시도) return k;
  }
  return null;
}

/** 세 번 다 시간 안에 못 끝낸 단계(도는중 · 시도 3 · 임대 지남) — 원장으로 넘길 단계 이름. 없으면 null(순수) */
export function 멈춘단계(auto, now = new Date()) {
  if (!auto?.단계) return null;
  return 자동단계.find((k) => auto.단계[k]?.상태 === "도는중" && (auto.단계[k].시도 ?? 0) >= 최대시도 && 지남(auto.단계[k].at, now)) ?? null;
}

/** 다섯 단계 중 됨 수 · 끝났나 · 원장 단계 */
export function 자동요약(auto) {
  const 단계 = auto?.단계 ?? {};
  const 된 = 자동단계.filter((k) => 단계[k]?.상태 === "됨").length;
  return { 된, 전부: 자동단계.length, 끝: 된 === 자동단계.length, 원장: 자동단계.filter((k) => 단계[k]?.상태 === "원장") };
}

const 행읽기 = async (q, slug) => (await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [slug]))[0]?.r ?? null;

/** config 칸 여럿을 한 문장으로 jsonb_set(D209). 쓰기 = [[경로[], 값], …] */
async function 칸쓰기(q, id, 쓰기) {
  if (!쓰기.length) return;
  const p = [id];
  let e = "config";
  for (const [경로, 값] of 쓰기) { p.push(경로, JSON.stringify(값)); e = `jsonb_set(${e}, $${p.length - 1}::text[], $${p.length}::jsonb)`; }
  await q(`update geo.clients set config = ${e} where id = $1`, p);
}

/**
 * 임대 — 그 단계가 대기·실패(시도<3)이거나 도는중인데 90초 지났을 때만 도는중·at·시도+1. 한 문장(겹친 부름은 한 번만 잡는다).
 * → 잡았으면 true
 */
export async function 임대(q, id, k, at) {
  const rows = await q(`update geo.clients
      set config = jsonb_set(config, $2::text[], coalesce(config #> $2::text[], '{}'::jsonb)
        || jsonb_build_object('상태', '도는중', 'at', $3::text, '시도', coalesce((config #>> ($2::text[] || '{시도}'::text[]))::int, 0) + 1))
    where id = $1 and (
      coalesce(config #>> ($2::text[] || '{상태}'::text[]), '대기') = '대기'
      or (config #>> ($2::text[] || '{상태}'::text[]) = '실패' and coalesce((config #>> ($2::text[] || '{시도}'::text[]))::int, 0) < ${최대시도})
      or (config #>> ($2::text[] || '{상태}'::text[]) = '도는중' and coalesce((config #>> ($2::text[] || '{시도}'::text[]))::int, 0) < ${최대시도}
          and coalesce((config #>> ($2::text[] || '{at}'::text[]))::timestamptz, '-infinity') < $3::timestamptz - interval '${임대초} seconds'))
    returning id`, [id, ["auto", "단계", k], at]);
  return rows.length > 0;
}

/** 단계 말 — 「원장」으로 멈추면 원장 일감 할 일 글이 된다(D255 원장금지말 없음, test-client-copy). 기술 까닭은 오류 칸에만 */
export const 사람말 = {
  홈못엶: () => "홈페이지를 못 열었습니다. 다시 시도합니다",
  넘김: (주소) => `홈페이지 주소가 다른 곳으로 넘어갑니다: ${주소}. 「자세히」에서 맞는 주소로 고칩니다`,
  채널없음: "블로그 주소 전체를 「계약 뒤 순서」 상황 바꾸기 채널 칸에 넣어 주세요",
  모름: (빠짐) => `${빠짐}을 못 찾았습니다. 고객 화면 맨 위 판에 업종·지역 두 칸을 넣으면 이어서 합니다`,
  후보적음: (n) => `질문 후보가 ${n}개뿐입니다(17개 필요). 「자세히」에서 경쟁 검색어를 넣고 다시 시도합니다`,
};

/** 사이트 상태 제안(D226) — 네 칸이 다 확인돼 됨이면 none, 확인된 빠짐이 하나라도 있으면 setup, 못 연 칸만 있으면 정하지 않음(null) */
export function 사이트상태(d) {
  const 칸 = [
    Array.isArray(d.robots?.blocked) ? !d.robots.blocked.length : null,
    d.sitemap?.ok === true ? true : d.sitemap?.ok === false ? false : null,
    d.llmsTxt?.ok === true ? true : d.llmsTxt?.ok === false ? false : null,
    Array.isArray(d.homeLdTypes) ? d.homeLdTypes.length > 0 : null,
  ];
  if (칸.some((x) => x === false)) return "setup";
  if (칸.every((x) => x === true)) return "none";
  return null;
}

/** 단계가 보는 갈래 — 홈페이지가 있으면 그 호스트, 없으면 채널 주소(또는 등록 때 갈래)가 플랫폼인지 */
const 단계갈래 = (row) => (도메인정리(row.domain) ? 행갈래(row) : 첫채널(row.config ?? {}) || row.config?.auto?.갈래 === "플랫폼" ? "플랫폼" : "없음");

/** config.onboard.channels 에서 첫 플랫폼 주소 → { id, url } | null */
function 첫채널(c) {
  const ch = c.onboard?.channels && typeof c.onboard.channels === "object" ? c.onboard.channels : {};
  for (const k of ["blog", "place", "sns"]) {
    const t = ch[k] ? classifyTarget(String(ch[k])) : null;
    if (t?.kind === "platform") return { id: t.id, url: t.url };
  }
  return null;
}

/** needs_build → 사람 말(pilot-plan NEEDS_BUILD_LABEL 과 같은 말) */
const 준비말 = { none: "구축 없음", setup: "기술 세팅", build: "사이트 구축" };

const 원장출처 = (x) => String(x ?? "").startsWith("원장");

const 단계실행 = {
  async 사이트(q, row, deps) {
    const c = row.config, a = c.auto;
    const 갈 = 단계갈래(row);
    const 쓰기 = [];
    const 사실쓰기 = (사실) => { if (!원장출처(a.출처?.업종) && !원장출처(a.출처?.지역)) 쓰기.push([["auto", "사실"], 사실]); };
    if (갈 === "사이트" || 갈 === "빌더") {
      const o = { ...(deps.fetch ? { fetch: deps.fetch } : {}), ...(deps.lookup ? { lookup: deps.lookup } : {}) };
      const [derived, 홈] = await Promise.all([점검저장(q, row, o), 홈열기(row.domain, o)]);
      const h = derived.home ?? {};
      if (!(h.status >= 200 && h.status < 300)) {
        const 넘김 = /다른 주소로 넘어가/.exec(h.error ?? "");
        const 어디 = /\((https?:\/\/[^)]+)\)/.exec(h.error ?? "")?.[1] ?? "";
        return { 상태: "실패", 말: 넘김 ? 사람말.넘김(어디) : 사람말.홈못엶(), 오류: h.error ?? `코드 ${h.status}` };
      }
      const needs = 갈 === "빌더" ? "setup" : 사이트상태(derived);
      if (!needs) return { 상태: "실패", 말: "홈페이지에서 못 연 곳이 있어 상태를 정하지 않았습니다. 다시 엽니다", 오류: derived.errors.join(" / ") };
      const html = 홈.status >= 200 && 홈.status < 300 ? 홈.body ?? "" : "";
      const 플 = deps.detectPlatform && html ? deps.detectPlatform(html, 홈.headers ?? {}, `https://${도메인정리(row.domain)}/`) : null;
      const 빌더 = builderOf(도메인정리(row.domain));
      쓰기.push([["auto", "사이트상태"], needs]);
      쓰기.push([["auto", "플랫폼"], 빌더 ? { id: 빌더.id, name: 빌더.name, kind: "빌더", evidence: "호스트" } : 플 ? { id: 플.id, name: 플.name, kind: 플.kind, evidence: 앞(플.evidence, 120) } : null]);
      사실쓰기(사실뽑기(html, row.name));
      await 칸쓰기(q, row.id, 쓰기);
      const 빠짐 = [["robots", Array.isArray(derived.robots?.blocked) && !derived.robots.blocked.length], ["사이트맵", derived.sitemap?.ok === true],
        ["llms.txt", derived.llmsTxt?.ok === true], ["JSON-LD", (derived.homeLdTypes ?? []).length > 0]].filter(([, ok]) => !ok).map(([k]) => k);
      return { 상태: "됨", 말: needs === "none" ? "홈페이지에 빠진 것이 없습니다 — 제안: 구축 없음" : 갈 === "빌더" ? `${빌더?.name ?? "빌더"} 사이트 — 제안: 기술 세팅` : `홈페이지에 손볼 곳 ${빠짐.length}군데 — 제안: 손보기(무엇인지는 「자세히」 칸별 점검)` };
    }
    if (갈 === "플랫폼") {
      const ch = 첫채널(c);
      if (!ch) return { 상태: "원장", 말: 사람말.채널없음 };
      const r = await deps.checkPlatform(ch.id, ch.url);
      const platform = { checkedAt: r.checkedAt, platform: r.platform, url: r.url, page: { fetched: r.page?.fetched, status: r.page?.status, title: 앞(r.page?.title ?? "", 120) },
        hosts: (r.hosts ?? []).map((x) => ({ host: x.host, robots: x.robots, status: x.status })), lines: r.lines };
      await q(`update geo.clients set derived = jsonb_set(coalesce(derived, '{}'::jsonb), '{platform}', $2::jsonb) where id = $1`, [row.id, JSON.stringify(platform)]);
      쓰기.push([["auto", "사이트상태"], "build"]);
      사실쓰기(사실뽑기("", row.name));
      await 칸쓰기(q, row.id, 쓰기);
      return { 상태: "됨", 말: `홈페이지 없음 — ${r.platform?.name ? `${r.platform.name} 채널` : "채널"}만 봅니다(${r.page?.fetched ? `열림 ${r.page.status}` : `못 엶 ${r.page?.status || "응답 없음"}`}) · 제안: 사이트 구축` };
    }
    쓰기.push([["auto", "사이트상태"], "build"]);
    사실쓰기(사실뽑기("", row.name));
    await 칸쓰기(q, row.id, 쓰기);
    return { 상태: "됨", 말: "홈페이지 없음 — 제안: 사이트 구축" };
  },

  async 업종지역(_q, row) {
    const 사실 = row.config.auto.사실 ?? {};
    const 업 = 사실.업종?.값, 지 = 사실.지역?.값;
    if (업 && 지) return { 상태: "됨", 말: `업종 ${업}(${사실.업종.출처}) · 지역 ${지}(${사실.지역.출처})` };
    return { 상태: "원장", 말: 사람말.모름(!업 && !지 ? "업종·지역" : !업 ? "업종" : "지역") };
  },

  async 검색어(q, row, deps) {
    const c = row.config, a = c.auto;
    const 업종 = a.사실?.업종?.값, 지역 = a.사실?.지역?.값;
    if (!업종 || !지역) return { 상태: "원장", 말: 사람말.모름("업종·지역") };
    const 원장경쟁 = 원장출처(a.출처?.경쟁) ? (c.queries?.compete ?? []) : [];
    // 씨앗을 넓힌다(D246) — 기본 3 · 원장 경쟁 · 동의어 · 서울 동. 1차 24 · 2차 16 · 합 40번 안
    const 일차 = [...new Set([...씨앗(업종, 지역), ...원장경쟁, ...넓힌씨앗(업종, 지역)])].slice(0, 24);
    const 판별 = Array.isArray(c.answerTerms) ? c.answerTerms : [];
    const 거름옵션 = { 판별말: 판별, 업종, 이름: row.name, 더말: 동의어(업종) };
    const 원 = await 자동완성(일차, {
      ...(deps.fetch ? { fetch: deps.fetch } : {}), ...(deps.자동완성옵션 ?? {}),
      다음씨앗: (결과1) => 거르기(출처붙임(결과1), 거름옵션).slice(0, 16).map((x) => x.text),
    });
    const 받음 = 원.씨앗.filter((s) => s.status === 200);
    // 자동완성 원문 먼저, 모자라면 틀(D246). 막혀도(403·429·못 엶) 틀로 채운다 — 원장에게 넘기지 않는다
    const 자동 = 거르기(출처붙임(원.씨앗), 거름옵션);
    const 후보 = 자동.length >= 17 ? 자동 : 거르기([...자동, ...틀검색어(업종, 지역).map((text) => ({ text, 출처: "틀" }))], 거름옵션);
    const 쓴자동 = Math.min(자동.length, 17), 쓴틀 = Math.min(후보.length, 17) - 쓴자동;
    const 자동경쟁 = 거르기(출처붙임(원.씨앗.filter((s) => s.차 === 1)), 거름옵션).slice(0, 8).map((x) => x.text);
    const 짧 = 지역짧게(지역);
    const 경쟁 = 자동경쟁.length >= 3 ? 자동경쟁
      : 거르기([...자동경쟁, `${짧} ${업종}`, `${짧} ${업종} 추천`, `${지역} ${업종}`, `${지역} ${업종} 추천`], 거름옵션).slice(0, 8);
    await 칸쓰기(q, row.id, [[["auto", "자동완성"], 원], [["auto", "후보"], 후보]]);
    if (경쟁.length >= 3) {
      // 원장이 「자세히」에서 넣은 경쟁 검색어는 덮지 않는다(D229) — 같은 문장 안에서 다시 본다
      const 출처 = 자동경쟁.length >= 3 ? `자동: 네이버 자동완성 1차 씨앗 ${일차.length}개(${일차.join(" · ")})`
        : `자동: 네이버 자동완성 ${자동경쟁.length}개 · 틀 ${경쟁.length - 자동경쟁.length}개`;
      await q(`update geo.clients set config = jsonb_set(jsonb_set(config, '{queries,compete}', $2::jsonb), '{auto,출처,경쟁}', $3::jsonb)
          where id = $1 and coalesce(config #>> '{auto,출처,경쟁}', '') not like '원장%'`,
        [row.id, JSON.stringify(경쟁), JSON.stringify(출처)]);
    }
    const 막힘 = 받음.length ? "" : ` · 자동완성 못 받음(상태 ${[...new Set(원.씨앗.map((s) => s.status ?? s.오류))].join(", ")})`;
    if (후보.length < 17) {
      return { 상태: "원장", 말: `${사람말.후보적음(후보.length)} — 자동완성 ${쓴자동} · 틀 ${쓴틀}${막힘}` };
    }
    return { 상태: "됨", 말: `자동완성 ${쓴자동} · 틀 ${쓴틀} · 경쟁 검색어 ${경쟁.length >= 3 ? `${경쟁.length}개` : "3개가 안 돼 비움"} (찾은 검색어 ${원.씨앗.length}개)${막힘}` };
  },

  async 파일럿(q, row) {
    const needs = row.config.auto.사이트상태;
    if (!["none", "setup", "build"].includes(needs)) return { 상태: "실패", 말: "사이트 상태가 아직 정해지지 않았습니다", 오류: `사이트상태 ${needs}` };
    const [새] = await q(`insert into geo.pilots (client_id, started_on, ends_on, status, needs_build)
        values ($1, (now() at time zone 'Asia/Seoul')::date, (now() at time zone 'Asia/Seoul')::date + 29, '리허설', $2)
        on conflict (client_id) do nothing returning id`, [row.id, needs]);
    if (새) return { 상태: "됨", 말: `연습 측정을 준비했습니다(필요한 준비 제안: ${준비말[needs]}) — 입금·계약 칸은 비움` };
    const [있음] = await q(`select id, status from geo.pilots where client_id = $1`, [row.id]);
    return { 상태: "됨", 말: `측정 준비가 이미 있습니다(${있음?.status ?? "?"}) — 새로 만들지 않았습니다` };
  },

  async 질문(q, row) {
    const c = row.config, a = c.auto;
    const [p] = await q(`select id, status from geo.pilots where client_id = $1`, [row.id]);
    if (!p) return { 상태: "실패", 말: "연습 측정 준비가 아직 없습니다", 오류: "pilot 없음" };
    const 후보 = Array.isArray(a.후보) ? a.후보 : [];
    if (후보.length < 17) return { 상태: "원장", 말: 사람말.후보적음(후보.length) };
    if (!String(row.answer_pattern ?? "").trim()) return { 상태: "원장", 말: "AI 답에서 이 고객을 찾을 이름이 없어 질문을 넣지 않았습니다. 「자세히」에서 이 고객만 쓰는 이름을 넣으면 이어서 합니다" };
    // 이미 질문이 있으면(원장이 넣었거나 앞 시도가 넣음) 덮지 않는다 — 측정 켜기도 안 건드린다(Step 56 D243)
    const [있음] = await q(`select count(*)::int n from geo.pilot_questions where pilot_id = $1`, [p.id]);
    if (Number(있음?.n) > 0) return { 상태: "됨", 말: `질문이 이미 ${있음.n}개 있습니다 — 넣지 않았습니다` };
    const 패널 = 패널만들기(후보, row.name, 도메인정리(row.domain) || null);
    if (패널.length !== 20 || new Set(패널.map(([, t]) => t)).size !== 20) return { 상태: "원장", 말: "질문 20개가 서로 다르지 않습니다 — 원장님이 질문을 고릅니다" };
    let 넣음 = 0;
    for (const [i, [stage, text]] of 패널.entries()) {
      const 줄 = await q(`insert into geo.pilot_questions (pilot_id, position, stage, text, approved) values ($1, $2, $3, $4, false) on conflict (pilot_id, position) do nothing returning id`,
        [p.id, i + 1, stage, text]);
      넣음 += 줄.length;
    }
    // 들어간 줄만 센다 — 경합으로 0줄이면 「20개 넣음」이라 하지 않는다
    if (넣음 === 0) return { 상태: "원장", 말: "질문을 넣지 못했습니다. 원장님이 /admin/pilots 에서 확인합니다" };
    if (넣음 < 20) return { 상태: "원장", 말: `질문이 ${넣음}개만 들어갔습니다(20개 중). 원장님이 /admin/pilots 에서 채웁니다` };
    await q(`update geo.clients set measure_active = true where id = $1`, [row.id]);
    return { 상태: "됨", 말: `질문 ${넣음}개(검색어 17 · 이름 3)를 넣었습니다 — 승인은 원장님이 /admin/pilots 에서` };
  },
};

/**
 * 한 걸음 — 의존이 풀린 첫 단계 하나를 임대 → 실행 → 저장 → 체크리스트 + 사람일감맞추기. → { 단계, 상태, 말 }
 *   deps: { fetch, lookup, checkPlatform, detectPlatform, admin, now, 실패도, 자동완성옵션 }
 * 플랫폼 확인기(checkPlatform)는 web 에만 있다(TS) — 없으면 플랫폼 고객의 사이트 단계를 건너뛴다(고객 화면 판이 연다)
 */
export async function 자동한걸음(q, slug, deps = {}) {
  const now = deps.now ? deps.now() : new Date();
  const row = await 행읽기(q, slug);
  if (!row) return { 단계: null, 상태: "없음", 말: "고객을 못 찾았습니다" };
  const auto = row.config?.auto;
  if (!auto?.단계) return { 단계: null, 상태: "없음", 말: "자동 준비가 없는 고객입니다" };
  const k = 다음단계(auto, now, { 실패도: deps.실패도 !== false });
  if (!k) {
    // 세 번 다 시간 안에 못 끝낸 단계(도는중·시도 3) — 원장으로
    const 멈춤 = 멈춘단계(auto, now);
    if (멈춤) {
      await 칸쓰기(q, row.id, [[["auto", "단계", 멈춤], { ...auto.단계[멈춤], 상태: "원장", at: now.toISOString(), 말: `${자동단계말[멈춤]} 단계가 ${최대시도}번 다 시간 안에 안 끝났습니다. 「다시 시도」를 누릅니다` }]]);
      await 맞추기(q, slug, deps);
      return { 단계: 멈춤, 상태: "원장", 말: "시간 초과 3번" };
    }
    return { 단계: null, 상태: 자동요약(auto).끝 ? "끝" : "할 것 없음", 말: "" };
  }
  if (k === "사이트" && 단계갈래(row) === "플랫폼" && !deps.checkPlatform) return { 단계: k, 상태: "건너뜀", 말: "플랫폼 확인은 고객 화면에서 합니다" };
  if (!(await 임대(q, row.id, k, now.toISOString()))) return { 단계: k, 상태: "도는중", 말: "다른 곳에서 이 단계를 돌리고 있습니다" };
  const 지금 = await 행읽기(q, slug);
  const 시도 = 지금.config.auto.단계[k]?.시도 ?? 1;
  let r;
  try {
    r = await 단계실행[k](q, 지금, deps);
  } catch (e) {
    r = { 상태: "실패", 말: `${자동단계말[k]} 단계가 오류로 멈췄습니다. 다시 시도합니다`, 오류: String(e?.message ?? e) };
  }
  if (r.상태 === "실패" && 시도 >= 최대시도) r = { ...r, 상태: "원장", 말: `${r.말} — ${최대시도}번째도 안 돼 멈췄습니다` };
  await 칸쓰기(q, row.id, [[["auto", "단계", k], { 상태: r.상태, at: new Date().toISOString(), 시도, 말: 앞(r.말, 500), ...(r.오류 ? { 오류: 앞(r.오류, 300) } : {}) }]]);
  await 맞추기(q, slug, deps);
  return { 단계: k, 상태: r.상태, 말: r.말 };
}

/** 체크리스트 → 사람 일감(setup-auto·setup-name 포함). 점검과 같은 길 */
async function 맞추기(q, slug, deps) {
  const row = await 행읽기(q, slug);
  const 줄 = 체크리스트(row, row.derived ?? {}, { pilot: await 파일럿상태(q, row.id) });
  await 사람일감맞추기(q, row, 줄, { admin: deps.admin });
}

/** 「다시 시도」 — 그 단계 시도 0·대기. 원장이 바꾼 값으로 다시 돈다 */
export async function 재시도(q, slug, k) {
  if (!자동단계.includes(k)) return false;
  const rows = await q(`update geo.clients set config = jsonb_set(config, $2::text[], jsonb_build_object('상태', '대기', '시도', 0))
      where slug = $1 and config #> '{auto,단계}' is not null returning id`, [slug, ["auto", "단계", k]]);
  return rows.length > 0;
}

/** 원장 두 칸(업종·지역) → auto.사실 출처 「원장 입력 <KST 날짜>」 · 업종지역 됨 · 검색어 대기 */
export function 사실입력검사(f) {
  const 업종 = String(f.업종 ?? f.category ?? "").trim().replace(/\s+/g, " ");
  const 지역 = String(f.지역 ?? f.district ?? "").trim().replace(/\s+/g, " ");
  const 오류 = [];
  if (업종.length < 2 || 업종.length > 20 || !/^[가-힣a-zA-Z0-9 ]+$/.test(업종)) 오류.push("업종은 2~20자 한글·영문으로(예: 치과, 수학학원)");
  if (지역.length < 2 || 지역.length > 20 || !/^[가-힣 ]+$/.test(지역)) 오류.push("지역은 2~20자 한글로(예: 송파구)");
  return { ok: !오류.length, 업종, 지역, 오류 };
}
export async function 사실저장(q, slug, { 업종, 지역 }, now = new Date()) {
  const 출처 = `원장 입력 ${KST날(now)}`;
  const at = now.toISOString();
  const rows = await q(`update geo.clients set config = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(config,
        '{auto,사실}', $2::jsonb), '{auto,출처,업종}', $3::jsonb), '{auto,출처,지역}', $3::jsonb),
        '{auto,단계,업종지역}', $4::jsonb), '{auto,단계,검색어}', $5::jsonb)
      where slug = $1 and config #> '{auto,단계}' is not null returning id`,
    [slug, JSON.stringify({ 업종: { 값: 업종, 출처 }, 지역: { 값: 지역, 출처 } }), JSON.stringify(출처),
      JSON.stringify({ 상태: "됨", at, 시도: 0, 말: `업종 ${업종} · 지역 ${지역}(${출처})` }), JSON.stringify({ 상태: "대기", 시도: 0 })]);
  return rows.length > 0;
}

/**
 * 매시 고리(company.mjs) — 창을 닫아도 이어진다. status active 만(시험 고객은 화면에서만) · 돌 단계가 있는 곳, 오래된 것부터 max 곳 · 한 걸음씩.
 * 한 곳이 실패해도 다음 곳. → 돈 slug 들
 */
export async function 자동이어하기(q, { max = 3, admin, deps = {}, log = console.log, now = () => new Date() } = {}) {
  const rows = (await q(`select to_jsonb(c) as r from geo.clients c where c.status = 'active' and c.config ? 'auto' order by c.id`)).map((x) => x.r);
  const 지금 = now();
  // 플랫폼 확인기가 없는 고리(company.mjs)에서 플랫폼 고객의 사이트 단계는 「건너뜀」뿐이다 — 자리 3개를 먹지 않게 뺀다(Step 56 D244)
  const 건너뛸 = (r) => !deps.checkPlatform && !멈춘단계(r.config.auto, 지금) && 다음단계(r.config.auto, 지금) === "사이트" && 단계갈래(r) === "플랫폼";
  const 고른 = rows.filter((r) => !CODE_SLUGS.includes(r.slug) && (다음단계(r.config.auto, 지금) || 멈춘단계(r.config.auto, 지금)) && !건너뛸(r))
    .sort((a, b) => String(a.config.auto.at ?? "").localeCompare(String(b.config.auto.at ?? "")) || a.id - b.id)
    .slice(0, max);
  for (const r of 고른) {
    try {
      const x = await 자동한걸음(q, r.slug, { ...deps, admin, now });
      log(`  자동 세팅 ${r.slug}: ${x.단계 ?? "-"} ${x.상태}${x.말 ? ` — ${앞(x.말, 120)}` : ""}`);
    } catch (e) {
      log(`  ⚠ 자동 세팅 ${r.slug} 실패 — ${앞(e?.message ?? e, 160)}`);
    }
  }
  return 고른.map((r) => r.slug);
}

