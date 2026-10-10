/**
 * Step 40 한 번 정리 — 일감이 거짓말하던 것을 지금 사실에 맞춘다. 한 번 돌리고 끝나는 스크립트다.
 *
 *   node scripts/step40-cleanup.mjs           바꿀 것만 찍는다(기본)
 *   node scripts/step40-cleanup.mjs --apply   찍은 것을 한 트랜잭션으로 쓴다
 *
 * 하는 일(모든 변경에 evidence 한 줄 — status 를 되돌리면 복구된다)
 *   1. 고객마다 열린 「세션 대기」 question-draft 중 가장 오래된 1개만 남기고, 나머지 질문을 그 payload.questions 로 묶는다(D60).
 *      나머지는 닫힘 「#<남긴id> 에 묶음」. 상한(15)을 넘는 것은 그대로 둔다
 *   2. 로컬 대기 naver-transfer 중 그 글에 logNo 가 있는 것 → 완료(local-agent 와 같은 SQL)
 *   3. R3(근거 없는 완료) 조사 중 대상이 naver-attempt 이고 그 글에 logNo 가 있는 것 → attempt evidence 에 logNo, 조사 닫힘
 *   4. bytedance R5 조사가 열려 있으면 닫힘 「감시 제외(D59)」
 *   5. #1385(R1 문서딱 brand-defense 반복 실패) 닫힘 — 건너뜀을 실패로 세던 것
 */
import fs from "node:fs";
import { Pool } from "pg";
import { 글자만, 묶음상한 } from "./session-task.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const APPLY = process.argv.includes("--apply");
const 오늘 = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const 근거 = (s) => `${오늘} Step 40 정리 — ${s}`;

const 할것 = []; // { 말, sql, p }
const 넣기 = (말, sql, p) => 할것.push({ 말, sql, p });
const 닫기 = (id, 사유) => 넣기(`#${id} 닫힘 — ${사유}`,
  `update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = left(coalesce(evidence, '') || E'\\n' || $2, 4000)
    where id=$1 and status not in ('완료', '닫힘')`, [id, 근거(사유)]);

const client = await pool.connect();
const q = (s, p = []) => client.query(s, p).then((r) => r.rows);
try {
  // ── 1. 세션 글 일감 고객당 1개
  const 열린 = await q(`select t.id::int id, t.client_id::int client_id, c.name, t.payload, to_char(t.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') made
                         from geo.agent_tasks t left join geo.clients c on c.id = t.client_id
                        where t.kind='question-draft' and t.status='세션 대기' order by t.client_id, t.created_at, t.id`);
  const 고객별 = new Map();
  for (const t of 열린) (고객별.get(t.client_id) ?? 고객별.set(t.client_id, []).get(t.client_id)).push(t);
  for (const [, 목록] of 고객별) {
    if (목록.length < 2) continue;
    const [남김, ...나머지] = 목록;
    const 질문들 = Array.isArray(남김.payload?.questions) && 남김.payload.questions.length ? [...남김.payload.questions] : [남김.payload?.question].filter(Boolean);
    const 묶은 = [], 남은 = [];
    for (const t of 나머지) {
      const 그질문들 = [t.payload?.question, ...(Array.isArray(t.payload?.questions) ? t.payload.questions : [])].filter(Boolean);
      const 새것 = 그질문들.filter((x, i) => !질문들.some((y) => 글자만(y) === 글자만(x)) && 그질문들.findIndex((y) => 글자만(y) === 글자만(x)) === i);
      if (질문들.length + 새것.length > 묶음상한) { 남은.push(t); continue; }
      질문들.push(...새것);
      묶은.push(t);
    }
    console.log(`\n[세션 글] ${남김.name ?? `client ${남김.client_id}`} 세션 대기 ${목록.length} → ${1 + 남은.length} · 남김 #${남김.id}(${남김.made}) · 묶인 질문 ${질문들.length}개`);
    질문들.forEach((x, i) => console.log(`   ${String(i + 1).padStart(2)}. ${x}`));
    if (남은.length) console.log(`   ⚠ 상한 ${묶음상한} 을 넘어 그대로 둠: #${남은.map((t) => t.id).join(", #")}`);
    넣기(`#${남김.id} payload.questions ← ${질문들.length}개`,
      `update geo.agent_tasks set payload = payload || jsonb_build_object('questions', $2::jsonb), updated_at=now(),
              evidence = left(coalesce(evidence, '') || E'\\n' || $3, 4000) where id=$1 and status='세션 대기'`,
      [남김.id, JSON.stringify(질문들), 근거(`#${묶은.map((t) => t.id).join(", #")} 의 질문을 이 일감에 묶음`)]);
    for (const t of 묶은) 닫기(t.id, `#${남김.id} 에 묶음`);
  }

  // ── 2. 이미 네이버에 있는 글의 이관 일감
  const 이관 = await q(`select t.id::int id, p.slug, p.naver_log_no::text log from geo.agent_tasks t
                         join academy.posts p on p.slug = t.payload->>'slug' and p.client_id = t.client_id
                        where t.kind='naver-transfer' and t.status='로컬 대기' and p.naver_log_no is not null order by t.id`);
  if (이관.length) console.log("\n[네이버 이관] 로컬 대기인데 이미 네이버에 있는 글");
  for (const t of 이관) {
    console.log(`   #${t.id} ${t.slug} logNo=${t.log}`);
    넣기(`#${t.id} 완료 — 이미 네이버에 있음 logNo=${t.log}`,
      `update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = left(coalesce(evidence, '') || E'\\n' || $2, 4000)
        where id=$1 and status='로컬 대기'`, [t.id, 근거(`이미 네이버에 있음 logNo=${t.log}`)]);
  }

  // ── 3. R3 근거 없는 완료 — 대상이 네이버 이관 시도이고 글에 logNo 가 있음
  const r3 = await q(`select i.id::int id, a.id::int aid, p.naver_log_no::text log, p.slug from geo.agent_tasks i
                       join geo.agent_tasks a on 'inv-R3-task-' || a.id = i.dedupe_key and a.kind='naver-attempt'
                       join academy.posts p on p.slug = a.payload->>'slug' and p.client_id = a.client_id
                      where i.kind='investigate' and i.dedupe_key like 'inv-R3-task-%' and i.status not in ('완료','닫힘')
                        and p.naver_log_no is not null order by i.id`);
  if (r3.length) console.log("\n[감사 R3] 네이버 이관 시도의 근거 없는 완료 — 글에 logNo 가 있음");
  for (const t of r3) {
    console.log(`   조사 #${t.id} → 시도 #${t.aid} ${t.slug} logNo=${t.log}`);
    넣기(`#${t.aid} evidence ← logNo=${t.log}`,
      `update geo.agent_tasks set updated_at=now(), evidence = left(coalesce(evidence, '') || E'\\n' || $2, 4000) where id=$1`,
      [t.aid, 근거(`logNo=${t.log}`)]);
    닫기(t.id, `시도 #${t.aid} 에 근거(logNo=${t.log})를 채움`);
  }

  // ── 4. bytedance R5
  const 바이트 = await q(`select id::int id, status from geo.agent_tasks where kind='investigate' and dedupe_key='inv-R5-bytedance' and status not in ('완료','닫힘')`);
  if (바이트.length) console.log(`\n[감사 R5] bytedance 조사 열림: #${바이트.map((t) => `${t.id}(${t.status})`).join(", #")}`);
  for (const t of 바이트) 닫기(t.id, "감시 제외(D59)");

  // ── 5. #1385 brand-defense 건너뜀을 실패로 셈
  const [r1] = await q(`select id::int id, status, title from geo.agent_tasks where id=1385`);
  if (r1 && !["완료", "닫힘"].includes(r1.status)) {
    console.log(`\n[감사 R1] #1385(${r1.status}) ${r1.title}`);
    닫기(1385, "건너뜀을 실패로 세던 것 — Step 40 4번에서 고침");
  }

  console.log(`\n── 바꿀 것 ${할것.length}건`);
  for (const x of 할것) console.log(`   ${x.말}`);
  if (!APPLY) {
    console.log("\n찍기만 했습니다. 쓰려면 --apply");
  } else {
    await client.query("begin");
    let n = 0;
    for (const x of 할것) n += (await client.query(x.sql, x.p)).rowCount;
    await client.query("commit");
    console.log(`\n썼습니다 — ${n}행`);
  }
} catch (e) {
  if (APPLY) await client.query("rollback").catch(() => {});
  console.error(`정리 실패 — 아무것도 안 썼습니다: ${e.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
