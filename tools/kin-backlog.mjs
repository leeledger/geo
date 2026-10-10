/**
 * 밀린 바깥 글 초안 정리(Step 41, 한 번만) — AI 가 질문을 상상해 쓴 초안을 치운다.
 *   카페 초안          → 버림 「카페 멈춤(D69)」
 *   질문 없는 지식iN 초안 → 그 검색어로 kin-find --query. 7일 안 맞는 실제 질문이 있으면 그 질문에 다시 쓰고(marketing-draft --kin-question)
 *                         옛 초안은 버림 「실제 질문에 맞춰 다시 씀(#새 초안)」, 없으면 버림 「실제 질문 없음(D70)」
 *
 * 원장 PC 에서 돈다(고객 네이버 프로필). 로컬 에이전트와 겹치지 않게 그 잠금을 같이 쓴다. kin-find 의 하루 검색 상한(10회)을 같이 센다.
 *
 *   node tools/kin-backlog.mjs --client docttak            무엇을 할지 찍기만(kin-find --dry, DB 안 바꿈)
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
  for (const m of 밀림.filter((x) => x.channel === "jisikin")) {
    const r = 돌리기("kin-find.mjs", ["--client", SLUG, "--query", m.target_query, ...(APPLY ? [] : ["--dry"])], 10);
    if (/로그인이 필요|캡차|하루 상한/.test(r.out) || !r.ok) {
      console.log(`  #${m.id} 지식iN 「${m.target_query}」 — 질문을 못 찾아봄, 그대로 둠: ${r.out.trim().split("\n").pop()}`);
      continue;
    }
    const 찾음 = /^FOUND (\d+) (\S+)/m.exec(r.out);
    const 후보줄 = /^\s+후보 .+$/m.exec(r.out)?.[0].trim();
    if (!APPLY) { console.log(`  #${m.id} 지식iN 「${m.target_query}」 → ${후보줄 ? `실제 질문 있음(${후보줄}) — 다시 씀` : "실제 질문 없음 — 버림"}`); continue; }
    if (!찾음) {
      console.log(`  #${m.id} 지식iN 「${m.target_query}」 → 실제 질문 없음 — 버림`);
      await 버림(m.id, "실제 질문 없음(D70)");
      continue;
    }
    const 쓰기 = 돌리기(path.join(HERE, "../academy/scripts/marketing-draft.mjs"), ["--client", SLUG, "--kin-question", 찾음[1]], 12);
    const [새] = await q(`select id from geo.marketing_posts where kin_question_id = $1 and status = '초안' order by id desc limit 1`, [Number(찾음[1])]);
    console.log(`  #${m.id} 지식iN 「${m.target_query}」 → 질문 #${찾음[1]} ${찾음[2]} · ${새 ? `새 초안 #${새.id}` : `다시 쓰기 실패: ${쓰기.out.trim().split("\n").pop()}`} — 옛 초안 버림`);
    await 버림(m.id, 새 ? `실제 질문에 맞춰 다시 씀(#${새.id})` : `실제 질문 #${찾음[1]} 에 다시 쓰다 탈락`);
  }
} finally {
  fs.rmSync(LOCK, { force: true });
}
