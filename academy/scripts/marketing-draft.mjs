/**
 * 바깥 글 초안 — 지식iN 답변 · 카페 글 · 블로그 글 (Step 35 D53, 원장 2026-10-02 「단기간 집중적으로」「쉼없이」).
 *
 * 하루 지식iN 1 · 카페 1, 블로그는 clients.mjs marketing.blogDays(월·목). 고객 사이트 밖에 올릴 글이다.
 * 올리는 것은 사람이다 — 지식iN·카페는 원장 손으로만(스팸·계정 정지 위험), 블로그는 원장이 확인한 뒤 로컬 에이전트가(D55).
 *
 * 근거는 그날 실제로 가져온 고객 페이지 본문뿐이다. 숫자는 그 본문에 있어야 한다(숫자 게이트 — slop-rules 「근거 없는 숫자」).
 * 페이지에 없는 숫자·기관 한도는 버린다. 사이트맵에 없는 주소는 근거로도 링크로도 안 쓴다(비공개 도구가 새지 않게).
 *
 * 대상 질문: 승인 검색어(keyword) 가운데 최근 7일 이름이 안 나온 것부터. 같은 채널에서 14일 안에 쓴 질문은 다시 안 쓴다.
 *
 *   node scripts/marketing-draft.mjs --client docttak                 오늘 몫을 써서 geo.marketing_posts 에 넣는다
 *   node scripts/marketing-draft.mjs --client docttak --dry           쓰고 표준출력만(숫자 대조표 포함). DB 는 읽기만
 *   node scripts/marketing-draft.mjs --client docttak --channels jisikin,cafe,blog   요일 규칙 대신 이 채널만
 *   node scripts/marketing-draft.mjs --client docttak --no-claude     --dry 처럼 읽기만 하고 Claude 는 안 부른다. 검색어·페이지·근거까지만 찍는다(Step 37 회귀·시험)
 *   --max-calls N   이번 실행의 Claude 호출 상한(기본 5 — 채널 셋 + 다시 쓰기 둘). 측정 아닌 몫(하루 18)을 같이 쓴다
 *
 * 끝 코드: 0 정상(한도로 건너뛴 것 포함) · 1 실패
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadClients, lit } from "../clients.mjs";
import { 클로드코드, 클로드기록연결 } from "./claude-code.mjs";
import { 검사, 숫자뽑기, 최소길이, 문장들 } from "./slop-rules.mjs";
import { 금지, 파싱, 공통짜임새 } from "./writer-common.mjs";
import { MARKETING_DDL, CHANNEL_NAME, spotsNote } from "../../web/lib/marketing-core.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const 안부름 = process.argv.includes("--no-claude");
const DRY = process.argv.includes("--dry") || 안부름;
const SLUG = arg("--client");
const 지정채널 = arg("--channels")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const 호출상한 = Number(arg("--max-calls") ?? 5);

/** 채널마다 본문 길이 하한. 블로그는 학원 글과 같은 하한(slop-rules 최소길이), 나머지는 답·공유 글 길이 */
const 하한 = { jisikin: 200, cafe: 500, blog: 최소길이 };
/** 노출·효과 보장, 남의 후기처럼 쓰기 — 브리프 「하지 말 것」. 고객 고유 금지 말은 c.marketing.banned 가 뒤에 붙는다 */
const 공통금지말 = [
  { re: /보장|무조건|1위|100\s*%/g, why: "노출·효과 보장 말" },
  { re: /후기|써\s?봤|사용해\s?봤|써\s?보니/g, why: "후기처럼 쓰기(본인 제작 도구)" },
];

const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const 요일 = new Date(`${오늘}T00:00:00Z`).getUTCDay();

// ─────────────────────────────────────────── 페이지 읽기
const 엔티티 = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const 풀기 = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (m, k) => {
  if (엔티티[k]) return 엔티티[k];
  if (/^#x/i.test(k)) return String.fromCodePoint(parseInt(k.slice(2), 16));
  if (/^#\d/.test(k)) return String.fromCodePoint(Number(k.slice(1)));
  return m;
});

/** <main> 본문을 글자로. 줄 단위로 남겨야 대조표가 원문 줄을 보여 준다 */
export function 본문글(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html;
  return 풀기(main
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<(br|\/p|\/li|\/h\d|\/tr|\/div|\/td|\/th|\/dt|\/dd)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .split("\n").map((s) => s.trim()).filter(Boolean).join("\n");
}

/** 페이지 안 바깥 링크(공식 출처) — 본문에 넣어도 되는 주소는 이것과 사이트맵뿐 */
const 바깥링크 = (html, domain) =>
  [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => 풀기(m[1])).filter((h) => !h.includes(domain));

/** 「출처: 외교부 여권안내 (여권) · 확인일 …」 → 「외교부」. 지식iN 답에 공식 길을 한 번은 대게 하는 데 쓴다 */
const 출처기관 = (글) =>
  [...new Set([...글.matchAll(/^출처:\s*([^·\n]+)/gm)].map((m) => m[1].split(/\s+—\s+|\s\(/)[0].trim().split(/\s+/)[0]).filter(Boolean))];

async function 가져오기(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (cited marketing-draft)" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.text();
}

// ─────────────────────────────────────────── 대상 고르기
/**
 * 순수 함수 — 가짜 행으로 시험한다.
 *   질문들   [{ text, position }]  승인 검색어
 *   이름     Map(text → 최근 7일 이름이 나온 횟수)
 *   쓴것     [{ channel, target_query, created_on }]  최근 14일 초안(상태 무관)
 *   채널들   오늘 쓸 채널
 *   맞는페이지 (text) → 페이지 줄 | null
 * 돌려주는 것 Map(channel → 질문 text). 같은 날 두 채널이 같은 질문을 안 쓴다
 */
export function 대상고르기(질문들, 이름, 쓴것, 채널들, 맞는페이지) {
  // 질문 다섯이 같은 안내 페이지(pdf 합치기)를 쓴다 — 질문만 돌리면 며칠 내리 같은 주제가 된다. 페이지도 오래 안 쓴 것부터
  const 마지막 = new Map();
  const 늦은날 = (k, d) => { if (!마지막.has(k) || 마지막.get(k) < d) 마지막.set(k, d); };
  for (const r of 쓴것) { 늦은날(`q:${r.target_query}`, r.created_on); 늦은날(`g:${맞는페이지(r.target_query)?.guide}`, r.created_on); }
  const 쓴날 = (k) => 마지막.get(k) ?? "";
  const 줄 = 질문들
    .filter((x) => 맞는페이지(x.text))
    .sort((a, b) => (이름.get(a.text) ?? 0) - (이름.get(b.text) ?? 0)
      || 쓴날(`g:${맞는페이지(a.text).guide}`).localeCompare(쓴날(`g:${맞는페이지(b.text).guide}`))
      || 쓴날(`q:${a.text}`).localeCompare(쓴날(`q:${b.text}`))
      || a.position - b.position);
  const 고름 = new Map();
  for (const ch of 채널들) {
    const 이채널 = new Set(쓴것.filter((r) => r.channel === ch).map((r) => r.target_query));
    const 오늘페이지 = new Set([...고름.values()].map((t) => 맞는페이지(t).guide));
    const 후보 = 줄.filter((q) => !이채널.has(q.text) && ![...고름.values()].includes(q.text));
    // 같은 날 두 채널은 다른 페이지로 — 남은 후보가 한 페이지뿐이면 그것이라도
    const x = 후보.find((q) => !오늘페이지.has(맞는페이지(q.text).guide)) ?? 후보[0];
    if (x) 고름.set(ch, x.text);
  }
  return 고름;
}

// ─────────────────────────────────────────── 프롬프트
/** 소개꾼이 되지 않게 다른 길을 한 번 — 원문 페이지가 말한 대안만. 없으면 제출처 공고 확인 정도 (Arch 2026-10-02) */
const 대안말 = (c, p) => p.대안.length
  ? `${c.name} 말고 다른 방법도 한 번은 알려 준다 — 원문 페이지가 언급한 대안(${p.대안.join(", ")}) 가운데 맞는 것 하나를 원문에 적힌 범위에서.`
  : `${c.name} 말고 다른 방법은 원문에 없으니 「제출처 공고에서 확인」 한 줄만 적는다. 다른 도구·앱을 지어내지 않는다.`;

const 채널말 = {
  jisikin: (c, p) => [
    `네이버 지식iN 에 「${p.query}」 비슷한 질문을 한 사람에게 다는 답이다. 질문자에게 직접 말하는 해요체.`,
    "첫 문장이 답이다. 인사·공감·서론 없이 바로 규격·방법을 말한다.",
    "본문 300~700자. 문단 2~4개.",
    `${c.name} 링크는 정확히 하나: ${p.tool}`,
    대안말(c, p),
    "title 칸에는 이 답을 달 만한 질문 예를 질문자 말투 한 줄로 쓴다(원장이 실제 질문을 찾을 때 쓴다).",
  ],
  cafe: (c, p) => [
    `네이버 카페에 올리는 정보 공유 글이다. 주제는 「${p.query}」. 제목은 「○○ 정리」 꼴.`,
    "본문 600~1200자. 짧은 줄과 문단. 표 문법(|) 대신 「항목: 값」 줄.",
    `${c.name} 링크는 한두 개만: ${p.guide} 또는 ${p.tool}`,
    대안말(c, p),
  ],
  blog: (c, p) => [
    `네이버 블로그 글이다. 검색어는 「${p.query}」. 제목은 사람이 검색창에 치는 질문형.`,
    `본문 ${최소길이 + 100}~2600자. 소제목은 ## 로 2~4개. 문단 80~400자.`,
    `안내 페이지를 그대로 옮기지 않는다. 같은 사실을 다른 상황에 대어 쓴다${c.marketing.situations ? `(예: ${c.marketing.situations})` : ""}.`,
    "상황은 「~할 때」 꼴의 가정으로만 쓴다. 누가 겪은 일처럼(한 학생이·지난주 상담에서) 쓰지 않는다.",
    `원문 안내 페이지 링크를 꼭 한 번 넣는다: ${p.guide}`,
  ],
};

export function 프롬프트(c, ch, p, 고칠것 = []) {
  return [
    c.marketing.persona ?? `너는 ${c.name}(${c.domain}) 쪽 사람이다. 소속을 숨기지 않고 밝히며 정보를 나눈다.`,
    "",
    "## 이번 글",
    ...채널말[ch](c, p).map((s) => `- ${s}`),
    `- 본문 맨 끝 줄은 이 문장 그대로: ${c.marketing.disclosure}`,
    "",
    "## 지어내지 않는다 (제일 중요)",
    "- 숫자(규격·픽셀·용량·쪽수·개수·날짜)는 아래 「근거」 원문에 있는 것만, 단위까지 그대로 쓴다. 원문에 없는 숫자는 하나도 쓰지 않는다.",
    "- 숫자가 없는 문장도 원문 페이지에 있는 내용을 바꿔 말한 것만 쓴다. 원문에 없는 조언·원인 짐작·일반론(「대부분 ~ 때문」 같은 말)은 쓰지 않는다.",
    "- 기관의 한도·규격이 근거에 없으면 지어내지 말고 「그 기관 공고에서 확인」이라고 쓴다.",
    "- 써 봤다·후기·추천받았다 같은 말을 쓰지 않는다. 남의 말을 따옴표로 만들지 않는다.",
    "- 노출·효과를 보장하는 말(무조건, 1위, 100%)을 쓰지 않는다. 불안을 팔지 않는다.",
    `- ${c.name}이 안 하는 것·안 맞는 경우를 근거에 적힌 범위에서 한 번은 말한다.`,
    `- 근거 밖의 주소를 쓰지 않는다. 링크는 위에 준 ${c.name} 주소와 근거에 적힌 공식 출처만.`,
    "",
    "## AI 가 쓴 티 (전부 금지)",
    ...금지.map((s) => `- ${s}`),
    "- 「~하세요」「~해 보세요」를 한 문단에 세 번 넘게 쓰지 않는다.",
    "- 문장을 짧게 끊는다. 번역체를 쓰지 않는다.",
    "",
    ...(고칠것.length ? ["## 지난 판이 걸린 곳 — 이것만 고쳐 다시 쓴다", ...고칠것.map((s) => `- ${s}`), ""] : []),
    `## 근거 — 오늘 가져온 ${c.name} 페이지 원문`,
    p.사실,
    ...p.페이지.map((x) => `\n### ${x.url}\n${x.글.slice(0, 5000)}`),
    "",
    "## 출력",
    '마크다운 본문을 담은 JSON 하나만: {"title": "...", "body": "..."}',
  ].join("\n");
}

// ─────────────────────────────────────────── 게이트
const 우리주소 = (s, domain) =>
  [...new Set([...s.matchAll(new RegExp(`https?://(?:www\\.)?${domain.replace(/\./g, "\\.")}[^\\s)\\]」>"'<,]*`, "gi"))]
    .map((m) => m[0].replace(/[.。]+$/, "")))];
const 경로 = (u) => { try { const x = new URL(u); return x.pathname.endsWith("/") ? x.pathname : `${x.pathname}/`; } catch { return null; } };

/** 걸린 이유 목록. 비면 통과 */
export function 관문(ch, post, p, c) {
  const 이유 = [];
  const title = String(post?.title ?? "").trim();
  const body = String(post?.body ?? "").trim();
  if (!title || !body) return ["제목이나 본문이 비었습니다"];

  const g = 검사(`# ${title}\n\n${body}`, { 근거: p.근거 });
  // 블로그만 학원 글과 같은 길이 하한 — 지식iN·카페는 아래 채널 하한으로 본다
  for (const x of g.치명) if (ch === "blog" || !/^본문 \d+자$/.test(x.why)) 이유.push(`${x.why}: ${x.sample.join(" / ")}`);
  /**
   * slop-rules 는 한 자리 숫자를 학원 단위(명·곳·회…)가 붙을 때만 본다. 문서딱 글은 「5 MB」「3 cm」 같은 한 자리 규격이 핵심이라
   * 그 단위가 붙은 한 자리 수는 숫자와 단위가 같이 원문에 있어야 한다(띄어쓰기는 무시)
   */
  const 붙임 = (s) => s.replace(/(\d)\s+(?=[A-Za-z가-힣])/g, "$1");
  const 원문붙임 = 붙임(p.근거);
  for (const m of `${title}\n${body}`.replace(/https?:\/\/\S+/g, " ").matchAll(/(?<![\d.,])(\d(?:\.\d+)?)\s*(MB|KB|GB|cm|mm|픽셀|px|쪽|장|개월|단계)/gi)) {
    if (!new RegExp(`(?<![\\d.])${m[1].replace(".", "\\.")}${m[2]}`, "i").test(원문붙임)) 이유.push(`근거 없는 규격 숫자: ${m[0]}`);
  }
  if (body.length < 하한[ch]) 이유.push(`본문 ${body.length}자 — ${CHANNEL_NAME[ch]} 하한 ${하한[ch]}자`);
  for (const s of 공통짜임새(body)) 이유.push(s);
  for (const m of [...공통금지말, ...(c.marketing.banned ?? [])]) {
    const hits = `${title}\n${body}`.match(m.re);
    if (hits) 이유.push(`${m.why}: ${[...new Set(hits)].join(", ")}`);
  }
  if (!body.includes(c.marketing.disclosure)) 이유.push(`끝에 공개 문장이 없습니다: ${c.marketing.disclosure}`);

  // 주소 — 고객 주소는 오늘 사이트맵에 있어야 하고, 바깥 주소는 근거 페이지에 적힌 공식 출처여야 한다
  const 우리 = 우리주소(body, c.domain);
  for (const u of 우리) if (!p.사이트맵.has(경로(u))) 이유.push(`사이트맵에 없는 주소: ${u}`);
  const 바깥 = [...body.matchAll(/https?:\/\/[^\s)\]」>"'<]+/g)].map((m) => m[0].replace(/[.,]+$/, "")).filter((u) => !u.includes(c.domain));
  // 근거 주소 그대로이거나 그 앞부분(공식 사이트 첫 화면)만 — 근거가 첫 화면일 때 그 아래 아무 경로나 지어내는 걸 막는다
  const 끝빗금 = (x) => x.replace(/\/+$/, "");
  for (const u of 바깥) if (!p.바깥.some((h) => 끝빗금(h).startsWith(끝빗금(u)))) 이유.push(`근거에 없는 바깥 주소: ${u}`);
  const 경로들 = new Set(우리.map(경로));
  if (ch === "jisikin") {
    if (경로들.size !== 1 || !경로들.has(경로(p.tool))) 이유.push(`${c.name} 링크는 도구 주소 하나여야 합니다(${p.tool}) — 지금 ${우리.length}개`);
  }
  if (ch !== "blog") {
    if (p.대안.length ? !p.대안.some((k) => body.includes(k)) : !/공고/.test(body)) {
      이유.push(p.대안.length ? `다른 방법을 안 알렸습니다 — 원문 대안: ${p.대안.join(", ")}` : "다른 방법이 원문에 없으면 「제출처 공고에서 확인」을 적습니다");
    }
  }
  if (ch === "cafe" && (경로들.size < 1 || 경로들.size > 2)) 이유.push(`${c.name} 링크는 한두 개 — 지금 ${경로들.size}개`);
  if (ch === "blog" && !경로들.has(경로(p.guide))) 이유.push(`원문 안내 페이지 링크가 없습니다: ${p.guide}`);
  return 이유;
}

/**
 * 원문 페이지가 언급한 다른 길 — 출처 기관 + 원문에 실제로 나온 공식 사이트·기본 앱·프로그램 이름.
 * 이름 목록은 고객 설정(c.marketing.alternatives)이다. 원문에 없는 이름은 후보가 안 된다
 */
// 브라우저·「파일」 앱은 고객 도구를 쓰는 길이라 대안이 아니다. 「함께 보면 좋은 안내」·「바로 쓰는 도구」 뒤는 다른 주제 링크라 안 본다
const 본론 = (글) => 글.split(/\n(?:함께 보면 좋은 안내|관련 안내|바로 쓰는 도구)\n/)[0];
export const 대안찾기 = (글들, 기관 = [], 이름들 = []) => [...new Set([...기관, ...이름들.filter((w) => 글들.some((g) => 본론(g).includes(w)))])];

/**
 * 원문에 없는 문장 후보 — 본문 문장마다 글자 3자 조각이 원문에 몇 % 있나. 낮은 문장이 「읽을 자리」다(Arch 2026-10-02).
 * 숫자 게이트가 못 잡는, 숫자 없는 지어낸 조언·원인·일반론을 사람이 먼저 보게 한다. 거르지는 않는다 — 판단은 원장
 */
export function 낯선문장(body, 근거, { 선 = 0.5, 최대 = 5 } = {}) {
  const 납 = (t) => t.replace(/https?:\/\/\S+/g, "").replace(/[\s.,·!?「」『』()[\]*#:;"'~\-–—…]/g, "");
  const 원문 = 납(근거);
  const 조각 = new Set();
  for (let i = 0; i + 3 <= 원문.length; i++) 조각.add(원문.slice(i, i + 3));
  return 문장들(body)
    .filter((t) => !/^#/.test(t) && 납(t).length >= 12)
    .map((t) => {
      const n = 납(t);
      let 있음 = 0, 전체 = 0;
      for (let i = 0; i + 3 <= n.length; i++) { 전체++; if (조각.has(n.slice(i, i + 3))) 있음++; }
      return { 문장: t, 겹침: 전체 ? 있음 / 전체 : 1 };
    })
    .filter((x) => x.겹침 < 선)
    .sort((a, b) => a.겹침 - b.겹침)
    .slice(0, 최대);
}

/** 본문 숫자 하나하나가 원문 어느 줄에 있나 — 사람이 대조할 표 */
export function 대조표(text, p) {
  const 줄들 = [{ url: "(고정 사실)", 줄: p.사실 }, ...p.페이지.flatMap((x) => x.글.split("\n").map((줄) => ({ url: x.url, 줄 })))];
  const 납작 = (s) => s.replace(/(\d),(?=\d{3})/g, "$1").replace(/\s/g, "");
  // 게이트가 거는 숫자(숫자뽑기)와 규격 단위가 붙은 한 자리 수. 본문에서 바로 뒤 단위까지 떼어 와 그 꼴이 든 원문 줄을 먼저 찾는다
  const 걸린수 = new Set(숫자뽑기(text).filter((x) => !x.날짜).map((x) => x.수));
  const 날짜 = 숫자뽑기(text).filter((x) => x.날짜).map((x) => ({ 토막: x.토막, 찾을: x.토막 }));
  const 수들 = [...text.replace(/https?:\/\/\S+/g, " ").replace(/[A-Za-z][A-Za-z-]*\d[\w.-]*/g, " ")
    .matchAll(/(?<![\d.,])(\d[\d,]*(?:\.\d+)?)\s*(MB|KB|GB|cm|mm|ppi|픽셀|px|쪽|장|개월|단계|%|[가-힣]{0,2})/gi)]
    .map((m) => ({ 수: m[1].replace(/,/g, ""), 단위: m[2] }))
    .filter((x) => 걸린수.has(x.수) || (x.수.replace(/\D/g, "").length < 2 && /^(MB|KB|GB|cm|mm|픽셀|px|쪽|장|개월|단계)$/i.test(x.단위)))
    .map((x) => ({ 토막: `${x.수}${x.단위 ? ` ${x.단위}` : ""}`, 수: x.수, 단위: x.단위 }));
  return [...날짜, ...수들].map((x) => {
    const re = x.수 ? new RegExp(`(?<![\\d.])${x.수.replace(/\./g, "\\.")}(?![\\d])`) : null;
    const 후보 = 줄들.filter((l) => (re ? re.test(l.줄.replace(/(\d),(?=\d{3})/g, "$1")) : l.줄.includes(x.찾을)));
    const hit = (x.단위 && 후보.find((l) => 납작(l.줄).includes(`${x.수}${x.단위}`))) || 후보[0];
    return { 토막: x.토막, 원문: hit ? hit.줄.slice(0, 90) : "(원문에서 못 찾음)", url: hit?.url ?? "-" };
  });
}

// ─────────────────────────────────────────── 실행
/** 글을 못 쓰는 까닭(칸 이름) 또는 null. 사실이 0개면 쓰지 않는다 — 근거 없는 소속 주장을 막는다(Step 39a) */
export function 바깥글빠진칸(c) {
  if (!c) return null;
  if (c.출처 === "코드") return !c.marketing ? "marketing" : !c.marketing.facts?.length ? "marketing.facts" : null;
  return !c.marketing.enabled ? "marketing.enabled" : !c.marketing.pages.length ? "marketing.pages"
    : !c.marketing.disclosure ? "marketing.disclosure" : !c.marketing.facts?.length ? "marketing.facts" : null;
}

/**
 * 근거 맨 위 고정 사실 한 줄. 안내 글 수(guidePrefix 가 있을 때 사이트맵에서 센 것) + 사람이 확인한 사실.
 * 날짜를 넣지 않는다 — 근거 글의 「2026-10-02」가 본문의 「10」「02」를 숫자 게이트에서 통과시킨다
 */
export function 사실줄(c, 안내수) {
  const 셈 = c.marketing.guidePrefix && 안내수 != null ? [`안내 글 ${안내수}편`] : [];
  const 줄 = [...셈, ...(c.marketing.facts ?? []).map((f) => f.text.replace(/[.。]+$/, ""))].join(", ");
  return `${c.name} 고정 사실${셈.length ? "(오늘 사이트맵 기준)" : ""}: ${줄}.`;
}

async function main() {
  if (!SLUG) { console.log("사용법: node scripts/marketing-draft.mjs --client <slug> [--dry] [--channels jisikin,cafe,blog]"); process.exitCode = 1; return; }

  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const db = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 2 });
  const q = (s, v = []) => db.query(s, v).then((r) => r.rows);
  // 코드 3곳 + DB 고객(Step 37). 콕 집어 부르니 시험 고객도 찾는다
  const [c] = await loadClients(q, { slug: SLUG, includeTest: true });
  const 빠진칸 = 바깥글빠진칸(c);
  if (!c || 빠진칸) {
    console.log(!c ? `고객사 없음: ${SLUG}`
      : 빠진칸 === "marketing.facts" ? `${c.name}: 사람이 확인한 사실 목록이 비었습니다 — 건너뜀`
      : c.출처 === "코드" ? `${c.name}: 바깥 글 설정(clients.mjs marketing)이 없습니다 — 건너뜀` : `${c.slug}: ${빠진칸} 없음 — 건너뜀`);
    if (!c) process.exitCode = 1;
    await db.end().catch(() => {});
    return;
  }
  // --dry 는 DB 를 안 바꾼다 — 호출 기록(geo.claude_calls)도 안 남기고 상한은 읽기만 한다. 사람이 손으로 돌릴 때만 쓴다
  클로드기록연결(DRY ? (s, v) => (/^\s*(insert|create|alter)/i.test(s) ? Promise.resolve([]) : q(s, v)) : q);
  try {
    // 표가 없을 때 — 실제 실행은 만든다. --dry 는 DB 를 안 바꾸니 「아직 쓴 것 없음」으로 본다
    const 표없음 = (e) => (e?.code === "42P01" ? [] : Promise.reject(e));
    if (!DRY) for (const s of MARKETING_DDL) await q(s);

    const 채널들 = 지정채널 ?? ["jisikin", "cafe", ...(c.marketing.blogDays.includes(요일) ? ["blog"] : [])];
    const 오늘쓴 = new Set((await q(`select channel from geo.marketing_posts where client_id=$1 and created_on=$2::date`, [c.id, 오늘]).catch(표없음)).map((r) => r.channel));
    const 남은채널 = 채널들.filter((ch) => DRY || !오늘쓴.has(ch));
    console.log(`${c.name} 바깥 글 ${오늘} (${"일월화수목금토"[요일]}) — 채널 ${채널들.join("·")}${남은채널.length < 채널들.length ? ` · 이미 씀 ${[...오늘쓴].join("·")}` : ""}${DRY ? " · --dry" : ""}`);
    if (!남은채널.length) return;

    const 질문들 = await q(`select pq.text, pq.position from geo.pilot_questions pq join geo.pilots p on p.id = pq.pilot_id
      where p.client_id = $1 and pq.approved and pq.stage = 'keyword' order by pq.position`, [c.id]);
    if (!질문들.length) { console.log("승인된 검색어가 없습니다 — 건너뜀"); return; }
    const 이름 = new Map((await q(`select prompt_text, count(*) filter (where mentioned)::int n from academy.ai_measurements
      where client_id = $1 and measured_on > $2::date - 7 and prompt_id ~ '^q[0-9]+$' group by 1`, [c.id, 오늘])).map((r) => [r.prompt_text, r.n]));
    const 쓴것 = await q(`select channel, target_query, created_on::text from geo.marketing_posts
      where client_id = $1 and created_on > $2::date - 14`, [c.id, 오늘]).catch(표없음);
    const 맞는페이지 = (t) => c.marketing.pages.find((x) => x.re.test(t)) ?? null;
    const 고름 = 대상고르기(질문들, 이름, 쓴것, 남은채널, 맞는페이지);

    // 사이트맵 — 그날 공개된 주소만 쓴다
    const 맵 = await 가져오기(`https://${c.domain}/sitemap.xml`);
    const 사이트맵 = new Set([...맵.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => 경로(m[1].trim())).filter(Boolean));
    if (!사이트맵.size) throw new Error("사이트맵이 비었습니다");
    const 안내수 = c.marketing.guidePrefix
      ? [...사이트맵].filter((s) => new RegExp(`^${lit(c.marketing.guidePrefix)}[^/]+/$`).test(s)).length : null;
    const 사실 = 사실줄(c, 안내수);

    let 호출 = 0;
    let 실패 = 0, 오류 = 0;
    for (const ch of 남은채널) {
      const query = 고름.get(ch);
      if (!query) { console.log(`\n[${CHANNEL_NAME[ch]}] 쓸 질문이 없습니다(14일 안에 다 씀 또는 맞는 페이지 없음)`); continue; }
      const 줄 = 맞는페이지(query);
      const 주소들 = [줄.guide, 줄.tool, ...(줄.also ?? [])].filter((s) => 사이트맵.has(s));
      if (!주소들.includes(줄.guide) || !주소들.includes(줄.tool)) {
        console.log(`\n[${CHANNEL_NAME[ch]}] 「${query}」 — 페이지가 사이트맵에 없습니다(${줄.guide} · ${줄.tool}) — 건너뜀`);
        continue;
      }
      const 페이지 = [];
      const 바깥 = [];
      for (const 쪽 of 주소들) {
        const url = `https://${c.domain}${쪽}`;
        const html = await 가져오기(url).catch((e) => { console.log(`  ⚠ ${e.message}`); return null; });
        if (!html) continue;
        페이지.push({ url, 글: 본문글(html) });
        바깥.push(...바깥링크(html, c.domain));
      }
      if (페이지.length < 2) { console.log(`\n[${CHANNEL_NAME[ch]}] 「${query}」 — 페이지를 못 가져와 근거가 없습니다 — 건너뜀`); 오류++; continue; }
      const p = {
        query, 사실, 페이지, 사이트맵, 바깥: [...new Set(바깥)],
        guide: `https://${c.domain}${줄.guide}`, tool: `https://${c.domain}${줄.tool}`,
        기관: 출처기관(페이지.map((x) => x.글).join("\n")),
        근거: [사실, ...페이지.map((x) => x.글)].join("\n"),
      };
      p.대안 = 대안찾기(페이지.map((x) => x.글), p.기관, c.marketing.alternatives ?? []);
      if (안부름) {
        console.log(`\n[${CHANNEL_NAME[ch]}] 「${query}」 · 근거 ${페이지.map((x) => x.url.replace(/^https?:\/\/[^/]+/, "")).join(" · ")} · 근거 ${p.근거.length}자 — Claude 안 부름(--no-claude)`);
        continue;
      }

      let post = null, 이유 = [], 판 = 0;
      while (판 < 2 && 호출 < 호출상한) {
        판++; 호출++;
        const r = await 클로드코드(프롬프트(c, ch, p, 이유), { purpose: "marketing", timeoutMs: 4 * 60 * 1000 });
        if (!r.ok) {
          console.log(`\n[${CHANNEL_NAME[ch]}] 호출 실패: ${r.error}`);
          if (r.한도) return;              // 오늘 몫을 다 썼다 — 실패가 아니다
          오류++; post = null; 이유 = [`호출 실패: ${String(r.error).slice(0, 120)}`];
          break;
        }
        const x = 파싱(r.text);
        if (x.오류) { 이유 = [`JSON 을 못 읽었습니다: ${x.오류}`]; post = null; continue; }
        post = x.post;
        이유 = 관문(ch, post, p, c);
        if (!이유.length) break;
      }

      const 통과 = post && !이유.length;
      console.log(`\n━━━━ [${CHANNEL_NAME[ch]}] 「${query}」 ${통과 ? "통과" : "탈락"} (${판}판) · 근거 ${페이지.map((x) => x.url.replace(/^https?:\/\/[^/]+/, "")).join(" · ")}`);
      if (post) {
        console.log(`제목: ${post.title}\n\n${post.body}`);
        const 표 = 대조표(`${post.title}\n${post.body}`, p);
        console.log(`\n숫자 대조 ${표.length}개`);
        for (const t of 표) console.log(`  ${t.토막} | ${t.원문} | ${t.url.replace(/^https?:\/\/[^/]+/, "")}`);
      }
      // 읽을 자리 — 원문과 겹침이 낮은 문장(숫자 없는 지어낸 말 후보). 초안 note 에 남겨 현황판 카드가 띄운다
      // 공개 문장·「제출처 공고에서 확인」은 시킨 말이라 비교 원문에 넣는다
      const 낯선 = post ? 낯선문장(post.body ?? "", [p.근거, c.marketing.disclosure, "제출처 공고에서 확인"].join("\n")) : [];
      if (낯선.length) console.log(`\n읽을 자리(원문 겹침 낮은 문장):\n${낯선.map((x) => `  - ${Math.round(x.겹침 * 100)}% ${x.문장}`).join("\n")}`);
      if (이유.length) console.log(`\n걸린 곳:\n${이유.map((s) => `  - ${s}`).join("\n")}`);
      if (DRY) continue;
      // 탈락도 「버림」으로 남긴다 — 같은 날 다시 돌아도 호출을 또 쓰지 않고, 현황판이 왜 없는지 안다
      if (post || 이유.length) {
        await q(`insert into geo.marketing_posts (client_id, channel, target_query, source_url, title, body, status, created_on, note)
                 values ($1,$2,$3,$4,$5,$6,$7,$8::date,$9)`,
          [c.id, ch, query, p.guide, String(post?.title ?? "").slice(0, 300) || query, String(post?.body ?? ""),
            통과 ? "초안" : "버림", 오늘,
            (통과 ? spotsNote(낯선.map((x) => x.문장)) : `자동 관문 탈락: ${이유.join(" / ")}`).slice(0, 1000)]);
      }
      if (!통과 && post) 실패++;
    }
    console.log(`\nClaude 호출 ${호출}회 · 관문 탈락 ${실패} · 오류 ${오류}`);
    // 관문 탈락은 고장이 아니다(다시 쓰고도 걸리면 안 넣는다). 호출·페이지 오류만 빨간불
    if (오류) process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}

// 가져다 쓸 때(시험)는 돌지 않는다
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.log("실패:", e.message); process.exitCode = 1; });
