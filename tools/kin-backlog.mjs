/**
 * 밀린 바깥 글 초안 정리(Step 41, 한 번만) — AI 가 질문을 상상해 쓴 초안을 치운다.
 *   카페 초안          → 버림 「카페 멈춤(D69)」
 *   질문 없는 지식iN 초안 → 그 검색어로 kin-find --query. 7일 안 맞는 실제 질문이 있으면 그 질문에 다시 쓰고(marketing-draft --kin-question)
 *                         옛 초안은 버림 「실제 질문에 맞춰 다시 씀(#새 초안)」, 없으면 버림 「실제 질문 없음(D70)」
 *
 * 원장 PC 에서 돈다(고객 네이버 프로필). 로컬 에이전트와 겹치지 않게 그 잠금을 같이 쓴다. kin-find 의 하루 검색 상한(10회)을 같이 센다.
 * 이미 저장된 7일 안 후보 질문을 먼저 쓴다. 초안은 그날 실제 질문 답 1건 안에서만(나머지는 후보로 남아 kin-agent 가 하루 1건씩).
 * 캡차·로그인·상한을 만나면 멈춘다 — 남은 초안은 그대로 둔다.
 *
 *   node tools/kin-backlog.mjs --client docttak            무엇을 할지 찍기만(검색 안 씀 · 저장된 질문만 · DB 안 바꿈)
 *   node tools/kin-backlog.mjs --client docttak --apply    실제로 정리
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(HERE, ".local-agent.lock");
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const SLUG = arg("--client");
const APPLY = process.argv.includes("--apply");
if (!SLUG) { console.log("사용법: node tools/kin-backlog.mjs --client <slug> [--apply]"); process.exit(1); }

for (const l of fs.readFileSync(path.join(HERE, "../academy/.env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete("sslmode");
const q = async (s, p = []) => {
  const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  await c.connect();
  try { return (await c.query(s, p)).rows; } finally { await c.end().catch(() => {}); }
};
const 돌리기 = (file, args, timeoutMin) => {
  try { return { ok: true, out: execFileSync(process.execPath, [file, ...args], { cwd: HERE, encoding: "utf8", timeout: timeoutMin * 60000, maxBuffer: 20 * 1024 * 1024 }) }; }
  catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}\n${e.message}` }; }
};
const 버림 = (id, why) => (APPLY ? q(`update geo.marketing_posts set status = '버림', note = left($2 || ' · ' || note, 1000) where id = $1 and status = '초안'`, [id, why]) : null);

// 로컬 에이전트와 같은 프로필을 쓴다 — 그 잠금을 잡는다
try { fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" }); }
catch { console.log("로컬 에이전트가 돌고 있습니다 — 끝난 뒤 다시"); process.exit(3); }

try {
  const [c] = await q(`select id, name from geo.clients where slug = $1`, [SLUG]);
  if (!c) throw new Error(`고객사 없음: ${SLUG}`);
  // 질문 칸이 없는 옛 표에서도 돈다 — --apply 의 kin-find 가 표를 만든다
  const 칸있음 = (await q(`select 1 from information_schema.columns where table_schema = 'geo' and table_name = 'marketing_posts' and column_name = 'kin_question_id'`)).length > 0;
  const 밀림 = await q(`select id, channel, target_query from geo.marketing_posts where client_id = $1 and status = '초안'
      and channel in ('cafe', 'jisikin') ${칸있음 ? "and kin_question_id is null" : ""} order by id`, [c.id]);
  console.log(`${c.name} 밀린 초안 ${밀림.length}건${APPLY ? "" : " — 찍기만(--apply 로 실제 정리)"}`);
  for (const m of 밀림.filter((x) => x.channel === "cafe")) {
    console.log(`  #${m.id} 카페 「${m.target_query}」 → 버림 「카페 멈춤(D69)」`);
    await 버림(m.id, "카페 멈춤(D69)");
  }
  // 이미 저장된 7일 안 후보 질문 — kin-find 는 본 주소를 건너뛰어 FOUND 를 안 찍으니 먼저 DB 에서 찾는다
  const 표있음 = 칸있음 && (await q(`select to_regclass('geo.kin_questions') t`))[0]?.t != null;
  const 저장된 = async (query) => (표있음 ? (await q(`select id, url from geo.kin_questions where client_id = $1 and query = $2 and status = '후보'
      and asked_at >= (now() at time zone 'Asia/Seoul')::date - 6 order by asked_at desc, id limit 1`, [c.id, query]))[0] ?? null : null);
  // 하루 1건(세션 결정) — 밀린 정리도 그날 실제 질문 답 1건 안에서만 쓴다. 나머지 질문은 후보로 남아 kin-agent 가 하루 1건씩 쓴다
  let 오늘씀 = 표있음 && (await q(`select 1 from geo.marketing_posts where client_id = $1 and channel = 'jisikin' and kin_question_id is not null
      and created_on = (now() at time zone 'Asia/Seoul')::date limit 1`, [c.id])).length > 0;
  for (const m of 밀림.filter((x) => x.channel === "jisikin")) {
    let 질문 = await 저장된(m.target_query);
    // 찍기만일 때는 검색을 쓰지 않는다(그날 kin-agent 몫을 먹지 않게) — 저장된 것만 본다
    if (!APPLY) {
      console.log(`  #${m.id} 지식iN 「${m.target_query}」 → ${질문 ? `저장된 실제 질문 #${질문.id} 있음 — 다시 씀(하루 1건)` : "저장된 실제 질문 없음 — --apply 때 그 검색어로 한 번 찾아보고, 없으면 버림"}`);
      continue;
    }
    if (!질문) {
      const r = 돌리기("kin-find.mjs", ["--client", SLUG, "--query", m.target_query], 10);
      // 캡차·로그인·상한이면 멈춘다 — 막힌 화면을 초안마다 다시 두드리지 않는다. 남은 초안은 그대로 둔다
      if (/로그인이 필요|캡차|하루 상한/.test(r.out) || !r.ok) {
        console.log(`  #${m.id} 지식iN 「${m.target_query}」 — 더 찾지 않고 멈춤(남은 초안 그대로): ${r.out.trim().split("\n").pop()}`);
        break;
      }
      const f = /^FOUND (\d+) (\S+)/m.exec(r.out);
      질문 = f ? { id: f[1], url: f[2] } : null;
    }
    if (!질문) {
      console.log(`  #${m.id} 지식iN 「${m.target_query}」 → 실제 질문 없음 — 버림`);
      await 버림(m.id, "실제 질문 없음(D70)");
      continue;
    }
    if (오늘씀) {
      console.log(`  #${m.id} 지식iN 「${m.target_query}」 → 질문 #${질문.id} 후보로 둠(오늘 1건 씀 — kin-agent 가 다음 날부터) — 옛 초안 버림`);
      await 버림(m.id, `실제 질문 #${질문.id} 로 넘김 — 답은 하루 1건씩`);
      continue;
    }
    const 쓰기 = 돌리기(path.join(HERE, "../academy/scripts/marketing-draft.mjs"), ["--client", SLUG, "--kin-question", String(질문.id)], 12);
    오늘씀 = true;   // 탈락(버림 행)도 그날 1건으로 센다 — kin-core 답차례와 같은 셈
    const [새] = await q(`select id from geo.marketing_posts where kin_question_id = $1 and status = '초안' order by id desc limit 1`, [Number(질문.id)]);
    console.log(`  #${m.id} 지식iN 「${m.target_query}」 → 질문 #${질문.id} ${질문.url} · ${새 ? `새 초안 #${새.id}` : `다시 쓰기 실패: ${쓰기.out.trim().split("\n").pop()}`} — 옛 초안 버림`);
    await 버림(m.id, 새 ? `실제 질문에 맞춰 다시 씀(#${새.id})` : `실제 질문 #${질문.id} 에 다시 쓰다 탈락`);
  }
} finally {
  fs.rmSync(LOCK, { force: true });
}
