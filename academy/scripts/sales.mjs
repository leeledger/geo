/**
 * 영업 담당 — 고객 유치(목표 3)에 담당이 생긴다. 준비는 에이전트, 보내는 건 원장 (Step 11).
 *
 * 9/22 까지 목표 3 에는 담당 에이전트가 없었다. 케이스 리포트는 손으로 갱신할 때만 새로워지고,
 * 영업판 후보 10곳은 다음 연락일(9/17)이 지난 채 서 있었다.
 *
 * 한 번 돌 때 (매주 월요일 08:10 KST)
 *   1. 케이스 리포트 공개본을 새로 뽑는다. 커밋 전에 가림 검사 — 고객사 이름·도메인·지역어·영업 후보 이름·전화번호가
 *      하나라도 있으면 공개본을 바꾸지 않고 사람 대기로 올린다. 숫자는 case-report.mjs 가 DB 에서 뽑은 것뿐이다
 *   2. 다음 연락일이 지난 영업 후보마다 통화문 초안 → 사람 대기
 *   3. 24시간 넘게 연락 안 한 리드마다 답장 초안 → 사람 대기
 *   4. 한 주 한 줄: 연락한 곳 N · 다음 약속 N · 리드 N (전부 DB 에서 센 값)
 *
 * 아무것도 자동으로 보내지 않는다. 전화·문자·메일은 원장.
 * 초안은 claude 한 번(주 1회)에 묶어 받는다. 재료는 케이스 리포트 공개본 문장과 그 후보·리드 행뿐이다.
 * 초안에 재료에 없는 숫자가 있거나 가릴 말이 있으면 버리고 숫자 없는 틀로 바꾼다 — 지어내지 않는다.
 *
 *   node scripts/sales.mjs              위 전부
 *   node scripts/sales.mjs --no-commit  공개본을 커밋하지 않는다 (로컬 시험)
 *   node scripts/sales.mjs --leak-test  가림 검사가 새는 공개본을 잡는지 본다 (claude·커밋 없음)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CLIENTS } from "../clients.mjs";
import { 클로드코드, 클로드코드있음, 클로드기록연결 } from "./claude-code.mjs";

const envFile = new URL("../.env.local", import.meta.url);
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const LEAK_TEST = process.argv.includes("--leak-test");
const NO_COMMIT = process.argv.includes("--no-commit");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ACADEMY = path.join(ROOT, "academy");
const 공개본 = path.join(ROOT, "web", "public", "case", "academy.html");
const HOUSE = 1;
const ADMIN = process.env.ADMIN_BASE_URL || "https://geo-rose-nine.vercel.app";

const pool = new Pool((() => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } };
})());
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
클로드기록연결(q);

const KST = (d = new Date()) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
const 오늘 = () => KST().slice(0, 10);
const 한줄 = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ─────────────────────────────────────────── 가림 검사
/**
 * 공개본에 있으면 안 되는 말. 조합되면 특정된다 — 이름만이 아니라 지역·전화까지 (CLAUDE.md 「고객사는 가린다」).
 * 지역어는 case-report.mjs 의 MASKS 가 가리는 말과 같다. 거기서 가림을 빼먹으면 여기서 멈춘다
 */
const 우리지역 = ["송파", "석촌", "잠실", "헬리오시티", "가락"];
const 전화 = /(?<!\d)(?:0\d{1,2}[-.\s)]\s*\d{3,4}[-.\s]\d{4}|01[016789]\d{7,8}|1[5-9]\d{2}-\d{4})(?!\d)/;
const 가릴말 = async () => {
  const 말 = new Set(우리지역);
  for (const c of CLIENTS) {
    말.add(c.name);
    말.add(c.domain);
    // 이름 변형 — 「로봇&코딩학원」은 HTML 에서 &amp; 로, 입말로는 「로봇앤코딩」으로 나온다
    if (c.name.includes("&")) {
      const 줄기 = c.name.replace(/학원$/, "");
      for (const x of [c.name, 줄기]) { 말.add(x.replace("&", "&amp;")); 말.add(x.replace("&", "앤")); 말.add(x); }
    }
    // 브랜드 표기(brandRe)와 주소·전화 끝자리(presenceRe — who-wins 가 「우리」를 알아보는 말). 정규식 원문에서 글자만 꺼낸다
    for (const p of [String(c.brandRe?.source ?? ""), String(c.presenceRe?.source ?? "")].join("|").split("|")) {
      const t = p.replace(/\\s\*/g, " ").replace(/-\?/g, "-").replace(/[\\^$()?*+[\]{}]/g, "").trim();
      if (t.length >= 4) 말.add(t);
    }
  }
  // 영업 후보 이름 — 공개본에 경쟁 학원 이름이 나오면 안 된다
  for (const r of await q(`select name from geo.outreach_targets`).catch(() => [])) if (r.name?.length >= 2) 말.add(r.name);
  return [...말].filter(Boolean);
};

/** 걸린 말 목록을 돌려준다. 비었으면 통과 */
const 가림검사 = (text, 말들) => {
  const 걸림 = 말들.filter((m) => text.toLowerCase().includes(m.toLowerCase()));
  const 번호 = text.match(new RegExp(전화.source, "g")) ?? [];
  return [...걸림, ...번호.map((x) => `전화번호 ${x}`)];
};

const 본문 = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// ─────────────────────────────────────────── 1. 케이스 리포트
const 리포트갱신 = async (말들) => {
  const tmp = path.join(os.tmpdir(), `case-${Date.now()}.html`);
  const r = spawnSync(process.execPath, ["scripts/case-report.mjs", "--out", tmp], { cwd: ACADEMY, encoding: "utf8", timeout: 5 * 60 * 1000 });
  if (r.status !== 0 || !fs.existsSync(tmp)) throw new Error(`case-report 실패 ${한줄(`${r.stdout}${r.stderr}`, 300)}`);
  const html = fs.readFileSync(tmp, "utf8");
  fs.rmSync(tmp, { force: true });
  const 걸림 = 가림검사(html, 말들);
  if (걸림.length) {
    // 가릴 말이 남은 공개본은 올리지 않는다. 어떤 말인지는 사람 줄에만 적는다(공개 경로로 안 나간다)
    await 사람대기({ key: "case-report-leak", title: "케이스 리포트 공개본에 가릴 말이 남아 갱신을 멈췄습니다",
      detail: `걸린 말: ${걸림.join(", ")}\ncase-report.mjs 의 MASKS 에 가림을 더한 뒤 다음 주 실행을 기다리거나 node scripts/sales.mjs 를 다시 돌립니다. 지금 공개본은 그대로입니다.`, priority: 5 });
    return { 결과: `멈춤 — 가릴 말 ${걸림.length}개`, html: null };
  }
  await q(`update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(evidence || E'\n' || $2, 4000)
    where client_id=$1 and dedupe_key='case-report-leak' and status='사람 대기'`, [HOUSE, `${KST()} 가림 검사 통과`]);
  const 옛것 = fs.existsSync(공개본) ? fs.readFileSync(공개본, "utf8") : "";
  // 「N일차에 갱신했습니다」 같은 날짜 줄만 다르면 바뀐 게 아니다
  const 같음 = 옛것.replace(/\d+일차에 갱신/g, "") === html.replace(/\d+일차에 갱신/g, "");
  if (같음) return { 결과: "바뀐 것 없음 — 커밋 안 함", html };
  fs.writeFileSync(공개본, html, "utf8");
  if (NO_COMMIT) return { 결과: "새로 뽑음 (--no-commit, 커밋 안 함)", html };
  const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
  git("add", "web/public/case/academy.html");
  git("-c", "user.name=sales-bot", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-q", "-m",
    `케이스 리포트 주간 갱신 (${오늘()}) — sales.mjs, 가림 검사 통과`);
  const p = spawnSync("git", ["push", "origin", "HEAD:main"], { cwd: ROOT, encoding: "utf8" });
  if (p.status !== 0) {
    spawnSync("git", ["pull", "--rebase", "-q", "origin", "main"], { cwd: ROOT, encoding: "utf8" });
    const p2 = spawnSync("git", ["push", "origin", "HEAD:main"], { cwd: ROOT, encoding: "utf8" });
    if (p2.status !== 0) throw new Error(`공개본 푸시 실패 ${한줄(p2.stderr, 200)}`);
  }
  return { 결과: `갱신·커밋 ${git("rev-parse", "--short", "HEAD")}`, html };
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
const 숫자들 = (s) => [...String(s).matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0].replace(/,/g, ""));
/** 재료에 없는 숫자가 있거나 가릴 말이 있으면 초안을 버린다 */
const 초안검사 = (초안, 재료, 말들) => {
  const 모르는숫자 = [...new Set(숫자들(초안).filter((n) => !재료.includes(n)))];
  const 걸림 = 가림검사(초안, 말들);
  return { ok: !모르는숫자.length && !걸림.length, 모르는숫자, 걸림 };
};

// 숫자 없는 틀 — claude 를 못 불렀거나 초안이 검사에 떨어졌을 때 쓴다
const 통화틀 = (t) => [
  `안녕하세요, ${t.name} 원장님 맞으시죠. 사이티드라는 곳입니다. 학부모가 AI 에게 학원을 물을 때 어떤 학원 이름이 나오는지 보는 일을 합니다.`,
  "영업 전화라서 먼저 말씀드립니다. 세 가지만 여쭙고 맞지 않으면 바로 끊겠습니다.",
  "상담은 원장님이 직접 하시나요. 상담 문의가 한 달에 다섯 건 넘게 오나요. 지점은 한 곳인가요.",
  "셋 다 아니면 저희 일이 도움이 안 됩니다. 셋 다 맞으시면 저희가 잰 기록을 링크로 보내 드려도 될까요. 보시고 아니다 싶으면 답 안 주셔도 됩니다.",
].join("\n");
const 답장틀 = (l) => [
  `${l.name ? `${l.name}님` : "안녕하세요"}, 사이티드입니다. 남겨 주신 연락처로 답장드립니다.`,
  l.wants ? `「${l.wants}」 쪽을 원하신다고 적어 주셨습니다.` : "어떤 도움이 필요하신지는 아직 모릅니다.",
  "지금 AI 답변에 어떤 이름이 나오는지 먼저 같이 보고, 저희 일이 맞는지는 그다음에 판단하셔도 됩니다. 맞지 않으면 그렇다고 말씀드리겠습니다.",
  "편하신 시간을 알려 주시면 그때 연락드리겠습니다.",
].join("\n");

const 초안받기 = async (targets, leads, 리포트글) => {
  if (!targets.length && !leads.length) return { 초안: {}, 이유: "초안 대상 없음" };
  const [{ n }] = await q(`select count(*)::int n from geo.claude_calls where purpose='sales' and at > now() - interval '6 days'`).catch(() => [{ n: 0 }]);
  if (n >= 1) return { 초안: {}, 이유: "이번 주 claude 1회를 이미 씀 — 숫자 없는 틀을 쓴다" };
  if (!클로드코드있음()) return { 초안: {}, 이유: "Claude Code 없음 — 숫자 없는 틀을 쓴다" };
  const prompt = [
    "사이티드(AI 답변에 학원 이름이 불리게 돕는 대행사)의 영업 초안을 쓴다. 보내는 건 사람이다. 너는 초안만 쓴다.",
    "",
    "규칙",
    "- 지어내지 않는다. 숫자는 아래 재료(리포트 공개본·그 행)에 있는 것만 쓴다. 재료에 없으면 「아직 모릅니다」라고 쓴다",
    "- 우리 실증 학원의 이름·지역·주소·전화를 쓰지 않는다. 리포트 공개본에 가려진 것([학원명]·[구]·[동] 등)을 풀지 않는다",
    "- 통화 상대는 다른 학원이다. 우리가 학원을 운영한다는 말도 하지 않는다",
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
    "재료 2 — 연락일이 지난 영업 후보:",
    JSON.stringify(targets.map((t) => ({ id: t.id, 이름: t.name, 지역: t.district, 다음할일: t.next_action, 메모: t.note,
      원장상담: t.owner_consults, 월문의5건이상: t.monthly_inquiries_5plus, 단일지점: t.single_location })), null, 1),
    "",
    "재료 3 — 24시간 넘게 답 안 한 리드:",
    JSON.stringify(leads.map((l) => ({ id: l.id, 이름: l.name, 회사: l.company, 원함: l.wants, 고민: l.concerns, 사이트: l.site,
      알게된곳: l.referral, 진단점수: l.total ?? null, 진단등급: l.grade ?? null })), null, 1),
  ].join("\n");
  // 도구 없이 빈 임시 폴더에서 부른다 — 저장소도 웹도 안 본다. 재료는 위에 다 있다
  const r = await 클로드코드(prompt, { purpose: "sales", capRequired: true, maxTurns: 3, timeoutMs: 8 * 60 * 1000,
    system: "너는 한국어로 짧고 정직한 영업 초안을 쓰는 도우미다. 규칙과 출력 형식은 사용자 메시지에 있다." });
  if (!r.ok) return { 초안: {}, 이유: `claude ${r.한도 ? "한도" : "실패"} — ${한줄(r.error, 120)} · 숫자 없는 틀을 쓴다` };
  const m = /\{[\s\S]*\}/.exec(String(r.text).replace(/^```(json)?|```$/gm, ""));
  try { return { 초안: JSON.parse(m?.[0] ?? ""), 이유: "claude 1회" }; }
  catch { return { 초안: {}, 이유: "claude 답이 JSON 이 아님 — 숫자 없는 틀을 쓴다" }; }
};

// ─────────────────────────────────────────── 시험
/** 새는 공개본을 일부러 만들어 가림 검사가 잡는지 본다. 가린 공개본은 통과해야 한다 */
const 새는지시험 = async () => {
  const 말들 = await 가릴말();
  const 경우 = [
    ["학원 이름", "<p>로봇&amp;코딩학원 착수 1일차</p>", true],
    ["입말 이름", "<p>로봇앤코딩 원장님 인터뷰</p>", true],
    ["도메인", "<a href=\"https://robotncoding.com/blog\">글</a>", true],
    ["지역어", "<p>서울 송파구 석촌동 코딩학원</p>", true],
    ["주소", "<p>송파대로37길 52</p>", true],
    ["전화번호", "<p>문의 02-422-0525</p>", true],
    ["휴대전화", "<p>010-1234-5678</p>", true],
    ["영업 후보 이름", `<p>${(await q(`select name from geo.outreach_targets order by name limit 1`))[0]?.name ?? "후보없음"} 과 비교</p>`, true],
    ["가린 공개본", "<p>[학원명] · [구] [동] 코딩학원 · 착수 17일차 · 크롤러 방문 1,234회</p>", false],
  ];
  let 틀림 = 0;
  console.log(`가림 검사 시험 · 가릴 말 ${말들.length}개`);
  for (const [이름, html, 새야] of 경우) {
    const 걸림 = 가림검사(html, 말들);
    const ok = 새야 ? 걸림.length > 0 : 걸림.length === 0;
    if (!ok) 틀림++;
    console.log(`  ${ok ? "✓" : "✗"} ${이름} — ${새야 ? "잡아야 함" : "통과해야 함"} · ${걸림.length ? `걸림 ${걸림.length}개` : "걸림 없음"}`);
  }
  // 지금 공개본도 검사한다
  const 지금 = fs.existsSync(공개본) ? 가림검사(fs.readFileSync(공개본, "utf8"), 말들) : ["공개본 없음"];
  console.log(`  ${지금.length ? "✗" : "✓"} 지금 web/public/case/academy.html — ${지금.length ? `걸림 ${지금.join(", ")}` : "걸림 없음"}`);
  if (틀림 || 지금.length) process.exitCode = 1;
};

// ─────────────────────────────────────────── 실행
const 실행 = async () => {
  console.log(`영업 담당 · ${KST()} KST`);
  const 말들 = await 가릴말();
  const 리포트 = await 리포트갱신(말들);
  console.log(`  케이스 리포트: ${리포트.결과}`);
  const 리포트글 = 리포트.html ? 본문(리포트.html) : fs.existsSync(공개본) ? 본문(fs.readFileSync(공개본, "utf8")) : "";

  const targets = await q(`select id::text, name, district, neighborhood, next_action, note, next_due::text, status,
      owner_consults, monthly_inquiries_5plus, single_location
    from geo.outreach_targets where next_due <= (now() at time zone 'Asia/Seoul')::date and status not in ('결제','제외')
    order by priority, next_due, name`);
  const leads = await q(`select l.id::text, l.name, l.company, l.wants, l.concerns, l.site, l.referral, s.total, s.grade,
      to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') created
    from geo.leads l left join geo.scans s on s.id = l.scan_id
    where coalesce(l.status,'new')='new' and l.created_at < now() - interval '24 hours' order by l.created_at`);
  console.log(`  연락일 지난 영업 후보 ${targets.length}곳 · 24시간 넘은 리드 ${leads.length}건`);

  const { 초안, 이유 } = await 초안받기(targets, leads, 리포트글);
  console.log(`  초안: ${이유}`);
  let 버림 = 0;
  for (const t of targets) {
    const 재료 = `${리포트글} ${JSON.stringify(t)}`;
    let 글 = String(초안.call?.[t.id] ?? "");
    const 검사 = 글 ? 초안검사(글, 재료, 말들) : null;
    const 주의 = 검사 && !검사.ok ? `(claude 초안을 버림 — ${[...검사.모르는숫자.map((x) => `재료에 없는 숫자 ${x}`), ...검사.걸림.map((x) => `가릴 말 ${x}`)].join(", ")})\n` : "";
    if (!글 || !검사.ok) { 글 = 통화틀(t); if (주의) 버림++; }
    await 사람대기({ key: `call-${t.id}-${t.next_due}`, priority: 20, link: `${ADMIN}/admin/outreach`,
      title: `영업 전화: ${t.name} (${t.district}) — 연락일 ${t.next_due} 지남`,
      detail: `${주의}다음 할 일: ${t.next_action}\n\n통화문 초안 (보내기·전화는 원장님이 합니다):\n${글}\n\n통화 뒤 /admin/outreach 에 결과와 다음 연락일을 적으면 이 일감은 다음 주에 다시 안 뜹니다.`,
      payload: { target_id: t.id } });
  }
  for (const l of leads) {
    const 재료 = `${리포트글} ${JSON.stringify(l)}`;
    let 글 = String(초안.reply?.[l.id] ?? "");
    const 검사 = 글 ? 초안검사(글, 재료, 말들) : null;
    const 주의 = 검사 && !검사.ok ? `(claude 초안을 버림 — ${[...검사.모르는숫자.map((x) => `재료에 없는 숫자 ${x}`), ...검사.걸림.map((x) => `가릴 말 ${x}`)].join(", ")})\n` : "";
    if (!글 || !검사.ok) { 글 = 답장틀(l); if (주의) 버림++; }
    await 사람대기({ key: `lead-reply-${l.id}`, priority: 10, link: `${ADMIN}/admin`,
      title: `리드 답장: ${l.company || l.name || "이름 없음"} — ${l.created} 에 남김`,
      detail: `${주의}답장 초안 (보내는 건 원장님이 합니다):\n${글}`, payload: { lead_id: l.id } });
  }

  // 한 주 한 줄 — 전부 DB 에서 센 값
  const [s] = await q(`select
      (select count(*)::int from geo.outreach_targets where contacted_at > now() - interval '7 days') 연락,
      (select count(*)::int from geo.outreach_targets where next_due between (now() at time zone 'Asia/Seoul')::date and (now() at time zone 'Asia/Seoul')::date + 7 and status not in ('결제','제외')) 약속,
      (select count(*)::int from geo.leads where coalesce(status,'new')='new') 리드`);
  const 한주 = `연락한 곳 ${s.연락} · 다음 약속 ${s.약속} · 리드 ${s.리드} · 통화 초안 ${targets.length} · 답장 초안 ${leads.length}${버림 ? ` · 버린 초안 ${버림}` : ""} · 리포트 ${리포트.결과}`;
  await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,'sales','영업 주간',true,$2)`, [HOUSE, 한주]);
  console.log(`  ${targets.length || leads.length ? "" : "할 일 없음 — "}${한주}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 영업 주간 ${KST()} KST\n- ${한주}\n- 초안: ${이유}\n\n`);
};

try {
  if (LEAK_TEST) await 새는지시험();
  else await 실행();
} catch (e) {
  console.error("영업 실패", e.message);
  await q(`insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1,'sales','영업 주간',false,$2)`, [HOUSE, 한줄(e.message, 500)]).catch(() => {});
  process.exitCode = 1;
} finally {
  await pool.end();
}
