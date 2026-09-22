/**
 * 삽화 담당 — 에이전트가 쓴 초안에 도해를 붙인다 (Step 12).
 *
 * 2026-09-21 원장 지적 「블로그 글에 왜 이미지 삽화가 하나도 없지」. 그날 손으로 9장을 그렸지만
 * 자동 초안(write.yml 주간 글·company 겨냥 초안)에는 도해 단계가 없어 같은 일이 매주 되풀이된다.
 *
 * 학원 사이트는 git push 로 배포되지 않는다. 그래서 그림은 글처럼 DB(academy.post_images)에 두고
 * 사이트가 /blog/img/<slug>/<name>.svg 로 내보낸다(app/blog/img/[slug]/[name]/route.ts).
 *
 * 한 번에 1편. 대상은 발행 전이고 본문에 그림(![)이 없는 초안 — 도해는 무조건이다(원장 2026-09-22). 그림이 붙을 때까지
 * 다시 그린다(시도 수는 review_notes.삽화.시도, 두 번 넘게 못 붙이면 company.mjs 가 사람 대기를 세운다).
 * Claude Code(구독)에 본문을 주고 도해 2~3장을 받는다. 모델 말을 믿지 않고 스크립트가 검사한다 —
 *   XML 로 읽히는가 · 금지 요소(스크립트·이벤트·외부 주소) · 본문에 없는 숫자 · 다른 고객사 이름 · 크기 60KB · 폭 960
 *   · 막대 길이가 data-value 에 비례하는가 · 축 눈금이 0 부터 같은 간격인가
 * 통과한 것만 넣는다. 본문 수정은 updated_at 조건으로 — 원장이 그사이 고쳤으면 덮어쓰지 않는다.
 * 다 버려졌으면 초안은 그대로, 이유와 시도 수만 review_notes.삽화 에 남긴다. 발행은 검토 화면이 도해 없는 초안을 막는다.
 *
 *   node scripts/illustrate.mjs --dry                 대상만 본다 (claude 부르지 않음)
 *   node scripts/illustrate.mjs [--slug X] [--task N] 1편 그린다 — 마지막 줄 ILLUSTRATE={...} 를 company.mjs 가 읽는다
 *   node scripts/illustrate.mjs --test                검사 시험 (claude 없음 · DB 는 되돌리는 거래 안에서만)
 */
import fs from "node:fs";
import { Pool } from "pg";
import { CLIENTS } from "../clients.mjs";
import { 가림검사, 고객사말, 수검사, 풀기 } from "../masks.mjs";
import { 클로드코드, 클로드코드있음, 클로드기록연결 } from "./claude-code.mjs";

const envFile = new URL("../.env.local", import.meta.url);
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const argv = process.argv.slice(2);
const 값 = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const MODE = argv.includes("--test") ? "test" : argv.includes("--dry") ? "dry" : "run";
const SLUG = 값("--slug");
const TASK = Number(값("--task")) || null;
const 최대크기 = 60 * 1024;
const 최대장수 = 3;

const pool = process.env.DATABASE_URL ? new Pool((() => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } };
})()) : null;
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
if (pool) 클로드기록연결(q);

const KST = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 한줄 = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ─────────────────────────────────────────── XML 검사
/**
 * 새 패키지 없이 태그 짝·속성 따옴표·엔티티만 본다. 브라우저는 깨진 SVG 에 빨간 오류 화면을 그리고,
 * 그게 PNG 로 구워진 전례가 있다(CLAUDE.md). 읽히지 않으면 버린다. 돌려주는 값: 오류 문장 또는 null
 */
const 엔티티틀림 = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;
const 이름 = "[A-Za-z_][\\w:.-]*";
const 속성들 = new RegExp(`\\s+(${이름})\\s*=\\s*(?:"([^"<]*)"|'([^'<]*)')`, "gy");
const 여는태그 = new RegExp(`^<(${이름})([\\s\\S]*?)\\s*(/?)>$`);
const XML검사 = (src) => {
  let s = String(src).trim(); // trim 은 BOM 도 지운다
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) return "DOCTYPE·ENTITY 선언";
  s = s.replace(/^<\?xml[^?]*\?>\s*/, "");
  const 조각 = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^<>]*>|[^<]+/y;
  const 쌓임 = [];
  let 뿌리 = 0;
  let 위치 = 0;
  while (위치 < s.length) {
    조각.lastIndex = 위치;
    const m = 조각.exec(s);
    if (!m) return `태그가 닫히지 않음 (${위치}자 근처)`;
    위치 = 조각.lastIndex;
    const t = m[0];
    if (t.startsWith("<!--")) { if (t.slice(4, -3).includes("--")) return "주석 안에 --"; continue; }
    if (t.startsWith("<![CDATA[")) { if (!쌓임.length) return "뿌리 밖 CDATA"; continue; }
    if (t.startsWith("</")) {
      const 닫는 = new RegExp(`^</(${이름})\\s*>$`).exec(t);
      if (!닫는) return `닫는 태그 모양 ${t.slice(0, 40)}`;
      const 위 = 쌓임.pop();
      if (위 !== 닫는[1]) return `태그 짝 안 맞음: <${위 ?? "없음"}> 를 </${닫는[1]}> 로 닫음`;
      continue;
    }
    if (t.startsWith("<")) {
      if (t.startsWith("<?") || t.startsWith("<!")) return `허락 안 한 선언 ${t.slice(0, 30)}`;
      const 열기 = 여는태그.exec(t);
      if (!열기) return `여는 태그 모양 ${t.slice(0, 40)}`;
      const [, 태그, 속성글, 홑] = 열기;
      // 속성은 이름="값" 이 이어져야 하고, 같은 이름이 두 번 나오면 XML 오류다
      const 본것 = new Set();
      let 끝 = 0;
      속성들.lastIndex = 0;
      for (let a; (a = 속성들.exec(속성글));) {
        if (본것.has(a[1])) return `속성 두 번: ${a[1]}`;
        본것.add(a[1]);
        if (엔티티틀림.test(a[2] ?? a[3] ?? "")) return `속성 값에 날 & (${a[1]}) — &amp; 로 써야 함`;
        끝 = 속성들.lastIndex;
      }
      if (속성글.slice(끝).trim()) return `속성 모양 <${태그} …${속성글.slice(끝, 끝 + 30)}`;
      if (!쌓임.length) {
        if (뿌리++) return "뿌리 요소가 둘";
        if (태그 !== "svg") return `뿌리가 svg 가 아님 (${태그})`;
      }
      if (!홑) 쌓임.push(태그);
      continue;
    }
    if (!쌓임.length) { if (t.trim()) return "뿌리 밖 글자"; continue; }
    if (엔티티틀림.test(t)) return `글자에 날 & — &amp; 로 써야 함 (${한줄(t, 30)})`;
  }
  if (쌓임.length) return `닫히지 않은 태그 <${쌓임.at(-1)}>`;
  if (!뿌리) return "svg 요소가 없음";
  return null;
};

// ─────────────────────────────────────────── 한 장 검사
/** 그림 속 사람이 읽는 글자 — <text> 등 태그 사이 글자 + aria-label·title 속성. 태그 자리는 띄운다(「3」「5」 가 「35」로 붙지 않게) */
const 축글자꼴 = /<text\b[^>]*\sdata-axis\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/text>/gi;
const 그림글자 = (svg) => {
  const 속성 = [...svg.matchAll(/\s(?:aria-label|aria-description|title|data-value)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2]);
  // 축 눈금(data-axis)은 따로 본다 — 0·20·40 은 본문의 주장이 아니라 잣대다(축검사)
  const 글 = svg.replace(축글자꼴, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
  return 풀기([글, ...속성].join(" ")).replace(/\s+/g, " ").trim();
};

/**
 * 축 눈금은 0 부터 같은 간격인 수만 된다(단위 글자 3자까지). 아무 수나 data-axis 를 달아 숫자 검사를 빠져나가지 못하게
 */
const 축검사 = (svg) => {
  const 축들 = new Map();
  for (const m of svg.matchAll(축글자꼴)) {
    const 글 = 풀기(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const n = /^(\d+(?:\.\d+)?)\s*[가-힣a-zA-Z%]{0,3}$/.exec(글);
    if (!n) return [`축 눈금이 수가 아님 「${한줄(글, 20)}」`];
    축들.set(m[1], [...(축들.get(m[1]) ?? []), Number(n[1])]);
  }
  const 이유 = [];
  for (const [축, 값들] of 축들) {
    const v = [...new Set(값들)].sort((a, b) => a - b);
    const 간격 = v[1] - v[0];
    if (v.length < 2 || v[0] !== 0 || v.some((x, i) => Math.abs(x - i * 간격) > 1e-9)) 이유.push(`축 「${축}」 눈금이 0 부터 같은 간격이 아님 (${v.join(", ")})`);
  }
  return 이유;
};

/**
 * 막대 길이가 값에 비례하는가 — data-value 를 단 rect 를 data-chart 별로 묶어, 폭 또는 높이 ÷ 값이 2% 안으로 같아야 한다.
 * 글자를 넣으려고 막대를 줄이면 그림이 거짓말을 한다(원장 지시 2026-09-22)
 */
const 막대검사 = (svg) => {
  const 차트들 = new Map();
  const 이유 = [];
  for (const m of svg.matchAll(/<([A-Za-z]+)\b([^>]*\sdata-value\s*=\s*["']([^"']*)["'][^>]*)>/g)) {
    const [, 태그, 속성, 값글] = m;
    if (태그 !== "rect") { 이유.push(`data-value 는 rect 에만 (${태그})`); continue; }
    const 속 = (k) => new RegExp(`\\s${k}\\s*=\\s*["']([^"']*)["']`).exec(속성)?.[1];
    const 값 = Number(값글), w = Number(속("width")), h = Number(속("height"));
    if (!/^\d+(?:\.\d+)?$/.test(값글.trim()) || !Number.isFinite(w) || !Number.isFinite(h)) { 이유.push(`막대 값·크기가 수가 아님 (data-value="${값글}")`); continue; }
    const 차트 = 속("data-chart") ?? "기본";
    차트들.set(차트, [...(차트들.get(차트) ?? []), { 값, w, h }]);
  }
  const 비례 = (막대들, k) => {
    if (막대들.some((b) => b.값 === 0 && b[k] > 1)) return false;
    const r = 막대들.filter((b) => b.값 > 0).map((b) => b[k] / b.값);
    return r.length < 2 || (Math.max(...r) - Math.min(...r)) / Math.max(...r) <= 0.02;
  };
  // 길이 쪽은 크기가 더 크게 갈리는 쪽이다(가로 막대면 폭). 둘 중 아무 쪽이나 맞으면 통과로 두면
  // 값이 같은 두 막대는 높이가 같아서 폭을 줄여도 통과한다
  const 퍼짐 = (막대들, k) => { const v = 막대들.map((b) => b[k]); return (Math.max(...v) - Math.min(...v)) / (Math.max(...v) || 1); };
  for (const [차트, 막대들] of 차트들) {
    const k = 퍼짐(막대들, "w") >= 퍼짐(막대들, "h") ? "w" : "h";
    if (!비례(막대들, k)) 이유.push(`차트 「${차트}」 막대 길이가 값에 비례하지 않음 (${막대들.map((b) => `${b.값}→${b.w}×${b.h}`).join(", ")})`);
  }
  return 이유;
};

/**
 * 버릴 이유 목록을 돌려준다. 비었으면 통과.
 *   재료 = 본문(제목 포함) · 말들 = 다른 고객사를 알아보게 하는 말
 */
const 한장검사 = ({ svg, alt }, 재료, 말들) => {
  const 이유 = [];
  svg = String(svg ?? "");
  if (!svg.trim()) return ["svg 가 비었음"];
  if (!String(alt ?? "").trim()) 이유.push("alt 가 비었음");
  const 크기 = Buffer.byteLength(svg, "utf8");
  if (크기 > 최대크기) 이유.push(`크기 ${Math.round(크기 / 1024)}KB > 60KB`);
  const xml = XML검사(svg);
  if (xml) 이유.push(`XML 오류: ${xml}`);

  // 금지 요소 — 사이트 경로가 CSP 로 한 번 더 막지만, 저장부터 안 한다
  if (/<script/i.test(svg)) 이유.push("스크립트 <script>");
  if (/<(?:foreignObject|iframe|object|embed)\b/i.test(svg)) 이유.push("허락 안 한 요소 (foreignObject·iframe·object·embed)");
  if (/\son[a-z]+\s*=/i.test(svg)) 이유.push("이벤트 속성 on*=");
  if (/javascript:/i.test(svg)) 이유.push("javascript: 주소");
  if (/@import/i.test(svg)) 이유.push("스타일 @import");
  for (const m of svg.matchAll(/\s(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const v = (m[1] ?? m[2]).trim();
    if (!v.startsWith("#")) 이유.push(`외부 주소 href="${한줄(v, 60)}"`);
  }
  for (const m of svg.matchAll(/url\(\s*['"]?([^'")]*)/gi)) {
    if (!m[1].trim().startsWith("#")) 이유.push(`외부 주소 url(${한줄(m[1], 60)})`);
  }

  // 규격 — 폭 960, 모양은 사이트 도해와 같게
  if (!/<svg\b[^>]*\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(svg)) 이유.push("xmlns 없음 (img 로 안 그려짐)");
  const vb = /<svg\b[^>]*\sviewBox\s*=\s*["']\s*0[\s,]+0[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/.exec(svg);
  const w = /<svg\b[^>]*\swidth\s*=\s*["']([\d.]+)/.exec(svg)?.[1];
  if (!vb || Number(vb[1]) !== 960 || (w && Number(w) !== 960)) 이유.push(`폭이 960 이 아님 (viewBox ${vb ? `${vb[1]}×${vb[2]}` : "없음"}${w ? ` · width ${w}` : ""})`);
  if (!/aria-label\s*=\s*["'][^"']{10,}/.test(svg)) 이유.push("aria-label 에 내용이 없음");

  // 차트 — 막대는 값에 비례, 축 눈금은 0 부터 같은 간격
  이유.push(...막대검사(svg), ...축검사(svg));

  // 지어낸 숫자 — 그림 글자·alt·막대 값의 숫자는 본문에 통째로 있어야 한다 (sales.mjs 와 같은 검사, masks.mjs)
  const 모르는 = 수검사(`${그림글자(svg)} ${alt ?? ""}`, 재료);
  if (모르는.length) 이유.push(`본문에 없는 수: ${모르는.slice(0, 6).join(", ")}`);
  // 다른 고객사 — 조합되면 특정된다
  const 걸림 = 가림검사(`${svg}\n${alt ?? ""}`, 말들);
  if (걸림.length) 이유.push(`가릴 말: ${걸림.slice(0, 4).join(", ")}`);
  return 이유;
};

/**
 * 숫자 검사의 재료 = 제목 + 본문 + 본문 날짜의 점 표기. 연표는 「2026년 8월 27일」을 「2026.08.27」로 줄여 쓴다 —
 * 같은 날짜라 지어낸 수가 아니다(참고 예시 timeline.svg). 날짜가 아닌 수는 넓히지 않는다
 */
const 재료로 = (post) => {
  const 원 = `${post.title}\n${post.body}`;
  const 두자리 = (n) => String(n).padStart(2, "0");
  const 점 = [];
  for (const [, y, mo, d] of 원.matchAll(/(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?/g)) {
    점.push(`${y}.${mo}`, `${y}.${두자리(mo)}`);
    if (d) 점.push(`${y}.${mo}.${d}`, `${y}.${두자리(mo)}.${두자리(d)}`);
  }
  return `${원}\n${점.join(" ")}`;
};

// ─────────────────────────────────────────── 본문에 끼우기
/**
 * before 문구가 든 줄 바로 앞에 넣는다(insert-diagrams.mjs 와 같은 규칙). 문구가 문단 중간이어도 줄 머리로 옮긴다 —
 * 이미지는 한 줄을 통째로 차지해야 그려진다(lib/md.ts). 못 찾으면 첫 ## 뒤, ## 도 없으면 맨 뒤
 */
const 끼우기 = (body, img, before) => {
  const b = String(before ?? "").trim();
  const i = b.length >= 4 ? body.indexOf(b) : -1;
  if (i >= 0) {
    const s = body.lastIndexOf("\n", i) + 1;
    return { body: `${body.slice(0, s)}${img}\n\n${body.slice(s)}`, 자리: "문구 앞" };
  }
  const h = /^##\s.*$/m.exec(body);
  if (h) {
    const e = h.index + h[0].length;
    return { body: `${body.slice(0, e)}\n\n${img}${body.slice(e)}`, 자리: "첫 소제목 뒤" };
  }
  return { body: `${body}\n\n${img}`, 자리: "맨 뒤" };
};

const 이름다듬기 = (s, i) => String(s ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `fig-${i + 1}`;
const alt다듬기 = (s) => String(s ?? "").replace(/[[\]\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);

/**
 * 그림과 본문을 한 거래로. 본문은 updated_at 이 읽은 때와 같을 때만 바꾼다 — 원장이 그사이 고쳤으면 0행이고 그림도 되돌린다.
 * 돌려주는 값: 바꿨으면 true
 */
const 저장 = async (client, { slug, body, updated, 그림들, 기록 }) => {
  for (const g of 그림들) {
    await client.query(`insert into academy.post_images (slug, name, svg, alt) values ($1,$2,$3,$4)
      on conflict (slug, name) do update set svg=excluded.svg, alt=excluded.alt, created_at=now()`, [slug, g.name, g.svg, g.alt]);
  }
  const r = await client.query(`update academy.posts set body=$2, updated_at=now(),
      review_notes = coalesce(review_notes,'{}'::jsonb) || jsonb_build_object('삽화', $4::jsonb)
    where slug=$1 and not published and updated_at=$3::timestamptz and position('![' in body) = 0 returning slug`,
  [slug, body, updated, JSON.stringify(기록)]);
  return r.rowCount === 1;
};

// ─────────────────────────────────────────── 프롬프트
/**
 * 참고 예시 — 2026-09-22 원장 지시 「도해를 좀더 보기좋게」로 새 스타일을 손으로 그린 세 장(아이콘 연표·단위 차트·시수 막대).
 * 옛 참고(grading-shift.svg)는 카드 두 장뿐이라 그림이 다 비슷하게 나왔다
 */
const 참고들 = ["timeline", "recognized-textbook", "info-hours"];
const 참고그림 = () => 참고들.map((n) => `<!-- 참고: ${n}.svg -->\n${fs.readFileSync(new URL(`../public/blog/ai-textbook-16-subjects-2028/${n}.svg`, import.meta.url), "utf8").trim()}`).join("\n\n");

const 프롬프트 = (post) => [
  "아래는 학원 블로그 초안이다. 이 글의 뼈대를 설명하는 도해(SVG) 2~3장을 그려라. 그림이 설명하는 대목 바로 앞에 놓는다.",
  "",
  "사실 (어기면 스크립트가 그 그림을 버린다)",
  "- 본문에 없는 숫자·사실을 그림에 넣지 마라. 그림 글자·aria-label·alt·data-value 의 숫자는 본문에 똑같이 있는 것만 쓴다. 「세 배」「두 달」 같은 수 표현도 본문에 그대로 있는 것만",
  "- 숫자는 본문과 같은 모양으로 쓴다. 「세 가지」를 「3가지」로 바꾸면 본문에 없는 수로 보고 버린다. 날짜만 「2026년 8월 27일」→「2026.08.27」처럼 점으로 줄여도 된다",
  "- 지어낸 사례·통계·인용을 넣지 마라. 학원·회사 이름, 지역명, 전화번호를 넣지 않는다",
  "",
  "형태 — 내용에 맞게 고른다",
  "- 날짜가 이어지면 연표(시안→앰버 그라데이션 레일, 마디마다 아이콘) · 개수는 단위 차트(한 칸 = 1) · 크기 비교는 막대 · 「A 와 B」는 비교 카드 · 과정은 알약 모양 흐름(→)",
  "- 막대: 축 하나, 옅은 점선 격자(#223040), 모서리 4px. 막대 길이는 값에 정확히 비례한다 — 글자를 넣으려고 막대를 줄이지 마라, 글자가 안 들어가면 막대 끝 안쪽에 쓴다",
  "  · 값을 나타내는 막대마다 <rect … data-value=\"값\" data-chart=\"차트이름\"> 를 단다. 스크립트가 폭(또는 높이)이 값에 2% 안으로 비례하는지 재고, 어긋나면 버린다",
  "  · 축 눈금 글자는 <text data-axis=\"차트이름\">20</text> 처럼 단다. 눈금은 0 부터 같은 간격이어야 한다. 눈금 말고는 data-axis 를 쓰지 않는다",
  "  · 계열이 둘 이상이면 범례, 값은 막대에 바로 적는다",
  "- 계열 색(어두운 바탕에서 검증된 것): #1F9E90, #7C8AF2, #C27A14",
  "",
  "모양 — 참고 예시와 같은 체계",
  "- <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 960 H\" width=\"960\" height=\"H\" role=\"img\" aria-label=\"…\">, H 는 360~560",
  "- 배경은 #111827→#0B0F16 대각 그라데이션, 필요하면 옅은 원형 강조 빛 하나",
  "- 머리: 키커 한 줄(IBM Plex Mono 12px, letter-spacing 2.5, 시안 #3DD6C4) + 굵은 30px 제목(#F1F4F8) + 15px 부제(#8A94A6)",
  "- 카드: 세로 그라데이션 #18202C→#121821, 모서리 14~16px, 1px #263241 테두리, feDropShadow 그림자",
  "- 강조 카드는 하나만 앰버로: #2A2013→#1A150E, 테두리 #6A4A17 또는 #8A5E1A, 앰버 알약 배지",
  "- 아이콘은 path 로 그린 단순한 선(stroke 2, 둥근 이음)을 테두리 원 안에 넣는다",
  "- 맨 아래 한 줄 요약 띠(#141B25, 테두리 #2A3544) — 판단 기준을 한 문장으로",
  "- 글자는 'Noto Sans KR', 라벨·숫자는 'IBM Plex Mono'",
  "",
  "XML·보안 (어기면 버린다)",
  "- 글자 속 & 는 반드시 &amp; 로. < > 도 &lt; &gt;. 안 그러면 XML 이 깨진다",
  "- aria-label 에 그림의 내용 전체를 문장으로 적는다. 그림을 못 보는 쪽에도 뜻이 남아야 한다",
  "- <script>, on*= 속성, <foreignObject>, <image>, 외부 주소(href·url(...))는 쓰지 않는다. 그라데이션·필터 참조 url(#id) 만 된다",
  "- 한 장 60KB 이하",
  "",
  "글 — 짧게. 번역체·과장 형용사(놀라운·혁신적인·필수적인)·빈 강조 금지. 「우리 학원으로 오세요」 같은 권유나 불안을 파는 말 금지",
  "",
  "before 는 본문에 글자 그대로 있는 문구(10~30자)다. 가능하면 그 그림이 설명하는 소제목 줄(## …)이나 문단 첫머리를 그대로 옮긴다.",
  "alt 는 그림의 내용을 한두 문장으로. 대괄호를 쓰지 않는다. name 은 영문 소문자와 - 로 된 짧은 이름.",
  "",
  '형식 — JSON 객체 하나만 답한다. 다른 말·코드블록 표시는 붙이지 않는다: {"images":[{"name":"…","alt":"…","before":"…","svg":"<svg …>…</svg>"}]}',
  "",
  "참고 예시 (사이트에 실린 도해 세 장. 이 체계를 따르되 내용에 맞는 형태를 고른다):",
  참고그림(),
  "",
  `제목: ${post.title}`,
  "본문:",
  post.body,
].join("\n");

const 답읽기 = (text) => {
  const t = String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/gm, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  const 배열 = t.indexOf("["), 배열끝 = t.lastIndexOf("]");
  for (const [s, e] of [[a, b], [배열, 배열끝]]) {
    if (s < 0 || e <= s) continue;
    try {
      const j = JSON.parse(t.slice(s, e + 1));
      const images = Array.isArray(j) ? j : j?.images;
      if (Array.isArray(images)) return images;
    } catch { /* 다음 모양으로 */ }
  }
  return null;
};

// ─────────────────────────────────────────── 가릴 말
/** 이 글의 고객사가 아닌 고객사 — clients.mjs + DB 의 고객사 표 + 영업 후보. 못 읽으면 멈춘다(fail-closed) */
const 남의말 = async (clientId) => {
  const 말 = new Set(고객사말(CLIENTS.filter((c) => c.id !== clientId)));
  for (const r of await q(`select name, domain from geo.clients where id <> $1`, [clientId])) {
    if (r.name?.length >= 2) 말.add(r.name);
    if (r.domain) 말.add(r.domain);
  }
  for (const r of await q(`select name from geo.outreach_targets`)) if (r.name?.length >= 2) 말.add(r.name);
  return [...말];
};

// ─────────────────────────────────────────── 대상
const 대상들 = (slug = null, n = 1) => q(
  `select slug, title, body, client_id, updated_at::text as updated,
    to_char(updated_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as kst,
    coalesce((review_notes->'삽화'->>'시도')::int, 0) as 시도 from academy.posts
    where not published and position('![' in body) = 0 and ($1::text is null or slug = $1)
    order by 시도, created_at limit $2`, [slug, n]);

const 끝냄 = (r) => { console.log(`ILLUSTRATE=${JSON.stringify(r)}`); };

const 그리기 = async () => {
  await q(`create table if not exists academy.post_images (slug text not null, name text not null, svg text not null,
    alt text not null, created_at timestamptz not null default now(), unique (slug, name))`);
  const [post] = await 대상들(SLUG);
  if (!post) return 끝냄({ 상태: "대상없음", slug: SLUG });
  console.log(`삽화 · ${KST()} KST · ${post.slug} 「${post.title}」 (${post.body.length}자)`);
  if (!클로드코드있음()) return 끝냄({ 상태: "클로드없음", slug: post.slug });

  const 말들 = await 남의말(post.client_id);
  const r = await 클로드코드(프롬프트(post), {
    purpose: "illustrate", capRequired: true, taskId: TASK, model: "sonnet", maxTurns: 2, timeoutMs: 8 * 60 * 1000,
    system: "너는 한국어 교육 블로그의 도해(SVG)를 그리는 디자이너다. 요청한 JSON 객체 하나만 답한다.",
  });
  if (!r.ok) return 끝냄({ 상태: r.한도 ? "한도" : "실패", slug: post.slug, 오류: 한줄(r.error, 300) });

  const 받은 = 답읽기(r.text);
  const 재료 = 재료로(post);
  const 버린것 = [];
  const 그림들 = [];
  if (!받은) 버린것.push(`답이 JSON 이 아님 (${r.text.length}자)`);
  for (const [i, x] of (받은 ?? []).entries()) {
    const name = 이름다듬기(x?.name, i);
    if (i >= 최대장수) { 버린것.push(`${name}: ${최대장수}장 넘음`); continue; }
    if (그림들.some((g) => g.name === name)) { 버린것.push(`${name}: 이름 겹침`); continue; }
    const alt = alt다듬기(x?.alt);
    const 이유 = 한장검사({ svg: x?.svg, alt }, 재료, 말들);
    if (이유.length) { 버린것.push(`${name}: ${이유.join(" · ")}`); continue; }
    그림들.push({ name, alt, svg: String(x.svg).trim(), before: x?.before });
  }
  for (const b of 버린것) console.log(`  ✗ ${b}`);

  const 기록 = { 장수: 그림들.length, 버린것, 쓴날: KST(), 시도: post.시도 + 1, ...(r.callId ? { 호출: r.callId } : {}) };
  if (!그림들.length) {
    await q(`update academy.posts set review_notes = coalesce(review_notes,'{}'::jsonb) || jsonb_build_object('삽화', $2::jsonb)
      where slug=$1 and not published`, [post.slug, JSON.stringify(기록)]);
    return 끝냄({ 상태: "다버림", slug: post.slug, 장수: 0, 시도: 기록.시도, 버린것 });
  }

  let body = post.body;
  for (const g of 그림들) {
    const 끼움 = 끼우기(body, `![${g.alt}](/blog/img/${post.slug}/${g.name}.svg)`, g.before);
    body = 끼움.body;
    g.자리 = 끼움.자리;
    console.log(`  ✓ ${g.name} · ${Math.round(Buffer.byteLength(g.svg) / 1024)}KB · ${g.자리}`);
  }
  기록.자리 = 그림들.map((g) => `${g.name}: ${g.자리}`);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const 됨 = await 저장(client, { slug: post.slug, body, updated: post.updated, 그림들, 기록 });
    await client.query(됨 ? "commit" : "rollback");
    if (!됨) return 끝냄({ 상태: "고쳐짐", slug: post.slug, 오류: "그리는 사이 본문이 고쳐지거나 발행됨 — 덮어쓰지 않음" });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return 끝냄({ 상태: "붙임", slug: post.slug, 장수: 그림들.length, 버린것, 그림: 그림들.map((g) => `/blog/img/${post.slug}/${g.name}.svg`) });
};

// ─────────────────────────────────────────── --dry
const 살펴보기 = async () => {
  const rows = await 대상들(null, 50);
  const [n] = await q(`select count(*)::int n, count(*) filter (where purpose='illustrate')::int ill from geo.claude_calls
    where (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`).catch(() => [null]);
  console.log(`삽화 대상 ${rows.length}편 · Claude Code ${클로드코드있음() ? "있음" : "없음"} · 오늘 호출 ${n ? `${n.n}회 (illustrate ${n.ill}회)` : "못 셈"}`);
  for (const r of rows) console.log(`  - ${r.slug} 「${r.title}」 ${r.body.length}자 · 고친 때 ${r.kst} KST`);
  if (rows.length) console.log(`다음에 그릴 글: ${rows[0].slug} (claude 를 부르지 않았습니다)`);
};

// ─────────────────────────────────────────── --test
const 시험 = async () => {
  const 본문 = "## 두 단계로 봅니다\n\n1단계는 블록 코딩이다. 2단계는 파이썬이다. 30분 수업에서 로봇&코딩 도구를 쓴다.\n\n## 넘어가는 기준\n\n설명할 수 있으면 넘어간다.";
  const 말들 = 고객사말(CLIENTS.filter((c) => c.id !== 1));
  const 틀 = (글자, { 머리 = "", 속 = "" } = {}) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 360" width="960" height="360" role="img" aria-label="두 단계로 본다. 1단계 블록 코딩, 2단계 파이썬."${머리}>` +
    `<defs><linearGradient id="g"><stop offset="0" stop-color="#0B0F16"/></linearGradient></defs><rect width="960" height="360" fill="url(#g)"/>${속}` +
    `<text x="40" y="80" fill="#F5A623">${글자}</text></svg>`;
  const 좋은 = 틀("1단계 블록 코딩 → 2단계 파이썬 · 로봇&amp;코딩 도구");
  let y = 100;
  const 막대 = (값, 폭) => `<rect x="100" y="${(y += 30)}" width="${폭}" height="16" rx="4" data-value="${값}" data-chart="c" fill="#1F9E90"/>`;
  const 축 = (눈금들) => 눈금들.map((t, i) => `<text data-axis="c" x="${100 + i * 100}" y="340">${t}</text>`).join("");
  const 사례 = [
    ["좋은 도해", 좋은, "두 단계 도해. 1단계 블록 코딩, 2단계 파이썬.", true],
    ["파싱 오류 — 날 &", 틀("로봇 & 코딩"), "도해", false],
    ["파싱 오류 — 태그 짝", 틀("<tspan>블록</text>"), "도해", false],
    ["파싱 오류 — 안 닫힘", 좋은.replace("</svg>", ""), "도해", false],
    ["스크립트", 틀("블록", { 속: "<script>alert(1)</script>" }), "도해", false],
    ["이벤트 속성", 틀("블록", { 머리: ' onload="alert(1)"' }), "도해", false],
    ["외부 href", 틀("블록", { 속: '<a href="https://evil.example/"><text>눌러</text></a>' }), "도해", false],
    ["외부 xlink:href", 틀("블록", { 머리: ' xmlns:xlink="http://www.w3.org/1999/xlink"', 속: '<use xlink:href="https://evil.example/x.svg#a"/>' }), "도해", false],
    ["javascript: 주소", 틀("블록", { 속: '<a href="javascript:alert(1)"><text>눌러</text></a>' }), "도해", false],
    ["외부 url()", 틀("블록", { 속: '<rect width="9" height="9" style="fill:url(https://evil.example/p.svg)"/>' }), "도해", false],
    ["foreignObject", 틀("블록", { 속: "<foreignObject><div/></foreignObject>" }), "도해", false],
    ["본문에 없는 숫자", 틀("합격률 87% 달성"), "도해", false],
    ["부분 숫자 속임(30 → 3)", 틀("3분 수업"), "도해", false],
    ["본문에 없는 수 구절", 틀("세 배 빨라진다"), "도해", false],
    ["alt 에 지어낸 숫자", 좋은, "수강생 120명이 거친 두 단계", false],
    ["다른 고객사 이름", 틀("아이로그 로 기록한다"), "도해", false],
    ["다른 고객사 도메인", 틀("ilog.ai.kr"), "도해", false],
    ["폭 800", 좋은.replace(/960/g, "800"), "도해", false],
    ["60KB 초과", 틀("블록", { 속: `<!-- ${"x".repeat(62 * 1024)} -->` }), "도해", false],
    ["막대 비례 (30·1·2)", 틀("블록", { 속: 막대(30, 300) + 막대(1, 10) + 막대(2, 20) }), "도해", true],
    ["막대를 줄임 (30 인데 1 의 20배)", 틀("블록", { 속: 막대(30, 200) + 막대(1, 10) }), "도해", false],
    ["같은 값 막대 하나만 줄임", 틀("블록", { 속: 막대(30, 300) + 막대(30, 250) }), "도해", false],
    ["막대 값이 본문에 없음", 틀("블록", { 속: 막대(45, 450) + 막대(30, 300) }), "도해", false],
    ["축 눈금 0·10·20·30분", 틀("블록", { 속: 축(["0", "10", "20", "30분"]) }), "도해", true],
    ["축 눈금에 지어낸 수 숨기기", 틀("블록", { 속: 축(["0", "87"]) + 축(["45"]) }), "도해", false],
    ["축 눈금에 글자", 틀("블록", { 속: 축(["0", "합격률 87%"]) }), "도해", false],
  ];
  let 틀림 = 0;
  console.log("도해 검사 시험");
  for (const [이름, svg, alt, 통과] of 사례) {
    const 이유 = 한장검사({ svg, alt }, 본문, 말들);
    const ok = (이유.length === 0) === 통과;
    if (!ok) 틀림++;
    console.log(`  ${ok ? "✓" : "✗"} ${이름} — ${통과 ? "통과해야 함" : "버려야 함"} · ${이유.length ? `버림: ${이유.join(" · ")}` : "통과"}`);
  }

  // 참고 예시(손으로 그린 새 스타일)는 그 글 본문을 재료로 검사를 통과해야 한다 — 못 넘으면 검사가 너무 좁거나 예시가 틀렸다
  const [원글] = pool ? await q(`select title, body from academy.posts where slug='ai-textbook-16-subjects-2028'`) : [];
  if (원글) {
    console.log("참고 예시 검사 (ai-textbook-16-subjects-2028 본문이 재료)");
    for (const n of 참고들) {
      const svg = fs.readFileSync(new URL(`../public/blog/ai-textbook-16-subjects-2028/${n}.svg`, import.meta.url), "utf8");
      const 이유 = 한장검사({ svg, alt: "도해" }, 재료로(원글), 말들);
      if (이유.length) 틀림++;
      console.log(`  ${이유.length ? "✗" : "✓"} ${n}.svg — 통과해야 함 · ${이유.length ? `버림: ${이유.join(" · ")}` : "통과"}`);
    }
  }

  console.log("끼우는 자리 시험");
  const 자리 = [
    ["문구가 문단 중간", 끼우기("## 가\n\n앞 문장. 설명할 수 있으면 넘어간다.\n", "![a](/x.svg)", "설명할 수 있으면"), "## 가\n\n![a](/x.svg)\n\n앞 문장. 설명할 수 있으면 넘어간다.\n"],
    ["문구 없음 → 첫 ## 뒤", 끼우기("머리말\n\n## 가\n\n본문", "![a](/x.svg)", "없는 문구입니다"), "머리말\n\n## 가\n\n![a](/x.svg)\n\n본문"],
    ["## 도 없음 → 맨 뒤", 끼우기("본문만", "![a](/x.svg)", ""), "본문만\n\n![a](/x.svg)"],
  ];
  for (const [이름, r, 기대] of 자리) {
    const ok = r.body === 기대;
    if (!ok) 틀림++;
    console.log(`  ${ok ? "✓" : "✗"} ${이름} (${r.자리})${ok ? "" : ` — 받은 값 ${JSON.stringify(r.body)}`}`);
  }

  if (pool) {
    // 원장이 그사이 고친 본문을 덮어쓰지 않는가 — 실제 저장 함수로, 되돌리는 거래 안에서만 본다
    console.log("덮어쓰기 시험 (거래 안에서 하고 되돌림)");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const slug = `illustrate-test-${Date.now()}`;
      const [row] = (await client.query(`insert into academy.posts (slug, title, body, published) values ($1,'시험','## 가\n\n본문',false) returning updated_at::text as updated`, [slug])).rows;
      await client.query(`update academy.posts set body='## 가\n\n원장이 고친 본문', updated_at = updated_at + interval '1 second' where slug=$1`, [slug]);
      const 그림들 = [{ name: "t", svg: 좋은, alt: "시험" }];
      const 옛것 = await 저장(client, { slug, body: "## 가\n\n![시험](/blog/img/x/t.svg)\n\n본문", updated: row.updated, 그림들, 기록: { 장수: 1 } });
      const [지금] = (await client.query(`select body, updated_at::text as updated from academy.posts where slug=$1`, [slug])).rows;
      const ok1 = !옛것 && 지금.body.includes("원장이 고친 본문");
      console.log(`  ${ok1 ? "✓" : "✗"} 읽은 뒤 고쳐진 본문 — 덮어쓰지 않아야 함 · ${옛것 ? "덮어씀" : "안 덮어씀"} · 본문 「${한줄(지금.body, 40)}」`);
      const 새것 = await 저장(client, { slug, body: `${지금.body}\n\n![시험](/blog/img/x/t.svg)`, updated: 지금.updated, 그림들, 기록: { 장수: 1 } });
      console.log(`  ${새것 ? "✓" : "✗"} 그대로인 본문 — 넣어야 함 · ${새것 ? "넣음" : "안 넣음"}`);
      if (!ok1) 틀림++;
      if (!새것) 틀림++;
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  } else console.log("덮어쓰기 시험 — DATABASE_URL 없음, 건너뜀");

  console.log(틀림 ? `\n${틀림}건 틀림` : "\n전부 맞음");
  if (틀림) process.exitCode = 1;
};

const main = MODE === "test" ? 시험 : MODE === "dry" ? 살펴보기 : 그리기;
main()
  .catch((e) => { console.log("실패:", e.stack ?? e.message); 끝냄({ 상태: "실패", slug: SLUG, 오류: 한줄(e.message, 300) }); process.exitCode = 1; })
  .finally(() => pool?.end());
