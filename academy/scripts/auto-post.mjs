/**
 * 학원 주 1편 자동 글(Step 43) — 주제를 고르고 쓰기에 넘긴다. 감수는 --review.
 *
 * 원장 결정 2026-10-10: 「새 글 포스팅도 자동화해서 주제 선택과 감수 모두 자동으로.」
 * 판정은 전부 web/lib/post-auto-core.mjs 한 곳에 있다. 여기는 DB·파일·쓰기 스크립트를 잇는 자리다.
 *
 *   --pick [--dry]           후보 모으기 → 거르기 → 점수순 → 재료 관문 → 고름 기록 → 쓰기(write-news / write-draft)
 *                            --dry 는 후보표·뺀 이유·재료 관문까지 찍고 DB 를 안 쓴다(쓰기도 안 부른다)
 *   --review <slug> [--dry]  자동 감수 4관문 — 출처 원문 대조 · AI 티 · 원장 관점 · 가림 (아래 감수 절)
 *                            --dry 는 발행 글도 받고 DB·본문을 안 쓴다. 결과를 찍기만 한다
 *
 * 마지막 줄 AUTOPOST=<JSON> 을 company.mjs 가 읽는다(illustrate 의 ILLUSTRATE= 꼴).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  후보모으기, 거르기, 재료모으기, 재료판정, 이번주글SQL, 기록하기,
  본문해시, 다음행동, 관점읽기, 다듬기검사, JSON꺼내기, KST날, 버리기,
} from "../../web/lib/post-auto-core.mjs";
import { 출처대조 } from "./fact-check.mjs";
import { 티찾기, 가림찾기, 원장규칙, 관점프롬프트 } from "./review-gates.mjs";
import { 클로드코드, 클로드코드있음, 클로드기록연결 } from "./claude-code.mjs";
import { DB고객말 } from "../masks.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DRY = process.argv.includes("--dry");
const PICK = process.argv.includes("--pick");
const RI = process.argv.indexOf("--review");
const REVIEW = RI >= 0 ? process.argv[RI + 1] : null;
const CLIENT = 1;

const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);

const 끝 = (o) => {
  if (o.상태 === "실패") process.exitCode = 1;
  console.log(`AUTOPOST=${JSON.stringify(o)}`);
  return o;
};
const 활동 = (action, summary, ok = true) => (DRY ? Promise.resolve() : q(
  `insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1, 'content', $2, $3, $4)`,
  [CLIENT, action, ok, String(summary).slice(0, 1000)]).catch(() => {}));
const 자르기 = (s, n) => (String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));

// ─────────────────────────────────────────── --pick
async function 고르기() {
  if (!DRY) {
    const 이번주 = await q(이번주글SQL, [CLIENT]);
    if (이번주.length) {
      console.log(`이번 주 글이 이미 있습니다(/blog/${이번주[0].slug}${이번주[0].published ? " 발행" : " 감수 중"}). 주 1편이라 고르지 않습니다.`);
      return 끝({ 상태: "이번주있음", slug: 이번주[0].slug });
    }
  }
  const 은행 = JSON.parse(fs.readFileSync(new URL("../content/topics.json", import.meta.url), "utf8")).topics ?? [];
  const { 후보, 못읽음 } = await 후보모으기(q, { client: CLIENT, 은행 });
  if (못읽음.length) console.log(`  ⚠ 못 읽은 신호: ${못읽음.join(" · ")} — 나머지 신호로 고릅니다`);

  let 기록 = [];
  try {
    기록 = await q(`select topic_key, kind, at from academy.post_reviews where client_id = $1`, [CLIENT]);
  } catch (e) {
    // 기록 없이 고르면 버린 주제·쓴 주제를 또 고른다 — 실제 실행에서는 멈춘다
    if (!DRY) { console.log(`글 기록 표를 못 읽었습니다: ${e.message.slice(0, 120)}`); return 끝({ 상태: "실패", 왜: "글 기록 표를 못 읽음" }); }
    console.log("  ⚠ 글 기록 표(academy.post_reviews)가 아직 없습니다 — dry 라 기록 없이 거릅니다");
  }
  const 최근글 = await q(
    `select title, tags, published_at from academy.posts
      where client_id = $1 and published_at > now() - interval '28 days' order by published_at desc`, [CLIENT]);
  const 모든제목 = (await q(`select title from academy.posts where client_id = $1 and published`, [CLIENT])).map((r) => r.title);
  const { 남은것, 뺀것 } = 거르기(후보, 기록, 최근글, { 모든제목 });

  console.log(`\n후보 ${후보.length}개 · 남은 것 ${남은것.length}개 · 뺀 것 ${뺀것.length}개`);
  console.log("\n── 남은 후보 (점수순)");
  for (const c of 남은것.slice(0, 15)) {
    console.log(`  ${String(c.점수).padStart(3)}점 [${c.신호.join("+")}]${c.학원사실필요 ? " (학원 사실 필요)" : ""} ${c.제목}`);
    console.log(`        ${c.이유}`);
  }
  if (남은것.length > 15) console.log(`  … 그 밖 ${남은것.length - 15}개`);
  console.log("\n── 뺀 것");
  for (const x of 뺀것) console.log(`  · ${자르기(x.제목, 50)} — ${x.왜}`);

  if (!남은것.length) {
    await 활동("이번 주 쓸 주제 없음", `후보 ${후보.length}개가 모두 걸러짐`);
    return 끝({ 상태: "후보없음" });
  }

  const 라벨들 = await 재료모으기(q, CLIENT);
  console.log(`\n재료: 재료표 ${라벨들.m.length} · 상담 말 ${라벨들.i.length} · 원장 글 문단 ${라벨들.p.length}`);

  for (const c of 남은것.slice(0, 3)) {
    const 판 = 재료판정(c, 라벨들);
    console.log(`\n재료 관문: ${c.제목} → ${판.결과} (${판.왜})`);
    if (판.결과 === "재료부족") {
      if (!DRY) await 기록하기(q, { client: CLIENT, topic_key: c.키, kind: "재료부족", why: `「${c.제목}」 ${판.왜}` });
      continue;
    }
    // 쓰기에 넘길 라벨 재료. 재료 글은 write-draft 가 재료표(m)를 스스로 붙이니 상담 말·원장 글만 더 준다
    const 재료표 = (판.결과 === "재료" ? [...라벨들.i, ...라벨들.p] : [...라벨들.m, ...라벨들.i, ...라벨들.p])
      .map((r) => ({ 라벨: r.라벨, 원문: r.원문, ...(r.id ? { id: r.id } : {}) }));
    const 주제 = { 키: c.키, 제목: c.제목, 이유: c.이유, 신호: c.신호 };
    const 각도 = c.각도 || [
      c.신호.includes("A") || c.신호.includes("B") ? "학부모가 AI 에게 이 질문을 그대로 했는데 우리 사이트가 답에 안 나왔다. 첫 문단에서 질문에 대한 판단을 먼저 말한다." : "",
      c.경쟁출처?.length ? `대신 인용된 곳: ${c.경쟁출처.join(", ")} — 베끼지 않는다.` : "",
      c.신호.includes("C") ? `검색어 「${c.제목}」에서 우리가 안 보인다.` : "",
    ].filter(Boolean).join(" ");
    const 넘길것 = { 주제, 각도, 분류: c.분류 || "교육관점", 태그: c.태그 ?? [], 재료표 };
    if (DRY) {
      console.log(`  (dry) 여기서 고르고 ${판.결과 === "재료" ? "write-draft" : "write-news"} 에 넘깁니다. 넘길 라벨 재료 ${재료표.length}개`);
      return 끝({ 상태: "고름", dry: true, 제목: c.제목, 키: c.키, 모드: 판.결과 });
    }
    await 기록하기(q, { client: CLIENT, topic_key: c.키, kind: "고름", why: `「${c.제목}」 — ${c.이유}` });
    const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "auto-post-")), "topic.json");
    fs.writeFileSync(파일, JSON.stringify(넘길것));
    const 스크립트 = 판.결과 === "재료" ? "write-draft.mjs" : "write-news.mjs";
    const r = spawnSync(process.execPath, [fileURLToPath(new URL(`./${스크립트}`, import.meta.url)), "--topic-json", 파일],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: process.env });
    process.stdout.write(r.stdout ?? "");
    if (r.stderr) process.stderr.write(r.stderr);
    fs.rmSync(path.dirname(파일), { recursive: true, force: true });
    const slug = /DRAFT_SLUG=(\S+)/.exec(r.stdout ?? "")?.[1];
    if (slug) {
      await q(`update academy.post_reviews set slug = $2 where id = (select id from academy.post_reviews
                 where client_id = $1 and topic_key = $3 and kind = '고름' and slug is null order by at desc limit 1)`, [CLIENT, slug, c.키]).catch(() => {});
      return 끝({ 상태: "씀", slug, 제목: c.제목, 모드: 판.결과 });
    }
    if (r.status === 78) {
      // 쓸 사실을 못 찾음·게이트 두 번·키 없음 — 이 주제는 4주 미룬다. 매일 같은 주제로 검색을 다시 돌리지 않게
      await 기록하기(q, { client: CLIENT, topic_key: c.키, kind: "재료부족", why: `「${c.제목}」 쓰기가 빈손으로 끝남(쓸 사실을 못 찾았거나 검사에 두 번 걸림)` });
      return 끝({ 상태: "쓰기건너뜀", 제목: c.제목 });
    }
    return 끝({ 상태: "실패", 왜: `${스크립트} 종료 ${r.status}` });
  }
  await 활동("이번 주 쓸 주제 없음", "앞 후보 3개가 다 재료 부족");
  return 끝({ 상태: "재료부족" });
}

const main = async () => {
  if (PICK) return 고르기();
  if (REVIEW) return 감수하기(REVIEW);
  console.log("node scripts/auto-post.mjs --pick [--dry] | --review <slug> [--dry]");
  process.exitCode = 1;
};

// ─────────────────────────────────────────── --review (자동 감수 4관문, D81·D85~D87)
/**
 * 하루 1회차. a(출처 대조) → b(AI 티) → c(원장 관점) → d(가림) 고정, 앞이 지면 뒤는 안 돌린다(호출 절약).
 * 결과는 post_reviews '감수' 한 행(stages). 통과면 notes.감수 = {통과, 해시, 날} — 발행가능이 이 해시로 본문 변경을 막는다.
 * 한도·네트워크·호출 실패는 미룸(회차 안 셈). 3회차 실패면 버린다.
 * --dry: 발행 글도 받고, DB·본문을 안 쓴다(Claude 호출 기록도 안 남긴다 — 세는 것만 읽는다)
 */
const 규칙파일 = new URL("../../CLAUDE.md", import.meta.url);

async function 다듬기(제목, body, 티) {
  const r = await 클로드코드([
    "아래 마크다운 글에서 지적된 곳만 고쳐 써라. 내용·사실·주장·순서·소제목·링크·숫자는 그대로 둔다. 문장을 새로 지어 넣지 마라.",
    "고칠 때는 문장을 짧게 끊고, 빈 강조·흐린 마무리·훈계조 대신 구체적인 판단으로 바꾼다.",
    `지적된 것: ${티.join(" / ")}`,
    '형식: JSON 하나만 {"body":"고친 전체 마크다운"}',
    "",
    `# 제목\n${제목}`,
    "",
    body,
  ].join("\n"), { purpose: "감수", capRequired: true, timeoutMs: 8 * 60 * 1000, maxTurns: 2 });
  if (r.한도 || !r.ok) return { 미룸: true, 왜: `다듬기 호출 ${r.한도 ? "한도" : "실패"} — ${String(r.error ?? "").slice(0, 80)}` };
  const 후 = JSON꺼내기(r.text)?.body;
  const 안됨 = typeof 후 === "string" ? 다듬기검사(body, 후) : "답을 못 읽음";
  return 안됨 ? { ok: false, 왜: `다듬기 결과를 버림: ${안됨}` } : { ok: true, body: 후 };
}

/** 쓰기 모델에 고침 목록을 주고 한 번 다시 쓴다. 새 사실은 못 넣는다 — 다시 쓴 글은 (a)부터 다시 돈다 */
async function 다시쓰기(제목, body, 고침, 주장) {
  const r = await 클로드코드([
    "너는 송파에서 코딩·로봇 학원을 운영하는 원장이다. 아래 글이 발행 전 검사에 걸렸다. 걸린 것만 고쳐 다시 써라.",
    "새 사실·숫자·기관 이름·출처를 넣지 마라. 원문에 있는 사실만 쓴다. 지운 문장을 되살리지 마라.",
    "## 출처 절은 그대로 둔다. 제목은 학부모가 검색창에 치는 질문형(?·요·까로 끝). 소제목 ## 4개까지. 문단 80~400자. 목록은 한 군데까지.",
    "「우리 학원으로 오세요」로 닫지 않는다. 불안을 팔지 않는다. 하지 말아야 할 것을 한 번은 말한다.",
    "",
    `# 걸린 것\n- ${고침.join("\n- ")}`,
    "",
    '# 내놓을 형식 (JSON 하나만)\n{"title":"질문형 제목","body":"고친 전체 마크다운","주장":[{"문장":"본문 문장 그대로","종류":"바깥|학원|판단","출처":["주소"],"재료":["p1"]}]}',
    "주장 에는 숫자·기관·제도가 든 문장을 빠짐없이 넣는다. 원래 주장 목록:",
    JSON.stringify(주장 ?? []).slice(0, 6000),
    "",
    `# 제목\n${제목}`,
    "",
    `# 본문\n${body}`,
  ].join("\n"), { purpose: "writer", capRequired: true, timeoutMs: 10 * 60 * 1000, maxTurns: 2 });
  if (r.한도 || !r.ok) return { 미룸: true, 왜: `다시 쓰기 호출 ${r.한도 ? "한도" : "실패"} — ${String(r.error ?? "").slice(0, 80)}` };
  const j = JSON꺼내기(r.text);
  if (typeof j?.body !== "string" || j.body.trim().length < 600) return { ok: false, 왜: "다시 쓴 글을 못 읽음" };
  return { ok: true, 제목: String(j.title || 제목).slice(0, 200), body: j.body, 주장: Array.isArray(j.주장) ? j.주장 : 주장 };
}

const 대조요약 = (r) => ({
  통과: r.결과 === "통과", 왜: r.왜,
  출처: r.출처표.map((x) => ({ 주소: x.주소, 최종: x.최종 !== x.주소 ? x.최종 : undefined, 상태: x.상태, 왜: x.왜 || undefined, 맞음: x.맞음 })),
  대조: r.문장.length, 맞음: r.문장.filter((x) => x.판정 === "맞음").length, 지운것: r.지운것,
});

async function 감수하기(slug) {
  const [post] = await q(`select slug, title, coalesce(summary, '') summary, body, published, updated_at::text as updated,
      coalesce(review_notes, '{}'::jsonb) notes from academy.posts where slug = $1`, [slug]);
  if (!post) return 끝({ 행동: "대상없음", 왜: "글이 없음" });
  if (post.published && !DRY) return 끝({ 행동: "대상없음", 왜: "이미 발행됨" });
  const notes = post.notes;
  const 키 = notes.주제?.키 ?? `slug:${slug}`;
  if (!DRY && notes.감수?.통과 && notes.감수.해시 === 본문해시(post.body)) return 끝({ 행동: "통과", 이미: true, 왜: "이미 감수를 통과한 본문" });

  let 지난 = [];
  try {
    지난 = await q(`select attempt, at from academy.post_reviews where slug = $1 and kind = '감수' order by at`, [slug]);
  } catch (e) {
    if (!DRY) return 끝({ 행동: "미룸", 왜: "글 기록 표를 못 읽음" });
    console.log("  ⚠ 글 기록 표(academy.post_reviews)가 아직 없습니다 — dry 라 1회차로 봅니다");
  }
  const 오늘감수있음 = 지난.some((r) => KST날(Date.parse(String(r.at))) === KST날());
  if (오늘감수있음 && !DRY) return 끝({ 행동: "미룸", 왜: "오늘 감수는 이미 함 — 내일 다시" });
  const 회차 = 지난.length + 1;

  // Claude 호출 수는 늘 센다(상한). dry 는 세기만 하고 기록은 안 남긴다
  클로드기록연결(DRY ? (s, p) => (/^\s*select\b/i.test(s) ? q(s, p) : Promise.resolve([])) : q);
  if (!클로드코드있음()) return 끝({ 행동: "미룸", 왜: "Claude Code 가 없음" });
  const 규칙 = 원장규칙(fs.existsSync(규칙파일) ? fs.readFileSync(규칙파일, "utf8") : "");

  let 제목 = post.title;
  let body = post.body;
  let 주장 = notes.주장;
  const 재료들 = (Array.isArray(notes.재료표) ? notes.재료표 : []).map((m) => ({ said: String(m.원문 ?? ""), context: "" }));
  const 단계 = { 회차 };
  const 미룸 = (왜) => 끝({ 행동: "미룸", 회차, 왜 });
  console.log(`${제목}\n  /blog/${slug} · ${회차}회차${DRY ? " · dry" : ""}`);

  // 2회차부터: 지난 회차 실패 이유로 먼저 다시 쓴다(D87 「실패 이유를 고침 목록으로 다시 씀」)
  let 다시씀 = false;
  if (회차 >= 2 && Array.isArray(notes.감수?.고침) && notes.감수.고침.length) {
    const w = await 다시쓰기(제목, body, notes.감수.고침, 주장);
    if (w.미룸) return 미룸(w.왜);
    다시씀 = true;
    if (w.ok) ({ 제목, body, 주장 } = w);
    단계.다시쓰기 = w.ok ? "지난 회차에 걸린 것으로 다시 씀" : w.왜;
  }

  const 대조 = async () => 출처대조({ title: 제목, body }, { ...notes, 주장 }, { 클로드: 클로드코드 });
  // (a) 출처 대조
  let ra = await 대조();
  if (ra.결과 === "미룸") return 미룸(ra.왜);
  단계.a = 대조요약(ra);
  if (ra.결과 === "통과") body = ra.body;

  // (b) AI 티 — 다듬기 1 + 다시 쓰기 1(다시 쓰면 a부터)
  let 티 = [];
  if (ra.결과 === "통과") {
    티 = 티찾기(제목, body, 재료들);
    const 처음 = [...티];
    let 다듬음 = "";
    if (티.length) {
      const d = await 다듬기(제목, body, 티);
      if (d.미룸) return 미룸(d.왜);
      if (d.ok) { body = d.body; 티 = 티찾기(제목, body, 재료들); 다듬음 = `다듬음 (걸린 것 ${처음.length}→${티.length})`; } else 다듬음 = d.왜;
    }
    if (티.length && !다시씀) {
      const w = await 다시쓰기(제목, body, 티, 주장);
      if (w.미룸) return 미룸(w.왜);
      다시씀 = true;
      if (w.ok) {
        ({ 제목, body, 주장 } = w);
        ra = await 대조();
        if (ra.결과 === "미룸") return 미룸(ra.왜);
        // 다시 쓴 글은 (a)부터 다시 — 처음 대조 결과도 남긴다(카드·보고에서 무엇이 바뀌었는지 보이게)
        단계.a처음 = 단계.a;
        단계.a = { ...대조요약(ra), 다시쓴뒤: true };
        if (ra.결과 === "통과") { body = ra.body; 티 = 티찾기(제목, body, 재료들); }
      }
      다듬음 = `${다듬음 ? `${다듬음} · ` : ""}${w.ok ? "다시 씀" : w.왜}`;
    }
    단계.b = { 통과: ra.결과 === "통과" && !티.length, 처음, 걸림: 티, 고친것: 다듬음 || undefined };
  }

  // (c) 원장 관점 — 쓰기 프롬프트를 안 보는 다른 호출
  if (ra.결과 === "통과" && 단계.b?.통과) {
    if (!규칙) 단계.c = { 통과: false, 왜: "CLAUDE.md 규칙을 못 읽음" };
    else {
      const 버린 = await q(`select reasons, note from academy.draft_feedback where client_id = $1 order by created_at desc limit 5`, [CLIENT]).catch(() => []);
      const r = await 클로드코드(관점프롬프트({ 규칙, 제목, 본문: body,
        버린이유: 버린.map((f) => `${(f.reasons ?? []).join(" · ")}${f.note ? ` — 「${f.note}」` : ""}`) }),
      { purpose: "감수", capRequired: true, timeoutMs: 8 * 60 * 1000, maxTurns: 2 });
      if (r.한도 || !r.ok) return 미룸(`원장 관점 호출 ${r.한도 ? "한도" : "실패"} — ${String(r.error ?? "").slice(0, 80)}`);
      단계.c = 관점읽기(r.text, body);
    }
  }

  // (d) 가림 — 다른 고객사 이름·도메인(쉬는·끝난 고객 포함) + 옛 이름. 자동으로 안 지운다
  if (단계.c?.통과) {
    const 말들 = await DB고객말(q, CLIENT).catch(() => null);
    const 걸림 = 말들 === null ? ["고객 목록을 못 읽음"] : 가림찾기(`${제목}\n${post.summary}\n${body}`, 말들);
    단계.d = { 통과: !걸림.length, 걸림 };
  }

  const 통과 = Boolean(단계.d?.통과);
  const 실패이유 = !통과
    ? (ra.결과 !== "통과" ? [`출처 대조: ${ra.왜}`, ...ra.문장.filter((x) => x.판정 !== "맞음").slice(0, 5).map((x) => `출처에 없는 문장: ${x.문장.slice(0, 80)}`)]
      : !단계.b?.통과 ? 티.map((x) => `AI 티: ${x}`)
        : !단계.c?.통과 ? [`원장 관점: ${단계.c.왜}`, ...(단계.c.걸림 ?? []).map((g) => `${g.종류}: ${g.문장.slice(0, 80)}`)]
          : [`가림: ${단계.d.걸림.join(", ")}`])
    : [];
  const 왜 = 통과 ? "4관문 통과" : 실패이유[0];
  const 행동 = 다음행동({ 회차, 결과: 통과 ? "통과" : "실패" });

  if (단계.a처음) {
    console.log(`\n── (a) 출처 대조(처음 글): ${단계.a처음.통과 ? "통과" : "걸림"} — ${단계.a처음.왜}`);
    for (const x of 단계.a처음.지운것 ?? []) console.log(`    지웠을 문장: ${x.slice(0, 100)}`);
  }
  if (제목 !== post.title) console.log(`  다시 쓴 제목: ${제목}`);
  console.log(`\n── (a) 출처 대조${단계.a처음 ? "(다시 쓴 글)" : ""}: ${단계.a.통과 ? "통과" : "걸림"} — ${단계.a.왜}`);
  for (const x of 단계.a.출처) console.log(`  ${x.상태.padEnd(4)} ${x.주소}${x.최종 ? `\n         → ${x.최종}` : ""}${x.왜 ? ` (${x.왜})` : ""}${x.맞음 ? ` · 맞은 문장 ${x.맞음}` : ""}`);
  for (const s of ra.문장) console.log(`  ${s.판정 === "맞음" ? "✓" : "✗"} [${s.판정}${s.왜 ? ` · ${s.왜}` : ""}] ${s.문장.slice(0, 90)}`);
  if (ra.지운것.length) { console.log("  지웠을 문장:"); for (const s of ra.지운것) console.log(`    - ${s.slice(0, 120)}`); }
  console.log(`── (b) AI 티: ${단계.b ? (단계.b.통과 ? "통과" : "걸림") : "안 돌림"}${단계.b?.고친것 ? ` · ${단계.b.고친것}` : ""}`);
  for (const x of 단계.b?.처음 ?? []) console.log(`  처음: ${x}`);
  for (const x of 단계.b?.걸림 ?? []) console.log(`  남음: ${x}`);
  console.log(`── (c) 원장 관점: ${단계.c ? (단계.c.통과 ? "통과" : `걸림 — ${단계.c.왜}`) : "안 돌림"}`);
  for (const g of 단계.c?.걸림 ?? []) console.log(`  ${g.종류}: ${g.문장.slice(0, 100)}`);
  if (단계.c?.말리기) console.log(`  말리기: ${단계.c.말리기.slice(0, 100)}`);
  console.log(`── (d) 가림: ${단계.d ? (단계.d.통과 ? "통과" : `걸림 — ${단계.d.걸림.join(", ")}`) : "안 돌림"}`);
  console.log(`\n결과: ${통과 ? "통과" : "실패"} — ${왜} → ${DRY ? `(dry) ${행동}` : 행동}`);

  if (DRY) return 끝({ 행동, dry: true, 회차, 왜 });

  // 본문·메모 — 감수 중 원장이 고쳤으면 덮어쓰지 않는다(updated_at 낙관 잠금, company review 꼴)
  const 바뀜 = body !== post.body || 제목 !== post.title;
  const 새메모 = {
    ...notes, 주장,
    ...(바뀜 && !notes.원문 ? { 원문: post.body } : {}),
    감수: 통과 ? { 통과: true, 해시: 본문해시(body), 날: KST날(), 회차 } : { 통과: false, 회차, 고침: 실패이유, 날: KST날() },
    감수기록: 단계,
  };
  const 저장 = await q(`update academy.posts set title = $2, body = $3, review_notes = $4::jsonb, updated_at = now()
      where slug = $1 and not published and updated_at = $5::timestamptz returning slug`,
    [slug, 제목, ra.결과 === "통과" || 다시씀 ? body : post.body, JSON.stringify(새메모), post.updated]);
  if (!저장.length) return 미룸("감수하는 사이 본문이 고쳐짐 — 새 본문으로 다시");
  await 기록하기(q, { client: CLIENT, slug, topic_key: 키, kind: "감수", attempt: 회차, passed: 통과, stages: 단계, why: 왜 });
  if (행동 === "버림") await 버리기(q, slug, { 왜 });
  return 끝({ 행동, 회차, 왜 });
}

main()
  .catch((e) => { console.log("실패:", e.message.slice(0, 300)); 끝({ 상태: "실패", 행동: "미룸", 왜: e.message.slice(0, 200) }); process.exitCode = 1; })
  .finally(() => pool.end());
