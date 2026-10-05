/**
 * 고객사 등록·고치기·세팅 점검·체크리스트·사람 일감 동기화·지우기 (Step 38).
 *
 * 화면(web/lib/client-actions.ts)·회사 루프(academy/scripts/company.mjs)·시험(academy/scripts/test-client-core.mjs ·
 * test-client-screen.mjs)이 같은 함수를 부른다. growth-core 처럼 순수 함수 + DB 주입(q).
 *   q(sql, params) → rows   한 연결에 묶인 것(등록·지우기는 그 위에서 begin/commit 한다)
 * web 은 Vercel 에 web/ 만 올라가 academy/clients.mjs 를 못 읽는다 — 코드 고객 slug·AI 봇 목록은 여기 베끼고 시험이 맞춰 본다.
 *
 * 숫자·값은 실제로 열어 본 것만 derived 에 둔다. 못 열면 그 칸은 status 와 오류만(추측 값 금지).
 * 고객 이름·도메인·본문 앞부분은 관리 화면·DB 에만 간다. 공개 페이지·케이스 리포트로 가는 길은 없다.
 */

/** academy/clients.mjs CODE_CLIENTS 의 slug — 화면에서 안 고친다(test-client-core 가 맞춰 본다) */
export const CODE_SLUGS = ["robotncoding", "ilog", "docttak"];

/** web/lib/crawler-class.ts AI_BOTS 와 같은 목록(test-client-core 가 맞춰 본다) */
export const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Vertex", "Applebot-Extended",
  "meta-externalagent", "FacebookBot", "Bytespider", "CCBot", "Amazonbot", "YouBot", "cohere-ai", "Diffbot",
];

// ─────────────────────────────────────────── 이름 판별 말 (web/lib/answer-pattern.ts 가 다시 내보낸다)
const 한글 = /[가-힣]/;

/** 말 안의 한 낱말 → 정규식 조각. 한글 글자끼리 붙은 자리에 \s? */
function wordPattern(w) {
  const ch = [...w];
  return ch.map((c, i) => {
    const e = c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/&/g, "(?:&|&amp;)");
    return i > 0 && 한글.test(c) && 한글.test(ch[i - 1]) ? "\\s?" + e : e;
  }).join("");
}
const 말나눔 = (raw) => [...new Set(String(raw ?? "").split(/[,，]/).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.length >= 2 && s.length <= 40))].slice(0, 10);
const 한말 = (t) => t.split(" ").map(wordPattern).join("\\s*");

/**
 * 쉼표로 나눈 말 → answer_pattern. 설명은 web/lib/answer-pattern.ts 머리말.
 * exclude(제외 앞말)가 있으면 각 말 앞에 부정 lookbehind — 「똑똑한 로봇&코딩학원」처럼 남의 이름 안에 든 우리 이름을 안 센다.
 * exclude 가 비면 한 인자 때와 글자 하나 다르지 않다(test-client-core 회귀)
 */
export function answerPattern(raw, exclude = "") {
  const terms = 말나눔(raw);
  if (!terms.length) return null;
  const ex = 말나눔(exclude);
  const 앞 = ex.length ? `(?<!(?:${ex.map(한말).join("|")})\\s*)` : "";
  return terms.map((t) => 앞 + 한말(t)).join("|");
}

/** 0 → A, 25 → Z, 26 → AA */
const letters = (n) => (n < 26 ? "" : letters(Math.floor(n / 26) - 1)) + String.fromCharCode(65 + (n % 26));
/**
 * 가림 별칭 「고객 A」「고객 B」…. 지역·업종을 넣으면 조합으로 특정된다(CLAUDE.md 고객사는 가린다).
 * 이미 쓴 「고객 X」를 피해 가장 앞 글자를 준다. web/lib/pilot-intake.ts 가 다시 내보낸다
 */
export function nextAlias(used) {
  const taken = new Set(used);
  for (let n = 0; ; n++) if (!taken.has(`고객 ${letters(n)}`)) return `고객 ${letters(n)}`;
}

// ─────────────────────────────────────────── 입력검사
/** academy/clients.mjs 도메인정리 와 같은 규칙 — 스킴·www·경로를 뗀다 */
export const 도메인정리 = (d) => String(d ?? "").trim().toLowerCase()
  .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");

const 줄나눔 = (v) => String(v ?? "").split(/\r?\n/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
const 쉼표나눔 = (v) => String(v ?? "").split(/[,，]/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
const 같은말뺌 = (xs) => [...new Set(xs)];
const 켬 = (v) => v === "on" || v === "true" || v === true || v === "1";

/** 호스트만 남긴다. 거부하면 null + 까닭 */
function 호스트(raw) {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return { host: null, 까닭: "홈페이지 도메인을 넣어 주세요" };
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[/?#].*$/, "");
  s = s.replace(/^[^@]*@/, "");
  if (s.startsWith("[")) return { host: null, 까닭: "IP 주소는 받지 않습니다. 도메인을 넣어 주세요" };
  s = s.replace(/:\d*$/, "").replace(/\.$/, "").replace(/^www\./, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) || s.includes(":")) return { host: null, 까닭: "IP 주소는 받지 않습니다. 도메인을 넣어 주세요" };
  if (s === "localhost" || s.endsWith(".localhost")) return { host: null, 까닭: "localhost 는 받지 않습니다. 고객 사이트 도메인을 넣어 주세요" };
  if (!s.includes(".")) return { host: null, 까닭: "도메인에 점이 없습니다 (예: example.co.kr)" };
  if (s.length > 253 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || s.split(".").some((p) => !p || p.length > 63 || p.startsWith("-") || p.endsWith("-"))) {
    return { host: null, 까닭: "도메인 모양이 아닙니다. 영문 도메인만 받습니다 (한글 도메인은 xn-- 로 바꿔 넣습니다)" };
  }
  return { host: s, 까닭: null };
}

/**
 * 등록·고치기 폼 값 → { ok, 칸, 오류[] }. 오류는 화면에 그대로 띄우는 사람 말.
 *   name · slug · domain · answer_terms(쉼표) · answer_exclude(쉼표, 선택) · compete(줄마다) · brand(줄마다, 선택)
 *   address_part · phone_last4(선택) · relation(자사|외부) · test(on) · want_gsc(on)
 */
export function 입력검사(f) {
  const 오류 = [];
  const name = String(f.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) 오류.push("이름은 2~40자로 넣어 주세요");
  const slug = String(f.slug ?? "").trim();
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) 오류.push("영문 관리명은 영문 소문자·숫자·- 만, 40자까지 씁니다 (예: miso-dental)");
  const { host, 까닭 } = 호스트(f.domain);
  if (!host) 오류.push(까닭);

  const 판별 = 같은말뺌(쉼표나눔(f.answer_terms));
  if (!판별.length) 오류.push("답에서 찾을 이름을 하나는 넣어 주세요");
  else if (판별.length > 10) 오류.push("답에서 찾을 이름은 10개까지입니다");
  else if (판별.some((x) => x.length < 2 || x.length > 40)) 오류.push("답에서 찾을 이름은 하나하나 2~40자입니다 (한 글자 말은 아무 답에나 걸립니다)");
  const 제외 = 같은말뺌(쉼표나눔(f.answer_exclude));
  if (제외.length > 5 || 제외.some((x) => x.length < 2 || x.length > 40)) 오류.push("제외할 앞말은 5개까지, 하나하나 2~40자입니다");

  const 경쟁 = 같은말뺌(줄나눔(f.compete));
  if (경쟁.length < 3 || 경쟁.length > 8) 오류.push(`경쟁 검색어는 3~8개입니다 (지금 ${경쟁.length}개). 한 줄에 하나씩, 이름 없이 손님이 치는 말로`);
  else if (경쟁.some((x) => x.length < 2 || x.length > 40)) 오류.push("경쟁 검색어는 하나하나 2~40자입니다");
  let 브랜드 = 같은말뺌(줄나눔(f.brand));
  if (브랜드.length > 5 || 브랜드.some((x) => x.length < 2 || x.length > 40)) 오류.push("브랜드 검색어는 5개까지, 하나하나 2~40자입니다");
  if (!브랜드.length && name) 브랜드 = [name];

  const 주소 = String(f.address_part ?? "").trim().replace(/\s+/g, " ");
  if (주소 && (주소.length < 2 || 주소.length > 40)) 오류.push("주소 일부는 2~40자입니다 (예: 석촌동 274-8)");
  const 전화 = String(f.phone_last4 ?? "").trim();
  if (전화 && !/^\d{4}$/.test(전화)) 오류.push("전화 끝자리는 숫자 4개입니다");

  const relation = String(f.relation ?? "외부");
  if (!["자사", "외부"].includes(relation)) 오류.push("자사·외부 중 하나를 골라 주세요");

  const 칸 = {
    name, slug, domain: host, answerTerms: 판별, answerExclude: 제외, compete: 경쟁, brand: 브랜드,
    address: 주소 || null, phone4: 전화 || null, relation, test: 켬(f.test), wantGsc: 켬(f.want_gsc),
  };
  return { ok: 오류.length === 0, 칸, 오류 };
}

/** 화면 ?err= 코드 → 사람 말 한 줄. 모르는 코드는 null */
export const 오류말 = {
  "slug-code": "등록 안 됨 — 그 영문 관리명은 코드로 설정한 고객(학원·아이로그·문서딱)이 씁니다",
  "slug-taken": "등록 안 됨 — 그 영문 관리명은 이미 다른 고객이 씁니다. 덮어쓰지 않습니다",
  "domain-taken": "저장 안 됨 — 같은 도메인으로 등록한 고객이 이미 있습니다",
  "not-found": "그 고객을 못 찾았습니다",
  "code-client": "코드로 설정한 고객은 화면에서 고치지 않습니다",
  "not-test": "지우기는 시험 고객만 됩니다. 진짜 고객은 지우지 않습니다",
  "left": "지우기 취소 — 지운 뒤에도 남은 행이 있어 되돌렸습니다",
  "check": "저장은 됐는데 사이트 점검이 실패했습니다. 다음 매시에 다시 봅니다",
  "pilot-internal": "파일럿은 외부 고객만 시작합니다",
  "pilot-exists": "이 고객은 이미 파일럿이 있습니다",
};

// ─────────────────────────────────────────── 등록 · 고치기
/** 칸이 없는 DB 에서도 돌게 — add column if not exists 만 */
export async function 고객칸준비(q) {
  await q(`alter table geo.clients add column if not exists answer_pattern text`);
  await q(`alter table geo.clients add column if not exists measure_active boolean not null default false`);
  await q(`alter table geo.clients add column if not exists config jsonb not null default '{}'::jsonb`);
  await q(`alter table geo.clients add column if not exists derived jsonb not null default '{}'::jsonb`);
}

/** IndexNow 키 — uuid 하이픈 뺀 32자(영문 소문자·숫자). 키 파일 이름이자 내용 */
export const 새키 = () => globalThis.crypto.randomUUID().replace(/-/g, "");

/** 칸 → config 에서 화면이 정하는 부분. 나머지(indexnow·gsc·marketing·loop…)는 그대로 둔다 */
function 화면config(칸) {
  const presence = [칸.address, 칸.phone4].filter(Boolean);
  return {
    queries: { compete: 칸.compete, brand: 칸.brand },
    presence,
    answerTerms: 칸.answerTerms,
    answerExclude: 칸.answerExclude,
    wantGsc: 칸.wantGsc,
    // 이름 질문 적중 말(loop.brandHit) — 주소 일부(학원의 「석촌」 자리). 전화 끝자리는 답에 우연히 나올 수 있어 안 쓴다
    ...(칸.address ? { hitWords: [칸.address] } : {}),
  };
}

const 다른도메인고객 = async (q, domain, 빼고 = null) =>
  (await q(`select id, slug, domain from geo.clients`)).find((r) => r.id !== 빼고 && 도메인정리(r.domain) === domain) ?? null;

/**
 * 새 고객 한 곳. 덮어쓰지 않는다 — 코드 slug·DB slug·같은 도메인이면 거부.
 * → { ok: true, id, slug } | { ok: false, err } (err 는 오류말 키). 다른 오류는 던진다(rollback 뒤)
 */
export async function 등록(q, 칸) {
  if (CODE_SLUGS.includes(칸.slug)) return { ok: false, err: "slug-code" };
  await 고객칸준비(q);
  await q("begin");
  try {
    if ((await q(`select 1 from geo.clients where slug = $1`, [칸.slug])).length) { await q("rollback"); return { ok: false, err: "slug-taken" }; }
    if (await 다른도메인고객(q, 칸.domain)) { await q("rollback"); return { ok: false, err: "domain-taken" }; }
    const alias = 칸.relation === "외부"
      ? nextAlias((await q(`select alias from geo.clients where alias like '고객 %'`)).map((r) => r.alias))
      : 칸.name;
    const config = { v: 1, ...화면config(칸), indexnow: { mode: "우리", key: 새키() }, gsc: false };
    const pattern = answerPattern(칸.answerTerms.join(","), 칸.answerExclude.join(","));
    const [r] = await q(`insert into geo.clients (slug, name, domain, alias, schema_name, started_on, note, relation, answer_pattern, status, config, derived)
        values ($1, $2, $3, $4, 'academy', (now() at time zone 'Asia/Seoul')::date, '관리 화면 등록', $5, $6, $7, $8::jsonb, '{}'::jsonb) returning id`,
      [칸.slug, 칸.name, 칸.domain, alias, 칸.relation, pattern, 칸.test ? "test" : "active", JSON.stringify(config)]);
    await q("commit");
    return { ok: true, id: r.id, slug: 칸.slug };
  } catch (e) {
    await q("rollback");
    throw e;
  }
}

/**
 * 고치기 — slug·status 는 그대로. 도메인이 바뀌면 derived 를 비운다(옛 사이트 점검 결과가 남으면 틀린 체크리스트가 된다).
 * 자사↔외부를 바꾸면 alias 를 다시 정한다(외부는 「고객 X」, 자사는 이름)
 */
export async function 고치기(q, slug, 칸) {
  if (CODE_SLUGS.includes(slug)) return { ok: false, err: "code-client" };
  const [row] = await q(`select id, domain, alias, relation, to_jsonb(c)->'config' as config from geo.clients c where slug = $1`, [slug]);
  if (!row) return { ok: false, err: "not-found" };
  if (await 다른도메인고객(q, 칸.domain, row.id)) return { ok: false, err: "domain-taken" };
  const 도메인바뀜 = 도메인정리(row.domain) !== 칸.domain;
  const 옛 = row.config && typeof row.config === "object" ? row.config : {};
  const { hitWords: _h, ...남김 } = 옛;
  const config = { ...남김, v: 1, ...화면config(칸) };
  let alias = row.alias;
  if (칸.relation === "외부" && !String(alias ?? "").startsWith("고객 ")) {
    alias = nextAlias((await q(`select alias from geo.clients where alias like '고객 %'`)).map((r) => r.alias));
  }
  if (칸.relation === "자사") alias = 칸.name;
  await q(`update geo.clients set name = $2, domain = $3, relation = $4, alias = $5, answer_pattern = $6, config = $7::jsonb,
                  derived = case when $8 then '{}'::jsonb else derived end
            where id = $1`,
    [row.id, 칸.name, 칸.domain, 칸.relation, alias, answerPattern(칸.answerTerms.join(","), 칸.answerExclude.join(",")), JSON.stringify(config), 도메인바뀜]);
  return { ok: true, id: row.id, slug, 도메인바뀜 };
}

/** 고치기 폼이 보여 줄 값 — config 원문에서 */
export function 폼값(row) {
  const c = row.config && typeof row.config === "object" ? row.config : {};
  const presence = Array.isArray(c.presence) ? c.presence : [];
  return {
    name: row.name ?? "", slug: row.slug ?? "", domain: row.domain ?? "",
    answer_terms: (c.answerTerms ?? []).join(", "), answer_exclude: (c.answerExclude ?? []).join(", "),
    compete: (c.queries?.compete ?? []).join("\n"), brand: (c.queries?.brand ?? []).join("\n"),
    address_part: presence.find((x) => !/^\d{4}$/.test(x)) ?? "", phone_last4: presence.find((x) => /^\d{4}$/.test(x)) ?? "",
    relation: row.relation ?? "외부", want_gsc: c.wantGsc !== false,
  };
}

// ─────────────────────────────────────────── 세팅 점검
const 앞 = (s, n = 300) => String(s ?? "").slice(0, n);
const 같은호스트 = (a, b) => a.replace(/^www\./, "") === b.replace(/^www\./, "");
const UA = "Mozilla/5.0 (compatible; CitedSetupCheck/1.0; +https://geo-rose-nine.vercel.app)";

/**
 * 한 주소를 연다. redirect 는 손으로 따라가되 같은 호스트(www 차이 허용)의 https 까지만.
 * → { status, type, body, url, error? }. 못 열면 status null + error
 */
async function 열기(url, domain, { fetch, 마감, 한도 }) {
  let 지금 = url;
  for (let 홉 = 0; 홉 < 5; 홉++) {
    const 남음 = Math.min(한도, 마감 - Date.now());
    if (남음 <= 0) return { status: null, url: 지금, error: "시간 초과(전체 20초)" };
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 남음);
    let r;
    try {
      r = await fetch(지금, { redirect: "manual", signal: ac.signal, headers: { "user-agent": UA, accept: "*/*" } });
    } catch (e) {
      clearTimeout(t);
      return { status: null, url: 지금, error: ac.signal.aborted ? `시간 초과(${Math.round(남음 / 1000)}초)` : `못 열림(${앞(e?.cause?.code ?? e?.message ?? e, 60)})` };
    }
    const status = r.status;
    if (status >= 300 && status < 400) {
      clearTimeout(t);
      const loc = r.headers.get("location");
      if (!loc) return { status, url: 지금, error: "넘겨주는 주소가 비었습니다" };
      let 다음;
      try { 다음 = new URL(loc, 지금); } catch { return { status, url: 지금, error: "넘겨주는 주소를 못 읽음" }; }
      if (다음.protocol !== "https:" || !같은호스트(다음.hostname.toLowerCase(), domain)) {
        return { status, url: 지금, error: `다른 주소로 넘어가 따라가지 않음(${다음.protocol}//${다음.hostname})` };
      }
      지금 = 다음.toString();
      continue;
    }
    let body = "";
    try { body = await r.text(); } catch (e) {
      clearTimeout(t);
      return { status, url: 지금, type: r.headers.get("content-type") ?? "", error: ac.signal.aborted ? "본문 읽다 시간 초과" : "본문을 못 읽음" };
    }
    clearTimeout(t);
    return { status, url: 지금, type: r.headers.get("content-type") ?? "", body };
  }
  return { status: null, url: 지금, error: "넘겨주기가 5번 넘게 이어짐" };
}

/**
 * robots.txt → AI 봇 중 막힌 것. 묶음 = 이어진 User-agent 줄들 + 그 아래 규칙.
 * 봇 이름 묶음이 있으면 그것, 없으면 * 묶음을 본다. 「Disallow: /」가 있고 「Allow: /」가 없으면 막힘
 */
export function robots막힘(text) {
  const 묶음들 = [];
  let 지금 = null, 규칙중 = false;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") {
      if (!지금 || 규칙중) { 지금 = { agents: [], disallowRoot: false, allowRoot: false }; 묶음들.push(지금); 규칙중 = false; }
      지금.agents.push(v.toLowerCase().replace(/\/.*$/, ""));
    } else if (k === "disallow" || k === "allow") {
      if (!지금) continue;
      규칙중 = true;
      if (v === "/") { if (k === "disallow") 지금.disallowRoot = true; else 지금.allowRoot = true; }
    }
  }
  const 막음 = (g) => g.disallowRoot && !g.allowRoot;
  const 별 = 묶음들.filter((g) => g.agents.includes("*"));
  return AI_BOTS.filter((bot) => {
    const 내것 = 묶음들.filter((g) => g.agents.includes(bot.toLowerCase()));
    return (내것.length ? 내것 : 별).some(막음);
  });
}

/** 홈 HTML 의 ld+json @type 전부(@graph·배열·중첩 @type 배열). 깨진 블록 수도 센다 */
export function ld타입(html) {
  const 타입 = new Set();
  let 깨짐 = 0;
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  const 걷기 = (x) => {
    if (Array.isArray(x)) { x.forEach(걷기); return; }
    if (!x || typeof x !== "object") return;
    const t = x["@type"];
    for (const v of Array.isArray(t) ? t : [t]) if (typeof v === "string" && v.trim()) 타입.add(v.trim());
    if (x["@graph"]) 걷기(x["@graph"]);
  };
  for (const m of String(html ?? "").matchAll(re)) {
    try { 걷기(JSON.parse(m[1].trim())); } catch { 깨짐++; }
  }
  return { types: [...타입], 깨짐 };
}

const 사이트맵모양 = (body) => (/<sitemapindex[\s>]/i.test(body) ? "index" : /<urlset[\s>]/i.test(body) ? "urlset" : null);
const loc들 = (body) => [...String(body).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));

/**
 * 고객 사이트를 실제로 연다 → derived. 키 이름은 academy/clients.mjs 고객설정 이 읽는 것과 같다(llmsTxt.ok · homeLdTypes).
 *   home{status,type,head} · robots{status,blocked[],head} · sitemap{status,url,kind,pages,ok} · llmsTxt{status,type,head,ok}
 *   homeLdTypes[] · indexnowFile{status,ok,head} · checkedAt · errors[]
 * 한 주소 8초 · 전체 20초. 못 연 칸은 status 와 error 만(추측 값 없음). 본문은 칸마다 앞 300자만 남긴다
 */
export async function 세팅점검(domain, key, { fetch = globalThis.fetch, 한도 = 8000, 전체 = 20000, now = () => new Date() } = {}) {
  const d = 도메인정리(domain);
  const 마감 = Date.now() + 전체;
  const o = { fetch, 마감, 한도 };
  const base = `https://${d}`;
  const errors = [];
  const 칸 = (r) => ({ status: r.status, ...(r.type !== undefined ? { type: 앞(r.type, 80) } : {}), ...(r.error ? { error: r.error } : {}) });

  const [home, rob, llms, kf] = await Promise.all([
    열기(`${base}/`, d, o), 열기(`${base}/robots.txt`, d, o), 열기(`${base}/llms.txt`, d, o),
    key ? 열기(`${base}/${key}.txt`, d, o) : Promise.resolve(null),
  ]);
  const out = { checkedAt: now().toISOString() };

  out.home = { ...칸(home), ...(home.body !== undefined ? { head: 앞(home.body) } : {}) };
  if (home.error) errors.push(`홈: ${home.error}`);
  if (home.status === 200 && home.body !== undefined) {
    const ld = ld타입(home.body);
    out.homeLdTypes = ld.types;
    if (ld.깨짐) errors.push(`홈 JSON-LD ${ld.깨짐}개를 못 읽음(JSON 이 깨짐)`);
  }

  out.robots = { ...칸(rob) };
  if (rob.error) errors.push(`robots.txt: ${rob.error}`);
  if (rob.body !== undefined) out.robots.head = 앞(rob.body);
  if (rob.status === 200 && rob.body !== undefined) out.robots.blocked = robots막힘(rob.body);
  else if (rob.status === 404 || rob.status === 410) out.robots.blocked = [];

  // 사이트맵 — robots 의 Sitemap: 줄(같은 호스트 https) 또는 /sitemap.xml
  const 적힌 = rob.status === 200 ? [...String(rob.body ?? "").matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]) : [];
  const 우리것 = 적힌.find((u) => { try { const x = new URL(u); return x.protocol === "https:" && 같은호스트(x.hostname.toLowerCase(), d); } catch { return false; } });
  const smUrl = 우리것 ?? `${base}/sitemap.xml`;
  if (적힌.length && !우리것) errors.push("robots.txt 의 Sitemap 주소가 다른 호스트라 /sitemap.xml 을 봤습니다");
  const sm = await 열기(smUrl, d, o);
  out.sitemap = { ...칸(sm), url: smUrl };
  if (sm.error) errors.push(`사이트맵: ${sm.error}`);
  if (sm.status === 200 && sm.body !== undefined) {
    const kind = 사이트맵모양(sm.body);
    out.sitemap.kind = kind;
    if (kind === "urlset") out.sitemap.pages = loc들(sm.body).length;
    else if (kind === "index") {
      const 자식 = loc들(sm.body);
      const 셀것 = 자식.filter((u) => { try { const x = new URL(u); return x.protocol === "https:" && 같은호스트(x.hostname.toLowerCase(), d); } catch { return false; } }).slice(0, 5);
      const 결과 = await Promise.all(셀것.map((u) => 열기(u, d, o)));
      out.sitemap.children = 자식.length;
      out.sitemap.counted = 결과.filter((r) => r.status === 200).length;
      out.sitemap.pages = 결과.reduce((n, r) => n + (r.status === 200 && r.body !== undefined ? loc들(r.body).length : 0), 0);
      결과.forEach((r, i) => { if (r.status !== 200) errors.push(`하위 사이트맵 ${셀것[i]}: ${r.error ?? r.status}`); });
    } else {
      out.sitemap.head = 앞(sm.body);
      out.sitemap.pages = 0;
    }
    out.sitemap.ok = !!kind && out.sitemap.pages > 0;
  } else if (sm.status !== null) out.sitemap.ok = false;

  out.llmsTxt = { ...칸(llms) };
  if (llms.error) errors.push(`llms.txt: ${llms.error}`);
  if (llms.body !== undefined) out.llmsTxt.head = 앞(llms.body);
  if (llms.status !== null) {
    const t = String(llms.type ?? "").toLowerCase();
    out.llmsTxt.ok = llms.status === 200 && /^text\/(plain|markdown)/.test(t) && !String(llms.body ?? "").trimStart().startsWith("<");
  }

  if (kf) {
    out.indexnowFile = { ...칸(kf) };
    if (kf.error) errors.push(`IndexNow 키 파일: ${kf.error}`);
    if (kf.body !== undefined) out.indexnowFile.head = 앞(kf.body, 80);
    if (kf.status !== null) out.indexnowFile.ok = kf.status === 200 && String(kf.body ?? "").trim() === key;
  }
  out.errors = errors;
  return out;
}

/** 고객 행 하나를 점검하고 derived 에 쓴다 → derived */
export async function 점검저장(q, row, opts = {}) {
  const key = row.config?.indexnow?.mode === "우리" ? row.config.indexnow.key ?? null : null;
  const derived = await 세팅점검(row.domain, key, opts);
  await q(`update geo.clients set derived = $2::jsonb where id = $1`, [row.id, JSON.stringify(derived)]);
  return derived;
}

// ─────────────────────────────────────────── 체크리스트
const 됨 = "됨", 기다림 = "기다림", 사람 = "사람", 없음 = "해당없음";

/**
 * 고객 행·derived·파일럿 → 칸마다 됨|기다림|사람|해당없음. 순수.
 *   row        { slug, name, domain, relation, config }
 *   pilot      { id, status, approved } | null — 파일럿(리허설·취소 빼고)이 있으면
 * 원장 몫(사람)은 셋까지 — 「고객 담당에게 보낼 것」(빠진 사이트 파일을 한 묶음) · 구글 서치콘솔 권한 · 파일럿 시작.
 * → [{ id, 칸, 상태, 사람말, 할일 }] (할일 = 사람 칸이면 그대로 복사해 보낼 글 또는 원장이 할 일)
 */
export function 체크리스트(row, derived, { pilot = null } = {}) {
  const c = row.config && typeof row.config === "object" ? row.config : {};
  const d = derived && typeof derived === "object" ? derived : {};
  const domain = 도메인정리(row.domain);
  const base = `https://${domain}`;
  const 점검함 = !!d.checkedAt;
  const 못함 = (x, 이름) => ({ 상태: 기다림, 사람말: !점검함 ? "아직 점검 전입니다. 저장하거나 「다시 점검」을 누르면 엽니다" : `${이름}을(를) 못 열었습니다(${x?.error ?? (x?.status ? `코드 ${x.status}` : "까닭 모름")}). 매시에 다시 봅니다` });
  const 줄 = [];
  const 보낼것 = [];

  // 사이트 열림
  const h = d.home;
  if (h && h.status >= 200 && h.status < 300) 줄.push({ id: "site", 칸: "사이트 열림", 상태: 됨, 사람말: `${base}/ 가 열립니다(${h.status})` });
  else 줄.push({ id: "site", 칸: "사이트 열림", ...못함(h, "홈") });

  // robots
  const r = d.robots;
  if (Array.isArray(r?.blocked) && !r.blocked.length) {
    줄.push({ id: "robots", 칸: "AI 크롤러 허용(robots)", 상태: 됨, 사람말: r.status === 200 ? "AI 검색 로봇을 막는 줄이 없습니다" : `robots.txt 가 없습니다(${r.status}). 막는 줄도 없어 허용으로 봅니다` });
  } else if (Array.isArray(r?.blocked)) {
    줄.push({ id: "robots", 칸: "AI 크롤러 허용(robots)", 상태: 기다림, 사람말: `막힌 로봇 ${r.blocked.length}개: ${r.blocked.join(", ")} — 고객 담당에게 보낼 글에 넣었습니다` });
    보낼것.push(`robots.txt 에서 AI 검색 로봇을 막는 줄을 빼 주세요. 지금 막힌 로봇은 ${r.blocked.join(", ")} 입니다. 「User-agent: …」 아래 「Disallow: /」 줄이 막는 줄입니다.`);
  } else 줄.push({ id: "robots", 칸: "AI 크롤러 허용(robots)", ...못함(r, "robots.txt") });

  // 사이트맵
  const s = d.sitemap;
  if (s?.ok) 줄.push({ id: "sitemap", 칸: "사이트맵", 상태: 됨, 사람말: `${s.url} 에 주소 ${s.pages}개${s.kind === "index" ? `(하위 ${s.children}개 중 ${s.counted}개를 셈)` : ""}` });
  else if (s && s.status !== null && s.status !== undefined) {
    const 지금 = s.status !== 200 ? `지금은 열리지 않습니다(${s.status})` : s.kind ? "지금은 열리는데 주소가 0개입니다" : "지금 주소는 열리는데 사이트맵(XML)이 아닙니다";
    줄.push({ id: "sitemap", 칸: "사이트맵", 상태: 기다림, 사람말: `${지금} — 고객 담당에게 보낼 글에 넣었습니다` });
    보낼것.push(`사이트맵을 ${base}/sitemap.xml 에 두고, robots.txt 에 「Sitemap: ${base}/sitemap.xml」 한 줄을 넣어 주세요. ${지금}.`);
  } else 줄.push({ id: "sitemap", 칸: "사이트맵", ...못함(s, "사이트맵") });

  // llms.txt
  const l = d.llmsTxt;
  if (l?.ok === true) 줄.push({ id: "llms", 칸: "llms.txt", 상태: 됨, 사람말: `${base}/llms.txt 가 글자 파일로 열립니다` });
  else if (l?.ok === false) {
    const 지금 = l.status !== 200 ? `지금은 없습니다(${l.status})` : String(l.head ?? "").trimStart().startsWith("<") ? "지금 주소는 열리는데 웹페이지(HTML)가 나옵니다" : `지금은 글자 파일이 아닙니다(${l.type || "형식 없음"})`;
    줄.push({ id: "llms", 칸: "llms.txt", 상태: 기다림, 사람말: `${지금} — 고객 담당에게 보낼 글에 넣었습니다` });
    보낼것.push(`${base}/llms.txt 파일을 만들어 주세요. 글자 파일(text/plain)이고, 첫 줄은 「# ${row.name}」, 그 아래 두세 줄로 무엇을 하는 곳인지 적습니다. ${지금}.`);
  } else 줄.push({ id: "llms", 칸: "llms.txt", ...못함(l, "llms.txt") });

  // 홈 JSON-LD
  if (Array.isArray(d.homeLdTypes) && d.homeLdTypes.length) 줄.push({ id: "jsonld", 칸: "홈 JSON-LD", 상태: 됨, 사람말: `홈에 ${d.homeLdTypes.join(", ")}` });
  else if (Array.isArray(d.homeLdTypes)) {
    줄.push({ id: "jsonld", 칸: "홈 JSON-LD", 상태: 기다림, 사람말: "홈에 JSON-LD 가 없습니다 — 고객 담당에게 보낼 글에 넣었습니다" });
    보낼것.push(`홈 첫 화면 HTML 에 JSON-LD(<script type="application/ld+json">)로 상호·주소·전화·사이트 주소를 넣어 주세요. 지금 홈에는 없습니다.`);
  } else 줄.push({ id: "jsonld", 칸: "홈 JSON-LD", ...못함(h, "홈") });

  // IndexNow 키 파일
  const k = c.indexnow;
  const kf = d.indexnowFile;
  if (!(k && k.mode === "우리" && k.key)) 줄.push({ id: "keyfile", 칸: "IndexNow 키 파일", 상태: 없음, 사람말: "우리가 색인 알림을 보내지 않는 고객입니다" });
  else if (kf?.ok === true) 줄.push({ id: "keyfile", 칸: "IndexNow 키 파일", 상태: 됨, 사람말: `${base}/${k.key}.txt 가 열리고 내용이 맞습니다. 매일 새벽 색인 알림을 보냅니다` });
  else if (kf?.ok === false) {
    const 지금 = kf.status !== 200 ? `지금은 없습니다(${kf.status})` : "지금 파일은 열리는데 내용이 다릅니다";
    줄.push({ id: "keyfile", 칸: "IndexNow 키 파일", 상태: 기다림, 사람말: `${지금} — 고객 담당에게 보낼 글에 넣었습니다` });
    보낼것.push(`${base}/${k.key}.txt 파일을 올려 주세요. 내용은 이 한 줄입니다: ${k.key}  — 새 글을 빙·네이버에 바로 알리는 열쇠입니다. ${지금}.`);
  } else 줄.push({ id: "keyfile", 칸: "IndexNow 키 파일", ...못함(kf, "키 파일") });

  // 고객 담당에게 보낼 것 — 위 다섯 중 빠진 것을 한 묶음
  const 사이트칸 = 줄.filter((x) => ["robots", "sitemap", "llms", "jsonld", "keyfile"].includes(x.id));
  if (보낼것.length) {
    const 글 = [`안녕하세요. ${row.name} 사이트(${base})에서 아래 ${보낼것.length}가지를 반영해 주시면 됩니다.`, "",
      ...보낼것.map((x, i) => `${i + 1}. ${x}`), "", "반영되면 알려 주세요. 저희가 다시 열어 확인합니다."].join("\n");
    줄.push({ id: "send", 칸: "고객 담당에게 보낼 것", 상태: 사람, 사람말: `${보낼것.length}가지 — 아래 글을 복사해 고객 담당에게 보내 주세요`, 할일: 글 });
  } else if (사이트칸.some((x) => x.상태 === 기다림)) {
    줄.push({ id: "send", 칸: "고객 담당에게 보낼 것", 상태: 기다림, 사람말: "못 연 칸이 있어 아직 정하지 않았습니다" });
  } else 줄.push({ id: "send", 칸: "고객 담당에게 보낼 것", 상태: 됨, 사람말: "보낼 것이 없습니다" });

  // 구글 서치콘솔 권한
  if (c.wantGsc === false) 줄.push({ id: "gsc", 칸: "구글 서치콘솔 권한", 상태: 없음, 사람말: "구글 색인 요청을 안 쓰기로 했습니다" });
  else if (c.gsc === true) 줄.push({ id: "gsc", 칸: "구글 서치콘솔 권한", 상태: 됨, 사람말: "권한을 받았다고 표시했습니다. 원장 PC 가 매일 구글 색인 요청을 돕니다" });
  else 줄.push({ id: "gsc", 칸: "구글 서치콘솔 권한", 상태: 사람, 사람말: "권한을 받아야 구글 색인 요청을 돌릴 수 있습니다",
    할일: `고객에게 구글 서치콘솔의 ${domain} 속성에 우리 구글 계정을 「전체」 권한 사용자로 넣어 달라고 요청합니다. 받으면 이 화면의 「권한 받음」을 누릅니다.` });

  // AI 측정 — 외부 고객은 파일럿·질문 승인이 있어야 잰다
  if (row.relation !== "외부") 줄.push({ id: "measure", 칸: "AI 측정(파일럿·질문 승인)", 상태: 없음, 사람말: "자사는 파일럿 없이 잽니다(리허설은 따로)" });
  else if (!pilot) 줄.push({ id: "measure", 칸: "AI 측정(파일럿·질문 승인)", 상태: 사람, 사람말: "파일럿이 없어 AI 답을 아직 안 잽니다",
    할일: "계약이 되면 이 화면의 「파일럿 시작」에 담당자·입금·약관 칸을 넣습니다. 질문 20개가 만들어집니다." });
  else if (!pilot.approved) 줄.push({ id: "measure", 칸: "AI 측정(파일럿·질문 승인)", 상태: 기다림, 사람말: "고객이 질문 20개를 승인하면 첫 측정을 시작합니다" });
  else 줄.push({ id: "measure", 칸: "AI 측정(파일럿·질문 승인)", 상태: 됨, 사람말: "질문이 승인돼 AI 답을 잽니다" });

  줄.push({ id: "offsite", 칸: "바깥 글", 상태: 없음, 사람말: "꺼짐 — 다음 단계에서 켭니다" });
  return 줄;
}

export const 요약 = (줄) => ({ 사람: 줄.filter((x) => x.상태 === 사람).length, 기다림: 줄.filter((x) => x.상태 === 기다림).length });

/** 고객의 파일럿(리허설·취소 빼고) — 체크리스트 measure 칸 */
export async function 파일럿상태(q, clientId) {
  const [p] = await q(`select p.id, p.status, p.questions_approved_at is not null as approved
      from geo.pilots p where p.client_id = $1 and p.status <> '리허설' and p.cancelled_on is null order by p.id limit 1`, [clientId])
    .catch(() => []);
  return p ?? null;
}

// ─────────────────────────────────────────── 사람 일감 동기화
const 일감제목 = {
  send: (n) => `${n}: 고객 담당에게 보낼 것이 있습니다`,
  gsc: (n) => `${n}: 구글 서치콘솔 권한을 받아 주세요`,
  measure: (n) => `${n}: 파일럿을 시작해 주세요`,
};

/**
 * 체크리스트 → 열 일감·닫을 일감. 순수.
 *   사람      → 열기 (dedupe setup-<칸>)
 *   됨        → 완료로 닫기 · 해당없음 → 닫힘 · 기다림 → 그대로(못 열었다고 일감을 껐다 켜지 않는다)
 */
export function 일감계획(row, 줄, admin = "https://geo-rose-nine.vercel.app") {
  const link = `${admin}/admin/clients/${row.slug}`;
  const 열기 = [], 닫기 = [];
  for (const x of 줄) {
    if (!일감제목[x.id]) continue;
    const key = `setup-${x.id}`;
    if (x.상태 === 사람) 열기.push({ key, title: 일감제목[x.id](row.name), detail: x.할일 ?? x.사람말, link, payload: { slug: row.slug, 칸: x.id } });
    else if (x.상태 === 됨) 닫기.push({ key, status: "완료", why: x.사람말 });
    else if (x.상태 === 없음) 닫기.push({ key, status: "닫힘", why: x.사람말 });
  }
  return { 열기, 닫기 };
}

/**
 * 일감계획 을 geo.agent_tasks 에 — 사람 대기 upsert(중복 없음) · 됨이면 닫음. 활동 줄 agent 「setup」.
 * 원장이 「끝냈어요」로 닫은 일은 24시간 뒤에도 신호가 남아 있으면 다시 연다. 점검이 닫은 일은 신호가 돌아오면 바로 연다
 * → { 열림: [key], 닫힘: [key] } (새로 열렸거나 다시 열린 것·이번에 닫은 것만)
 */
export async function 사람일감맞추기(q, row, 줄, { admin } = {}) {
  const { 열기, 닫기 } = 일감계획(row, 줄, admin);
  const 열림 = [], 닫힘 = [];
  const 활동 = (action, summary, taskId) => q(`insert into geo.agent_activity (client_id, agent, action, ok, summary, task_id) values ($1, 'setup', $2, true, $3, $4)`,
    [row.id, action, String(summary).slice(0, 1000), taskId]);
  for (const t of 열기) {
    const [전] = await q(`select status from geo.agent_tasks where client_id = $1 and dedupe_key = $2`, [row.id, t.key]);
    const [r] = await q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority, status, link)
        values ($1, 'setup', 'setup', $2, $3, $4, $5::jsonb, 12, '사람 대기', $6)
        on conflict (client_id, dedupe_key) do update set title = excluded.title, detail = excluded.detail, link = excluded.link, updated_at = now(),
          status = case when geo.agent_tasks.status not in ('완료', '닫힘') then geo.agent_tasks.status
                        when geo.agent_tasks.status = '닫힘' or geo.agent_tasks.payload->>'닫음' = '점검'
                          or coalesce(geo.agent_tasks.done_at, now()) < now() - interval '24 hours' then '사람 대기'
                        else geo.agent_tasks.status end,
          done_at = case when geo.agent_tasks.status not in ('완료', '닫힘') then geo.agent_tasks.done_at
                         when geo.agent_tasks.status = '닫힘' or geo.agent_tasks.payload->>'닫음' = '점검'
                           or coalesce(geo.agent_tasks.done_at, now()) < now() - interval '24 hours' then null
                         else geo.agent_tasks.done_at end,
          payload = case when geo.agent_tasks.status in ('완료', '닫힘') then excluded.payload else geo.agent_tasks.payload || excluded.payload end
        returning id, status`,
      [row.id, t.key, t.title, t.detail, JSON.stringify(t.payload), t.link]);
    if (r.status === "사람 대기" && (!전 || ["완료", "닫힘"].includes(전.status))) {
      열림.push(t.key);
      await 활동(전 ? "일감 다시 엶" : "일감 엶", t.title, r.id);
    }
  }
  for (const t of 닫기) {
    const rows = await q(`update geo.agent_tasks set status = $3, done_at = now(), updated_at = now(),
          evidence = left(evidence || E'\n' || $4, 4000), payload = payload || '{"닫음":"점검"}'::jsonb
        where client_id = $1 and dedupe_key = $2 and status not in ('완료', '닫힘') returning id, title`,
      [row.id, t.key, t.status, `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16)} 점검: ${t.why}`]);
    for (const x of rows) { 닫힘.push(t.key); await 활동("일감 닫음", `${x.title} — ${t.why}`, x.id); }
  }
  return { 열림, 닫힘 };
}

/**
 * 매시 재점검할 고객 — active · 코드 고객 아님 · 점검 없음 또는 24시간 지남. 오래된 것부터 max 곳. 순수(시험용)
 * rows: { id, slug, status, derived }
 */
export function 재점검고르기(rows, now = Date.now(), max = 3) {
  const 언제 = (r) => { const t = Date.parse(r.derived?.checkedAt ?? ""); return Number.isFinite(t) ? t : 0; };
  return rows
    .filter((r) => r.status === "active" && !CODE_SLUGS.includes(r.slug) && now - 언제(r) >= 24 * 3600 * 1000)
    .sort((a, b) => 언제(a) - 언제(b) || a.id - b.id)
    .slice(0, max);
}

/** 한 고객: 점검 → derived → 체크리스트 → 사람 일감. 화면 E2E·회사 루프가 같은 길 */
export async function 점검하고맞추기(q, row, { fetch, admin } = {}) {
  const derived = await 점검저장(q, row, fetch ? { fetch } : {});
  const 줄 = 체크리스트(row, derived, { pilot: await 파일럿상태(q, row.id) });
  const 일감 = await 사람일감맞추기(q, row, 줄, { admin });
  const n = 요약(줄);
  await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1, 'setup', '세팅 점검', $2, $3)`,
    [row.id, !derived.errors.length, `사람 ${n.사람} · 기다림 ${n.기다림}${derived.errors.length ? ` · 못 연 곳 ${derived.errors.length}` : ""}`]);
  return { derived, 줄, 일감 };
}

/** 회사 루프 매시 — 고른 고객마다 점검하고맞추기. 한 곳이 실패해도 다음 곳 */
export async function 세팅재점검(q, { now = Date.now(), max = 3, admin, log = console.log } = {}) {
  const rows = (await q(`select to_jsonb(c) as r from geo.clients c where c.status = 'active' order by c.id`)).map((x) => x.r);
  const 고른 = 재점검고르기(rows, now, max);
  for (const row of 고른) {
    try {
      const { 줄, 일감 } = await 점검하고맞추기(q, row, { admin });
      const n = 요약(줄);
      log(`  세팅 점검 ${row.slug}: 사람 ${n.사람} · 기다림 ${n.기다림}${일감.열림.length ? ` · 엶 ${일감.열림.join(",")}` : ""}${일감.닫힘.length ? ` · 닫음 ${일감.닫힘.join(",")}` : ""}`);
    } catch (e) {
      log(`  ⚠ 세팅 점검 ${row.slug} 실패 — ${String(e?.message ?? e).slice(0, 160)}`);
    }
  }
  return 고른.map((r) => r.slug);
}

// ─────────────────────────────────────────── 지우기 (시험 고객만)
/** 표 이름을 SQL 에 넣기 전에 — information_schema 에서 온 이름이라도 모양을 본다 */
const 표이름 = (t) => { if (!/^(geo|academy)\.[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`표 이름 모양이 이상함: ${t}`); return t; };

/**
 * 시험 고객 한 곳을 지운다. status 'test' 가 아니면 거부(서버에서 다시 읽어 본다).
 * geo·academy 의 client_id·pilot_id 칸 표 전부를 한 tx 에서 — FK 순서는 pg_constraint 로 자식부터.
 * 끝에 남은 행을 세서 0 이 아니면 rollback 하고 { ok:false, err:'left' }. 다른 오류는 rollback 뒤 던진다
 */
export async function 지우기(q, slug) {
  if (CODE_SLUGS.includes(slug)) return { ok: false, err: "code-client" };
  await q("begin");
  try {
    const [c] = await q(`select id, status from geo.clients where slug = $1 for update`, [slug]);
    if (!c) { await q("rollback"); return { ok: false, err: "not-found" }; }
    if (c.status !== "test") { await q("rollback"); return { ok: false, err: "not-test" }; }
    const 칸들 = await q(`select c.table_schema || '.' || c.table_name as t, c.column_name as col
        from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema in ('geo', 'academy') and t.table_type = 'BASE TABLE' and c.column_name in ('client_id', 'pilot_id')`);
    const 파일럿 = (await q(`select id::text as id from geo.pilots where client_id = $1`, [c.id])).map((r) => r.id);
    const 조건 = (col) => (col === "client_id" ? [`client_id::text = $1::text`, [String(c.id)]] : [`pilot_id::text = any($1::text[])`, [파일럿]]);
    const 표들 = [...new Set(칸들.map((x) => 표이름(x.t)))].filter((t) => t !== "geo.clients");
    // FK: 자식 → 부모. 남은 표 중 아무도 가리키지 않는 표부터 지운다
    const fk = await q(`select cn.nspname || '.' || cl.relname as child, pn.nspname || '.' || pl.relname as parent
        from pg_constraint k join pg_class cl on cl.oid = k.conrelid join pg_namespace cn on cn.oid = cl.relnamespace
        join pg_class pl on pl.oid = k.confrelid join pg_namespace pn on pn.oid = pl.relnamespace where k.contype = 'f'`);
    const 남은 = new Set(표들), 순서 = [];
    while (남은.size) {
      const 다음 = [...남은].find((t) => !fk.some((e) => e.parent === t && e.child !== t && 남은.has(e.child)));
      if (!다음) throw new Error(`FK 가 돌고 돌아 지울 순서를 못 정함: ${[...남은].join(", ")}`);
      순서.push(다음); 남은.delete(다음);
    }
    const 지운 = {};
    for (const t of 순서) {
      for (const { col } of 칸들.filter((x) => x.t === t)) {
        if (col === "pilot_id" && !파일럿.length) continue;
        const [w, p] = 조건(col);
        const rows = await q(`with d as (delete from ${t} where ${w} returning 1) select count(*)::int as n from d`, p);
        if (rows[0].n) 지운[t] = (지운[t] ?? 0) + rows[0].n;
      }
    }
    await q(`delete from geo.clients where id = $1`, [c.id]);
    let 남음 = 0;
    for (const { t, col } of 칸들) {
      if (col === "pilot_id" && !파일럿.length) continue;
      const [w, p] = 조건(col);
      남음 += (await q(`select count(*)::int as n from ${표이름(t)} where ${w}`, p))[0].n;
    }
    남음 += (await q(`select count(*)::int as n from geo.clients where slug = $1 or id = $2`, [slug, c.id]))[0].n;
    if (남음) { await q("rollback"); return { ok: false, err: "left", 남음 }; }
    await q("commit");
    return { ok: true, id: c.id, 지운 };
  } catch (e) {
    await q("rollback");
    throw e;
  }
}

// ─────────────────────────────────────────── 현황판 글·유통 줄 (web/lib/agents.ts pipeOf · KG-37-2)
/**
 * 코드 3곳 밖(geo.clients 에만 있는) 고객에 실제로 도는 일 — config·derived 로.
 *   indexnow  config.indexnow 가 「우리」+키 이고 점검이 키 파일을 열어 내용이 맞았을 때(indexnow.mjs 가 보내기 전에 보는 것과 같은 조건)
 *   marketing config.marketing.enabled === true
 *   posts     없음 — 사이트 글 길(write.yml)은 학원만
 */
export function 파이프(config, derived) {
  const c = config && typeof config === "object" ? config : {};
  const d = derived && typeof derived === "object" ? derived : {};
  return {
    posts: false,
    indexnow: c.indexnow?.mode === "우리" && !!c.indexnow?.key && d.indexnowFile?.ok === true,
    marketing: c.marketing?.enabled === true,
  };
}
