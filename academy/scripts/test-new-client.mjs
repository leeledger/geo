/**
 * 끝에서 끝 — geo.clients 행 하나(+config)만 있는 고객이 clients.mjs 수정 없이 도는가 (Step 37).
 *
 *   node scripts/test-new-client.mjs --live     운영 DB 에 시험 고객(status 'test')을 넣고 돌린 뒤 지운다
 *
 * 돈·한도를 안 쓴다 — check-index·daily-agent·marketing-draft 는 --dry, marketing-draft 는 Claude 를 부르기 직전에 멈추고,
 * indexnow 는 키가 없거나 키 파일이 안 열려 안 보낸다. measure_active false·승인 질문은 파일럿 리허설이라 ai-measure 대상이 아니다.
 * 넣은 행은 finally 에서 자식부터 지우고 남은 행 0 을 확인한다. 시험 고객은 status 'test' 라 매시 루프(company·daily-agent 전부)가 안 읽는다
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadClients } from "../clients.mjs";
import { 고객사말 } from "../masks.mjs";
import { 고객설정준비, 측정대상 } from "../measure-targets.mjs";
import { 탐침저장, 점검저장 } from "../../web/lib/client-core.mjs";

if (!process.argv.includes("--live")) {
  console.log("사용: node scripts/test-new-client.mjs --live   (운영 DB 에 시험 고객을 넣었다 지운다)");
  process.exit(1);
}
for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" }, max: 2 });
const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
const ACADEMY = fileURLToPath(new URL("..", import.meta.url));
const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const SLUG = "e2e-test";

let 통과 = 0, 실패 = 0;
const 봄 = (이름, 참, 보탬 = "") => { if (참) { 통과++; console.log(`  ✓ ${이름}`); } else { 실패++; console.log(`  ✗ ${이름}${보탬 ? ` — ${보탬}` : ""}`); } };
const 돌림 = (args) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, args, { cwd: ACADEMY, encoding: "utf8", timeout: 10 * 60000, env: { ...process.env, CLIENT_ID: "" } }) };
  } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
};
const 찍기 = (제목, out) => console.log(`\n── ${제목}\n${out.trim().split("\n").map((l) => `   | ${l}`).join("\n")}\n`);

/** 시험 고객 id 에 붙은 행 — client_id 칸이 있는 표 전부 + pilot_id 칸이 있는 표 */
const 붙은표 = async () => q(`select c.table_schema || '.' || c.table_name as t, c.column_name as col
    from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema in ('geo', 'academy') and t.table_type = 'BASE TABLE' and c.column_name in ('client_id', 'pilot_id')`);
const 지우기 = async (id) => {
  const 표 = await 붙은표();
  const 파일럿 = (await q(`select id from geo.pilots where client_id = $1`, [id])).map((r) => r.id);
  // 자식부터 — FK 순서를 몰라도 되게 몇 바퀴 돈다
  for (let 바퀴 = 0; 바퀴 < 4; 바퀴++) {
    for (const { t, col } of 표) {
      if (col === "pilot_id" && 파일럿.length) await q(`delete from ${t} where pilot_id = any($1::uuid[])`, [파일럿]).catch(() => {});
      if (col === "client_id") await q(`delete from ${t} where client_id = $1`, [id]).catch(() => {});
    }
  }
  await q(`delete from geo.clients where id = $1`, [id]);
  let 남음 = 0;
  for (const { t, col } of 표) {
    const [r] = col === "pilot_id"
      ? (파일럿.length ? await q(`select count(*)::int n from ${t} where pilot_id = any($1::uuid[])`, [파일럿]) : [{ n: 0 }])
      : await q(`select count(*)::int n from ${t} where client_id = $1`, [id]);
    if (r.n) console.log(`   남음 ${t} ${r.n}`);
    남음 += r.n;
  }
  const [c] = await q(`select count(*)::int n from geo.clients where slug = $1 or id = $2`, [SLUG, id]);
  return 남음 + c.n;
};

let id = null;
try {
  await 고객설정준비(q);
  // 지난 실행이 중간에 죽었으면 남은 것부터 지운다
  for (const r of await q(`select id from geo.clients where slug = $1`, [SLUG])) await 지우기(r.id);

  const config = {
    v: 1,
    queries: { compete: ["pdf 합치기 무료"] },
    indexnow: { mode: "우리" },
    marketing: { enabled: true, pages: [{ all: [["pdf"], ["합치", "병합"]], guide: "/guide/pdf-merge/", tool: "/pdf-merge/" }], disclosure: "시험" },
  };
  [{ id }] = await q(`insert into geo.clients (slug, name, domain, status, measure_active, config)
                      values ($1, '시험고객', 'docttak.com', 'test', false, $2::jsonb) returning id`, [SLUG, JSON.stringify(config)]);
  console.log(`시험 고객 id ${id} (${SLUG}, status test)`);
  /**
   * daily-agent 는 승인 질문이 있어야 하루를 돈다 — 리허설 파일럿 하나에 검색어 1·이름 질문 1.
   * 이름 질문 답 한 줄(인용 없음)을 넣어 hitWords 없는 고객의 적중(인용만) 분기를 실제로 지나게 한다
   */
  // 값 0·취소한 날 오늘 — 측정 대상(진행 중 파일럿)이 안 된다. 지금 배포된 ai-measure 가 이 사이에 돌아도 안 잰다
  const [p] = await q(`insert into geo.pilots (client_id, started_on, ends_on, status, price, cancelled_on)
                       values ($1, $2::date, $2::date + 30, '리허설', 0, $2::date) returning id`, [id, 오늘]);
  await q(`insert into geo.pilot_questions (pilot_id, position, stage, text, approved) values ($1, 1, 'keyword', 'pdf 합치기 무료', true), ($1, 2, 'brand', '시험고객 어떤 사이트야?', true)`, [p.id]);
  await q(`insert into academy.ai_measurements (client_id, measured_on, collection_method, engine, prompt_id, stage, prompt_text, mentioned, cited, raw)
           values ($1, $2::date, 'claude-code-headless-e2e', 'claude-code', 'q2', 'brand', '시험고객 어떤 사이트야?', true, false, '{"answer":"시험고객은 PDF 도구 사이트입니다"}'::jsonb)`, [id, 오늘]);

  // 0. 목록 — 콕 집지 않으면 안 보이고, includeTest 면 보인다. clients.mjs 는 안 고쳤다
  const 보통 = await loadClients(q);
  const 시험포함 = await loadClients(q, { includeTest: true });
  봄("보통 목록엔 시험 고객 없음", !보통.some((c) => c.slug === SLUG));
  const 시험 = 시험포함.find((c) => c.slug === SLUG);
  봄("includeTest 목록에 고객설정으로", 시험?.id === id && 시험?.출처?.queries === "입력");

  // 1. 노출 측정
  const ci = 돌림(["scripts/check-index.mjs", "--dry", "--client", SLUG]);
  찍기("check-index --dry --client e2e-test", ci.out);
  봄("check-index 끝까지", ci.code === 0, `code ${ci.code}`);
  봄("site:docttak.com 잼", /색인\s+site:docttak\.com/.test(ci.out));
  봄("브랜드 「시험고객」 잼", /브랜드\s+시험고객/.test(ci.out));
  봄("경쟁 1개 잼", /경쟁\s+pdf 합치기 무료/.test(ci.out) && /경쟁 검색어\s+\d+\/1/.test(ci.out));

  // 2. 색인 알림 — 키 없음 → 안 보냄. 키를 넣어도 파일이 없으면 안 보냄
  const in1 = 돌림(["scripts/indexnow.mjs", "--client", SLUG]);
  찍기("indexnow --client e2e-test (키 없음)", in1.out);
  봄("키 없음 — 안 보냄", in1.out.includes(`${SLUG}: 키 없음 — 안 보냄`) && !/접수됨|HTTP \d/.test(in1.out));
  const 키 = crypto.randomBytes(16).toString("hex");
  await q(`update geo.clients set config = jsonb_set(config, '{indexnow}', $2::jsonb) where id = $1`, [id, JSON.stringify({ mode: "우리", key: 키 })]);
  const in2 = 돌림(["scripts/indexnow.mjs", "--client", SLUG]);
  찍기("indexnow --client e2e-test (키 있음·파일 없음)", in2.out);
  봄("키 파일 확인 안 됨 — 안 보냄", new RegExp(`${SLUG}: 키 파일 확인 안 됨\\(\\d+\\) — 안 보냄`).test(in2.out) && !/접수됨|HTTP \d/.test(in2.out));

  // 3. 개선 루프 하루 — 기본 loop
  const da = 돌림(["scripts/daily-agent.mjs", "--dry", "--client", SLUG]);
  찍기("daily-agent --dry --client e2e-test", da.out);
  봄("daily-agent 끝까지", da.code === 0 && !da.out.includes("실패:") && !da.out.includes("loop 없음"), `code ${da.code}`);
  봄("시험고객 하루 · 이름 질문 인용 없음 → 적중 0", da.out.includes(`시험고객 · ${오늘}`) && /적중 0\/1/.test(da.out));

  // 4. 바깥 글 — 사람이 확인한 사실이 없으면 안 쓴다. 있으면 검색어·페이지·근거까지 고르고 Claude 는 안 부른다(--no-claude)
  const mk0 = 돌림(["scripts/marketing-draft.mjs", "--dry", "--client", SLUG]);
  찍기("marketing-draft --dry --client e2e-test (사실 0)", mk0.out);
  봄("사실 0 → 건너뜀 · 종료코드 0", mk0.code === 0 && mk0.out.includes("사람이 확인한 사실 목록이 비었습니다 — 건너뜀") && !mk0.out.includes("Claude 호출"));
  await q(`update geo.clients set config = jsonb_set(config, '{marketing,facts}', $2::jsonb) where id = $1`, [id, JSON.stringify([{ text: "시험 사실 하나" }])]);
  const mk = 돌림(["scripts/marketing-draft.mjs", "--dry", "--no-claude", "--client", SLUG]);
  찍기("marketing-draft --dry --no-claude --client e2e-test", mk.out);
  봄("검색어·페이지·근거", /「pdf 합치기 무료」 · 근거 \/guide\/pdf-merge\/ · \/pdf-merge\/ · 근거 \d+자/.test(mk.out));
  봄("Claude 안 부름", mk.out.includes("Claude 안 부름(--no-claude)") && mk.out.includes("Claude 호출 0회"));

  // 5. 가림 — 고객사말에 시험고객
  const 말 = 고객사말(시험포함);
  봄("고객사말에 「시험고객」·docttak.com", 말.includes("시험고객") && 말.includes("docttak.com"));

  // 6. AI 측정 대상 아님 — 돈·한도 안 씀
  const 대상 = await 측정대상(q, 오늘);
  봄("ai-measure 대상에 없음", !대상.some((t) => t.slug === SLUG), 대상.map((t) => t.slug).join(","));

  // 7. 서치콘솔 권한 탐침 저장(Step 39c) — 실제 DB 의 jsonb 길. 모름은 config 안 바꿈, 있음만 gsc 켬, gsc true 면 안 건드림. 매시 점검이 안 지움
  const 행 = async () => (await q(`select config, derived from geo.clients where id = $1`, [id]))[0];
  const 결과 = { url: "https://search.google.com/search-console?resource_id=sc-domain%3Adocttak.com", sample: "개요" };
  await 탐침저장(q, id, { ...결과, state: "모름" }, `${오늘} 19:20`);
  let r = await 행();
  봄("탐침 모름 → derived.gscAccess · config.gsc 그대로", r.derived?.gscAccess?.state === "모름" && r.derived.gscAccess.at === `${오늘} 19:20` && r.config.gsc === undefined);
  await 점검저장(q, { id, domain: "docttak.com", config: r.config }, { fetch: async () => new Response("없음", { status: 404, headers: { "content-type": "text/html" } }), lookup: async () => [{ address: "93.184.216.34" }] });
  r = await 행();
  봄("매시 사이트 점검 뒤에도 gscAccess 남음", r.derived?.gscAccess?.state === "모름" && typeof r.derived.checkedAt === "string");
  await 탐침저장(q, id, { ...결과, state: "있음" }, `${오늘} 19:21`);
  r = await 행();
  봄("탐침 있음 → config.gsc true", r.config.gsc === true && r.derived.gscAccess.state === "있음");
  봄("gsc true 면 탐침저장이 안 건드림", (await 탐침저장(q, id, { ...결과, state: "없음" }, `${오늘} 19:22`)) === false && (await 행()).derived.gscAccess.state === "있음");
} catch (e) {
  실패++;
  console.log(`  ✗ 실행 오류 — ${e.message}`);
} finally {
  // 7. 자식 행부터 지우고 남은 행 0
  if (id !== null) {
    const 남음 = await 지우기(id).catch((e) => { console.log(`  ✗ 지우기 실패 — ${e.message}`); return -1; });
    봄(`시험 고객 행 남은 것 0 (id ${id})`, 남음 === 0, `남음 ${남음}`);
  }
  await pool.end().catch(() => {});
}
console.log(`\n${통과} 통과 · ${실패} 실패`);
if (실패) process.exitCode = 1;
