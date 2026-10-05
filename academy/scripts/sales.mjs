/**
 * 영업 담당 — 고객 유치(목표 3)에 담당이 생긴다. 준비는 에이전트, 보내는 건 원장 (Step 11).
 *
 * 9/22 까지 목표 3 에는 담당 에이전트가 없었다. 케이스 리포트는 손으로 갱신할 때만 새로워지고,
 * 영업판 후보 10곳은 다음 연락일(9/17)이 지난 채 서 있었다.
 *
 * 한 번 돌 때 (매주 월요일 08:10 KST)
 *   1. 케이스 리포트 공개본을 새로 뽑는다. 쓰기 전에 가림 검사 — 고객사 이름·도메인·지역어·가린 경쟁 브랜드·영업 후보 이름·
 *      전화번호가 하나라도 있으면(띄어쓰기·엔티티·태그·영문·URL 인코딩으로 바꿔 써도) 공개본을 바꾸지 않고 사람 대기
 *   2. 연락일 지난 영업 후보 → 주간 묶음 일감 하나(가장 오래 밀린 3곳만 통화문, 나머지는 이름만)
 *   3. 24시간 넘게 연락 안 한 리드마다 답장 초안 → 사람 대기
 *   4. 한 주 한 줄: 연락한 곳 · 다음 약속 · 리드 · 밀린 후보 · 완료 표시했지만 연락일이 그대로인 후보 (전부 DB 에서 센 값)
 *   커밋·푸시는 따로(--push) 한다. GitHub 토큰은 그 단계에만 있다 — claude 를 부르는 단계에는 없다
 *
 * 아무것도 자동으로 보내지 않는다. 전화·문자·메일은 원장.
 * 초안은 claude 한 번(주 1회)에 묶어 받는다. 재료는 케이스 리포트 공개본 문장과 그 후보·리드 행뿐이다.
 * 초안에 재료에 없는 숫자·단위 구절이 있거나 가릴 말이 있으면 버리고 숫자 없는 틀로 바꾼다 — 지어내지 않는다.
 *
 *   node scripts/sales.mjs              리포트 쓰기 + 초안 (커밋 안 함)
 *   node scripts/sales.mjs --push       공개본이 바뀌었으면 커밋·푸시 (GH_TOKEN 필요)
 *   node scripts/sales.mjs --leak-test  가림 검사가 새는 공개본을 잡는지 본다 (claude·커밋 없음)
 *   node scripts/sales.mjs --draft-test 초안 숫자 검사가 지어낸 숫자를 잡는지 본다 (claude·DB 쓰기 없음)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadClients } from "../clients.mjs";
import { 가릴원문, 같은지역구, 가림검사, 고객사말, 수검사, 풀기 } from "../masks.mjs";
import { 클로드코드, 클로드코드있음, 클로드기록연결 } from "./claude-code.mjs";
import { 프로필 } from "./profile.mjs";

const envFile = new URL("../.env.local", import.meta.url);
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const MODE = ["--push", "--leak-test", "--draft-test"].find((a) => process.argv.includes(a)) ?? "run";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ACADEMY = path.join(ROOT, "academy");
const 공개본경로 = "web/public/case/academy.html";
const 공개본 = path.join(ROOT, 공개본경로);
const HOUSE = 1;
const ADMIN = process.env.ADMIN_BASE_URL || "https://geo-rose-nine.vercel.app";
const 리포트주소 = `${ADMIN}/case/academy.html`;
const REPO = process.env.GITHUB_REPOSITORY || "leeledger/geo";

const pool = MODE === "--draft-test" ? null : new Pool((() => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } };
})());
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
if (pool) 클로드기록연결(q);

const KST = (d = new Date()) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 오늘 = () => KST().slice(0, 10);
const 한줄 = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** 이번 주 월요일(KST) — 묶음 일감 키 */
const 이번주 = () => {
  const d = new Date(`${오늘()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// ─────────────────────────────────────────── 가림 검사
/**
 * 공개본에 있으면 안 되는 말. 조합되면 특정된다 — 이름만이 아니라 지역·전화까지 (CLAUDE.md 「고객사는 가린다」).
 * masks.mjs 의 원문 쪽 말 + clients.mjs 이름·도메인·표기 + 영업 후보 이름.
 * 영업 후보 이름을 못 읽으면 멈춘다 — 조용히 빼고 통과하면 경쟁 학원 이름이 새도 모른다(Richard 9/22)
 * 검사 함수(가림검사·수검사)는 masks.mjs 에 있다 — 도해 담당(illustrate.mjs)이 같이 쓴다(Step 12)
 */
const 가릴말 = async ({ 후보 = true } = {}) => {
  // 코드 3곳 + DB 고객(시험 고객 포함). DB 가 열려 있으면 못 읽을 때 멈춘다(fail-closed) — DB 고객 이름이 빠진 채 통과하지 않게
  const 말 = new Set([...가릴원문, ...고객사말(await loadClients(pool ? q : null, { includeTest: true, strict: Boolean(pool) }))]);
  if (후보) {
    const rows = await q(`select name from geo.outreach_targets`); // 실패하면 throw — fail-closed
    for (const r of rows) if (r.name?.length >= 2) 말.add(r.name);
  }
  return [...말].filter(Boolean);
};

// ─────────────────────────────────────────── 초안 숫자 검사
/** 틀 문장에서 쓰는 구절 — 주장이 아니라 말투다 */
const 틀구절 = new Set(["세가지", "다섯건", "한달", "한곳", "한번"]);
const 초안검사 = (초안, 재료, 말들, 금지말 = []) => {
  const 모르는숫자 = 수검사(초안, 재료, 틀구절);
  const 걸림 = [...가림검사(초안, 말들), ...금지말.filter((w) => 초안.includes(w)).map((w) => `같은 지역 후보에게 쓰면 안 되는 말 「${w}」`)];
  return { ok: !모르는숫자.length && !걸림.length, 모르는숫자, 걸림 };
};

// ─────────────────────────────────────────── 1. 케이스 리포트 (쓰기만, 커밋은 --push)
const 리포트갱신 = async (말들) => {
  const tmp = path.join(os.tmpdir(), `case-${Date.now()}.html`);
  const r = spawnSync(process.execPath, ["scripts/case-report.mjs", "--out", tmp], { cwd: ACADEMY, encoding: "utf8", timeout: 5 * 60 * 1000 });
  if (r.status !== 0 || !fs.existsSync(tmp)) throw new Error(`case-report 실패 ${한줄(`${r.stdout}${r.stderr}`, 300)}`);
  const html = fs.readFileSync(tmp, "utf8");
  fs.rmSync(tmp, { force: true });
  const 걸림 = 가림검사(html, 말들);
  if (걸림.length) {
    // 가릴 말이 남은 공개본은 쓰지 않는다. 어떤 말인지는 사람 줄에만 적는다(공개 경로로 안 나간다)
    await 사람대기({ key: "case-report-leak", title: "케이스 리포트 공개본에 가릴 말이 남아 갱신을 멈췄습니다", priority: 5,
      detail: `걸린 말: ${걸림.join(", ")}\nacademy/masks.mjs 에 가림을 더한 뒤 다음 주 실행을 기다리거나 sales.yml 을 다시 돌립니다. 지금 공개본은 그대로입니다.` });
    return { 결과: `멈춤 — 가릴 말 ${걸림.length}개`, html: null };
  }
  await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n' || $2, 4000)
    where client_id=$1 and dedupe_key='case-report-leak' and status='사람 대기'`, [HOUSE, `${KST()} 가림 검사 통과`]);
  const 옛것 = fs.existsSync(공개본) ? fs.readFileSync(공개본, "utf8") : "";
  // 「N일차에 갱신」 줄만 다르면 바뀐 게 아니다
  if (옛것.replace(/\d+일차에 갱신/g, "") === html.replace(/\d+일차에 갱신/g, "")) return { 결과: "바뀐 것 없음", html };
  fs.writeFileSync(공개본, html, "utf8");
  return { 결과: "새로 뽑음 — 다음 단계(--push)가 커밋", html };
};

/** 공개본 커밋·푸시. 이 단계에만 GH_TOKEN 이 있다. 체크아웃은 자격 증명을 남기지 않는다(persist-credentials: false) */
const 올리기 = async () => {
  const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
  const TOKEN = process.env.GH_TOKEN;
  const 가림 = (s) => (TOKEN ? String(s ?? "").split(TOKEN).join("***") : String(s ?? ""));
  if (git("diff", "--quiet", "--", 공개본경로).status === 0) { console.log("  공개본 바뀐 것 없음 — 커밋 안 함"); return; }
  if (!TOKEN) throw new Error("GH_TOKEN 없음 — 푸시 못 함");
  // 푸시 단계는 워킹 트리에 있는 무엇이든 올린다. 앞 단계를 믿지 말고 커밋 직전에 한 번 더 본다(Richard 9/22)
  const 걸림 = 가림검사(fs.readFileSync(공개본, "utf8"), await 가릴말());
  if (걸림.length) {
    git("checkout", "--", 공개본경로);
    await 사람대기({ key: "case-report-leak", title: "케이스 리포트 공개본에 가릴 말이 남아 커밋을 멈췄습니다", priority: 5,
      detail: `커밋 직전 검사에서 걸린 말: ${걸림.join(", ")}\n공개본은 그대로입니다. academy/masks.mjs 를 고친 뒤 sales.yml 을 다시 돌립니다.` });
    throw new Error(`커밋 직전 가림 검사에 걸림 ${걸림.length}개 — 커밋 안 함`);
  }
  const 원격 = `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
  git("add", "--", 공개본경로);
  const c = git("-c", "user.name=sales-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-q", "-m",
    `케이스 리포트 주간 갱신 (${오늘()}) — sales.mjs, 가림 검사 통과`);
  if (c.status !== 0) throw new Error(`커밋 실패 ${가림(c.stderr)}`);
  let p = git("push", 원격, "HEAD:refs/heads/main");
  if (p.status !== 0) {
    const f = git("fetch", 원격, "+refs/heads/main:refs/remotes/origin/main");
    const rb = f.status === 0 ? git("rebase", "origin/main") : { status: 1, stderr: `fetch 실패 ${f.stderr}` };
    if (rb.status !== 0) {
      // rebase 가 멈춘 채로 끝나지 않게 되돌리고 사람에게(Richard 9/22)
      git("rebase", "--abort");
      await 사람대기({ key: "case-report-push", title: "케이스 리포트 공개본을 못 올렸습니다 (main 과 충돌)", priority: 10,
        detail: `가림 검사는 통과했지만 푸시가 거절되고 다시 올리다 충돌했습니다: ${한줄(가림(rb.stderr), 300)}\nsales.yml 을 다시 돌리면 새로 뽑아 올립니다.` });
      throw new Error("공개본 푸시 실패 — rebase 충돌, 사람 대기로 올림");
    }
    p = git("push", 원격, "HEAD:refs/heads/main");
  }
  if (p.status !== 0) {
    await 사람대기({ key: "case-report-push", title: "케이스 리포트 공개본을 못 올렸습니다", priority: 10, detail: 한줄(가림(p.stderr), 400) });
    throw new Error(`공개본 푸시 실패 ${한줄(가림(p.stderr), 200)}`);
  }
  await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now() where client_id=$1 and dedupe_key='case-report-push' and status='사람 대기'`, [HOUSE]);
  console.log(`  공개본 커밋·푸시 ${git("rev-parse", "--short", "HEAD").stdout.trim()}`);
};

// ─────────────────────────────────────────── 일감
const 사람대기 = ({ key, title, detail, priority = 30, link = null, payload = {} }) =>
  q(`insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, status, priority, payload, link)
      values ($1,'sales','human',$2,$3,$4,'사람 대기',$5,$6::jsonb,$7)
    on conflict (client_id, dedupe_key) do update set title=excluded.title, detail=excluded.detail, priority=excluded.priority,
      link=coalesce(excluded.link, geo.agent_tasks.link), payload=geo.agent_tasks.payload || excluded.payload, updated_at=now(),
      status = case when geo.agent_tasks.status in ('완료','닫힘') then geo.agent_tasks.status else '사람 대기' end`,
    [HOUSE, key, title.slice(0, 300), detail, priority, JSON.stringify({ sticky: true, ...payload }), link]);

// ─────────────────────────────────────────── 2·3. 초안
const 같은지역 = (t) => 같은지역구.some((g) => String(t.district ?? "").includes(g));
// 같은 지역 후보에게는 케이스 리포트 링크도, 운영자가 학원을 한다는 말도 안 쓴다 — 조합되면 우리 학원이 특정된다(9/22 Arch)
const 지역금지말 = ["case/academy", "http", "리포트", "실증", "사례", "직접 운영", "운영하는 학원", "우리 학원", "저희 학원"];

// 숫자 없는 틀 — claude 를 못 불렀거나 초안이 검사에 떨어졌을 때 쓴다
const 통화틀 = (t) => [
  `안녕하세요, ${t.name} 원장님 맞으시죠. 사이티드라는 곳입니다. 학부모가 AI 에게 학원을 물을 때 어떤 학원 이름이 나오는지 보는 일을 합니다.`,
  "영업 전화라서 먼저 말씀드립니다. 세 가지만 여쭙고 맞지 않으면 바로 끊겠습니다.",
  "상담은 원장님이 직접 하시나요. 상담 문의가 한 달에 다섯 건 넘게 오나요. 지점은 한 곳인가요.",
  같은지역(t)
    ? "셋 다 아니면 저희 일이 도움이 안 됩니다. 셋 다 맞으시면 어떻게 재고 무엇을 하는지 말로 먼저 설명드리겠습니다. 들어 보시고 아니다 싶으면 거기서 끝내셔도 됩니다."
    : `셋 다 아니면 저희 일이 도움이 안 됩니다. 셋 다 맞으시면 저희가 잰 기록(${리포트주소})을 보내 드려도 될까요. 보시고 아니다 싶으면 답 안 주셔도 됩니다.`,
].join("\n");
const 답장틀 = (l) => [
  `${l.name ? `${l.name}님` : "안녕하세요"}, 사이티드입니다. 남겨 주신 연락처로 답장드립니다.`,
  l.wants ? `「${l.wants}」 쪽을 원하신다고 적어 주셨습니다.` : "어떤 도움이 필요하신지는 아직 모릅니다.",
  "지금 AI 답변에 어떤 이름이 나오는지 먼저 같이 보고, 저희 일이 맞는지는 그다음에 판단하셔도 됩니다. 맞지 않으면 그렇다고 말씀드리겠습니다.",
  "편하신 시간을 알려 주시면 그때 연락드리겠습니다.",
].join("\n");

const 초안받기 = async (targets, leads, 리포트글) => {
  if (!targets.length && !leads.length) return { 초안: {}, 이유: "초안 대상 없음" };
  const [{ n }] = await q(`select count(*)::int n from geo.claude_calls where purpose='sales' and at > now() - interval '6 days'`);
  if (n >= 1) return { 초안: {}, 이유: "이번 주 claude 1회를 이미 씀 — 숫자 없는 틀을 쓴다" };
  if (!클로드코드있음()) return { 초안: {}, 이유: "Claude Code 없음 — 숫자 없는 틀을 쓴다" };
  const prompt = [
    "사이티드(AI 답변에 학원 이름이 불리게 돕는 대행사)의 영업 초안을 쓴다. 보내는 건 사람이다. 너는 초안만 쓴다.",
    "",
    "규칙",
    "- 지어내지 않는다. 숫자와 「세 배」「두 달」 같은 수 표현은 아래 재료에 그대로 있는 것만 쓴다. 재료에 없으면 「아직 모릅니다」라고 쓴다",
    "- 우리 실증 학원의 이름·지역·주소·전화를 쓰지 않는다. 리포트 공개본에 가려진 것([학원명]·[구]·[동] 등)을 풀지 않는다",
    "- 통화 상대는 다른 학원이다. 우리가 학원을 운영한다는 말도 하지 않는다",
    "- 「같은지역」이 true 인 후보에게는 케이스 리포트 링크·주소를 쓰지 않고, 실증·사례·리포트라는 말도 쓰지 않는다. 우리 방식을 말로만 설명한다",
    "- 번역체를 쓰지 않는다. 문장을 짧게 끊는다. 사람이 말하듯 쓴다. 「정말」「매우」「놀라운」「혁신적인」 금지",
    "- 불안을 팔지 않는다(「지금 안 하면 늦습니다」 류 금지). 다 좋다고 하지 않는다 — 우리 일이 안 맞는 경우를 한 번은 말한다",
    "- 「저희에게 맡기세요」로 닫지 않는다. 상대가 판단할 기준을 주고 끝낸다",
    "- 통화문: 영업 전화임을 먼저 밝히고, 다음 행동(예: 세 가지 조건 확인)을 묻는다. 6문장 안",
    "- 리드 답장: 그 리드가 남긴 것(원하는 것·고민·사이트)에만 답한다. 진단 점수는 그 행에 있을 때만",
    "",
    '출력은 JSON 하나만: {"call":{"<후보 id>":"통화문"},"reply":{"<리드 id>":"답장"}}',
    "",
    "재료 1 — 케이스 리포트 공개본(가려진 것):",
    리포트글.slice(0, 6000),
    "",
    "재료 2 — 이번 주 통화할 영업 후보:",
    JSON.stringify(targets.map((t) => ({ id: t.id, 이름: t.name, 지역: t.district, 같은지역: 같은지역(t), 다음할일: t.next_action, 메모: t.note,
      원장상담: t.owner_consults, 월문의5건이상: t.monthly_inquiries_5plus, 단일지점: t.single_location })), null, 1),
    "",
    "재료 3 — 24시간 넘게 답 안 한 리드:",
    JSON.stringify(leads.map((l) => ({ id: l.id, 이름: l.name, 회사: l.company, 원함: l.wants, 고민: l.concerns, 사이트: l.site,
      알게된곳: l.referral, 진단점수: l.total ?? null, 진단등급: l.grade ?? null })), null, 1),
  ].join("\n");
  // 도구 없이 빈 임시 폴더에서 부른다 — 저장소도 웹도 안 본다. 비밀도 자식 환경에서 뺀다
  // 영업 담당 프로필은 표준입력 프롬프트 앞에. system 은 한 줄로 둔다(여러 줄 인자는 윈도 cmd 에서 잘린다)
  const r = await 클로드코드(`${프로필("sales")}\n\n---\n\n${prompt}`, { purpose: "sales", capRequired: true, maxTurns: 3, timeoutMs: 8 * 60 * 1000,
    envDrop: ["DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN"],
    system: "너는 한국어로 짧고 정직한 영업 초안을 쓰는 도우미다. 규칙과 출력 형식은 사용자 메시지에 있다." });
  if (!r.ok) return { 초안: {}, 이유: `claude ${r.한도 ? "한도" : "실패"} — ${한줄(r.error, 120)} · 숫자 없는 틀을 쓴다` };
  const m = /\{[\s\S]*\}/.exec(String(r.text).replace(/^```(json)?|```$/gm, ""));
  try { return { 초안: JSON.parse(m?.[0] ?? ""), 이유: "claude 1회" }; }
  catch { return { 초안: {}, 이유: "claude 답이 JSON 이 아님 — 숫자 없는 틀을 쓴다" }; }
};

/** 초안 하나를 검사해 쓸 글·버린 이유를 돌려준다 */
const 고르기 = (글, 재료, 말들, 금지말, 틀) => {
  if (!글) return { 글: 틀, 주의: "" };
  const 검사 = 초안검사(글, 재료, 말들, 금지말);
  if (검사.ok) return { 글, 주의: "" };
  return { 글: 틀, 원문: 글, 주의: `(claude 초안을 버림 — ${[...검사.모르는숫자.map((x) => `재료에 없는 수 ${x}`), ...검사.걸림.map((x) => `가릴 말 ${x}`)].join(", ")})` };
};

// ─────────────────────────────────────────── 시험
/** 새는 공개본을 일부러 만들어 가림 검사가 잡는지 본다. 가린 공개본은 통과해야 한다 */
const 새는지시험 = async () => {
  const 말들 = await 가릴말();
  const 후보 = (await q(`select name from geo.outreach_targets order by name limit 1`))[0]?.name ?? "후보없음";
  const 경우 = [
    ["학원 이름", "<p>로봇&amp;코딩학원 착수 1일차</p>", true],
    ["입말 이름", "<p>로봇앤코딩 원장님 인터뷰</p>", true],
    ["띄어쓰기", "<p>로봇 & 코딩 학원</p>", true],
    ["띄어쓴 엔티티", "<p>로봇 &amp; 코딩</p>", true],
    ["띄어쓴 입말", "<p>로봇 앤 코딩</p>", true],
    ["숫자 엔티티", "<p>로봇&#38;코딩 · 로봇&#x26;코딩</p>", true],
    ["태그로 쪼갬", "<p>로봇<b>&amp;</b>코딩</p>", true],
    ["영문 표기", "<p>robot&amp;coding · robot and coding · RobotCoding</p>", true],
    ["URL 인코딩", "<a href=\"/q?%EC%86%A1%ED%8C%8C%EA%B5%AC\">검색</a>", true],
    ["도메인", "<a href=\"https://robotncoding.com/blog\">글</a>", true],
    ["지역어", "<p>서울 송파구 석촌동 코딩학원</p>", true],
    ["가린 경쟁 브랜드", "<p>로보티즈 · 디랩 · 글로벌리더센터</p>", true],
    ["지역 학원 사이트", "<p>송파런 목록</p>", true],
    ["글 주소", "<p>/blog/aiga-sukjereul-haetdamyeon</p>", true],
    ["주소", "<p>송파대로37길 52</p>", true],
    ["전화번호", "<p>문의 02-422-0525</p>", true],
    ["휴대전화", "<p>010-1234-5678</p>", true],
    ["영업 후보 이름", `<p>${후보} 과 비교</p>`, true],
    ["가린 공개본", "<p>[학원명] · [구] [동] 코딩학원 · 착수 17일차 · 크롤러 방문 1,234회 · /blog/(글) · 학원 브랜드 A · 손가락</p>", false],
  ];
  let 틀림 = 0;
  console.log(`가림 검사 시험 · 가릴 말 ${말들.length}개`);
  for (const [이름, html, 새야] of 경우) {
    const 걸림 = 가림검사(html, 말들);
    const ok = 새야 ? 걸림.length > 0 : 걸림.length === 0;
    if (!ok) 틀림++;
    console.log(`  ${ok ? "✓" : "✗"} ${이름} — ${새야 ? "잡아야 함" : "통과해야 함"} · ${걸림.length ? `걸림 ${걸림.length}개` : "걸림 없음"}`);
  }
  const 지금 = fs.existsSync(공개본) ? 가림검사(fs.readFileSync(공개본, "utf8"), 말들) : ["공개본 없음"];
  console.log(`  ${지금.length ? "✗" : "✓"} 지금 ${공개본경로} — ${지금.length ? `걸림 ${지금.join(", ")}` : "걸림 없음"}`);
  if (틀림 || 지금.length) process.exitCode = 1;
};

/** 지어낸 숫자·단위 구절을 잡는지 본다. 틀 문장은 통과해야 한다 */
const 초안시험 = async () => {
  const 말들 = await 가릴말({ 후보: false });
  const 재료 = "AI 크롤러 방문 895회 · 검색 크롤러 방문 591회 · 공개 문서 45편 · 착수 17일차 · 사이트 진단 92 /100";
  const 먼곳 = { name: "시험학원", district: "마포" };
  const 가까운곳 = { name: "시험학원", district: "송파" };
  const 경우 = [
    ["30% 늘었다", "문의가 30% 늘었습니다.", [], false],
    ["세 배", "방문이 세 배로 늘었습니다.", [], false],
    ["두 달 만에", "두 달 만에 효과가 났습니다.", [], false],
    ["수만 명 (목록에 더한 수사)", "수만 명이 봤습니다.", [], false],
    ["몇 배", "문의가 몇 배 늘었습니다.", [], false],
    ["중요한 점 (수가 아님)", "중요한 점은 기록입니다.", [], true],
    ["재료에 없는 숫자", "크롤러가 1486회 왔습니다.", [], false],
    ["부분 숫자 속임(30 → 3)", "3곳에서 문의가 왔습니다.", [], false],
    ["재료에 있는 구절", "AI 크롤러가 895회 왔습니다. 공개 문서 45편을 올렸습니다.", [], true],
    ["통화틀 — 먼 곳", 통화틀(먼곳), [], true],
    ["통화틀 — 같은 지역", 통화틀(가까운곳), 지역금지말, true],
    ["같은 지역에 리포트 링크", `저희 기록은 ${리포트주소} 에 있습니다.`, 지역금지말, false],
    ["같은 지역에 실증 언급", "저희가 직접 운영하는 학원에서 실증했습니다.", 지역금지말, false],
    ["답장틀", 답장틀({ name: "김", wants: "측정" }), [], true],
  ];
  let 틀림 = 0;
  console.log("초안 숫자 검사 시험");
  for (const [이름, 초안, 금지, 통과] of 경우) {
    const r = 초안검사(초안, 재료, 말들, 금지);
    const ok = r.ok === 통과;
    if (!ok) 틀림++;
    console.log(`  ${ok ? "✓" : "✗"} ${이름} — ${통과 ? "통과해야 함" : "버려야 함"} · ${r.ok ? "통과" : `버림: ${[...r.모르는숫자, ...r.걸림].join(", ")}`}`);
  }
  if (틀림) process.exitCode = 1;
};

// ─────────────────────────────────────────── 실행
const 실행 = async () => {
  console.log(`영업 담당 · ${KST()} KST`);
  const 말들 = await 가릴말();
  const 리포트 = await 리포트갱신(말들);
  console.log(`  케이스 리포트: ${리포트.결과}`);
  const 리포트글 = 풀기(리포트.html ?? (fs.existsSync(공개본) ? fs.readFileSync(공개본, "utf8") : "")).replace(/\s+/g, " ").trim();

  const 밀린 = await q(`select id::text, name, district, neighborhood, next_action, note, next_due::text, status,
      owner_consults, monthly_inquiries_5plus, single_location
    from geo.outreach_targets where next_due <= (now() at time zone 'Asia/Seoul')::date and status not in ('결제','제외')
    order by next_due, priority, name`);
  // 원장의 통화 여력 — 한 주에 통화문은 가장 오래 밀린 3곳만. 나머지는 이름과 수만 적는다(9/22 Arch)
  const targets = 밀린.slice(0, 3);
  const leads = await q(`select l.id::text, l.name, l.company, l.wants, l.concerns, l.site, l.referral, s.total, s.grade,
      to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') created
    from geo.leads l left join geo.scans s on s.id = l.scan_id
    where coalesce(l.status,'new')='new' and l.created_at < now() - interval '24 hours' order by l.created_at`);
  console.log(`  연락일 지난 영업 후보 ${밀린.length}곳 (통화문 ${targets.length}) · 24시간 넘은 리드 ${leads.length}건`);

  const { 초안, 이유 } = await 초안받기(targets, leads, 리포트글);
  console.log(`  초안: ${이유}`);
  let 버림 = 0;

  const 키 = `sales-calls-${이번주()}`;
  // 지난주 묶음을 원장이 완료 표시했는데 영업판 연락일은 그대로인 후보 — 조용히 빠지지 않게 센다(Richard 9/22)
  const 지난묶음 = await q(`select payload from geo.agent_tasks where client_id=$1 and dedupe_key like 'sales-calls-%' and dedupe_key <> $2
      and status='완료' and done_at > now() - interval '14 days'`, [HOUSE, 키]);
  const 완료했던 = new Set(지난묶음.flatMap((t) => t.payload?.target_ids ?? []));
  const 그대로 = 밀린.filter((t) => 완료했던.has(t.id)).length;

  if (밀린.length) {
    const 블록 = targets.map((t, i) => {
      const 재료 = `${리포트글} ${JSON.stringify(t)}`;
      const 금지 = 같은지역(t) ? 지역금지말 : [];
      // 통화 상대 자기 이름은 통화문에 나와도 된다 — 다른 후보 이름은 여전히 안 된다
      const 고름 = 고르기(String(초안.call?.[t.id] ?? ""), 재료, 말들.filter((m) => m !== t.name), 금지, 통화틀(t));
      if (고름.원문) 버림++;
      return [
        `── ${i + 1}. ${t.name} (${t.district}${t.neighborhood ? ` ${t.neighborhood}` : ""}) · 연락일 ${t.next_due} · ${t.status}`,
        `다음 할 일: ${t.next_action}`,
        ...(같은지역(t) ? ["(케이스 리포트 링크는 뺐습니다 — 같은 지역 학원이라 링크와 「운영자가 직접 운영하는 학원」이 합쳐지면 우리 학원이 특정됩니다)"] : []),
        ...(고름.주의 ? [고름.주의] : []),
        고름.글,
      ].join("\n");
    });
    const 나머지 = 밀린.slice(3);
    await 사람대기({ key: 키, priority: 20, link: `${ADMIN}/admin/outreach`,
      title: `이번 주 영업 전화 — 연락일 지난 후보 ${밀린.length}곳 (통화문 ${targets.length}곳)`,
      detail: [
        "통화문 초안입니다. 전화는 원장님이 합니다. 통화 뒤 /admin/outreach 에 결과와 다음 연락일을 적으면 다음 주 묶음에서 빠집니다.",
        "", ...블록,
        ...(나머지.length ? ["", `── 그 밖에 연락일이 지난 후보 ${나머지.length}곳 (이번 주 통화문 없음): ${나머지.map((t) => `${t.name}(${t.next_due})`).join(", ")}`] : []),
      ].join("\n"),
      payload: { target_ids: 밀린.map((t) => t.id), 통화문: targets.map((t) => t.id), 버린초안: 버림 } });
  }
  // 낱개 통화 일감(첫 판)과 지난주 묶음은 이번 주 묶음으로 옮긴다
  const 옮김 = await q(`update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(),
      evidence = left(evidence || E'\n' || $3, 4000)
    where client_id=$1 and agent='sales' and status='사람 대기' and (dedupe_key like 'call-%' or (dedupe_key like 'sales-calls-%' and dedupe_key <> $2))
    returning id`, [HOUSE, 키, `${KST()} 주간 묶음 일감(${키})으로 옮김`]);

  for (const l of leads) {
    const 고름 = 고르기(String(초안.reply?.[l.id] ?? ""), `${리포트글} ${JSON.stringify(l)}`, 말들, [], 답장틀(l));
    if (고름.원문) 버림++;
    await 사람대기({ key: `lead-reply-${l.id}`, priority: 10, link: `${ADMIN}/admin`,
      title: `리드 답장: ${l.company || l.name || "이름 없음"} — ${l.created} 에 남김`,
      detail: `${고름.주의 ? `${고름.주의}\n` : ""}답장 초안 (보내는 건 원장님이 합니다):\n${고름.글}`,
      payload: { lead_id: l.id, ...(고름.원문 ? { 버린초안: 고름.원문.slice(0, 2000) } : {}) } });
  }

  // 한 주 한 줄 — 전부 DB 에서 센 값
  const [s] = await q(`select
      (select count(*)::int from geo.outreach_targets where contacted_at > now() - interval '7 days') 연락,
      (select count(*)::int from geo.outreach_targets where next_due between (now() at time zone 'Asia/Seoul')::date + 1 and (now() at time zone 'Asia/Seoul')::date + 7 and status not in ('결제','제외')) 약속,
      (select count(*)::int from geo.leads where coalesce(status,'new')='new') 리드`);
  const 한주 = `연락한 곳 ${s.연락} · 다음 약속 ${s.약속} · 리드 ${s.리드} · 연락일 지난 후보 ${밀린.length}(통화문 ${targets.length})`
    + ` · 완료 표시했지만 연락일이 그대로인 후보 ${그대로} · 답장 초안 ${leads.length}${버림 ? ` · 버린 초안 ${버림}` : ""}`
    + `${옮김.length ? ` · 낱개·지난 일감 ${옮김.length}개를 묶음으로 옮김` : ""} · 리포트 ${리포트.결과}`;
  await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,'sales','영업 주간',true,$2)`, [HOUSE, 한주]);
  console.log(`  ${밀린.length || leads.length ? "" : "할 일 없음 — "}${한주}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 영업 주간 ${KST()} KST\n- ${한주}\n- 초안: ${이유}\n\n`);
};

try {
  if (MODE === "--leak-test") await 새는지시험();
  else if (MODE === "--draft-test") await 초안시험();
  else if (MODE === "--push") await 올리기();
  else await 실행();
} catch (e) {
  console.error("영업 실패", e.message);
  if (pool) await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,'sales','영업 주간',false,$2)`, [HOUSE, 한줄(e.message, 500)]).catch(() => {});
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
