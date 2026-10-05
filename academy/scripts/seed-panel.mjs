/**
 * 자사 고객 질문 패널 초안 20개 + 0원 리허설 파일럿을 넣는다 (Step 30 D34 → Step 32 D44 일반형).
 * 질문·파일럿 값은 고객마다 따로 둔 파일(seed-<slug>-panel.mjs)에 있다. 이 파일은 넣는 일만 한다.
 *
 *   node scripts/seed-panel.mjs --client ilog             (기본·--dry) 넣을 것을 찍기만 한다. DB 안 씀
 *   node scripts/seed-panel.mjs --client docttak --apply  넣는다 — Arch 가 돌린다
 *
 * 고객사 칸(geo.clients)이 없고 패널 파일에 새고객이 있으면 clients.mjs 의 id·이름·도메인으로 새로 넣는다.
 * clients.mjs 의 id 와 DB id 가 다르면 멈춘다 — 회사 루프(company.mjs)가 id 로 설정을 찾는다.
 * 승인은 원장이 /admin/pilots 에서 한다. 질문은 approved=false 로만 넣고, 이미 있는 칸은 덮어쓰지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 코드덩어리 } from "../clients.mjs";

const 패널파일 = {
  ilog: () => import("./seed-ilog-panel.mjs"),
  docttak: () => import("./seed-docttak-panel.mjs"),
};

/** 패널 파일 하나가 넣을 수 있는 모양인지 — 순수 함수. 틀리면 이유 글자, 맞으면 null */
export function 패널점검(m) {
  if (m.패널.length !== 20) return `질문이 ${m.패널.length}개`;
  if (new Set(m.패널.map(([, x]) => x)).size !== 20) return "같은 질문이 있음";
  const 덩어리 = 코드덩어리(m.SLUG);
  if (!덩어리) return `clients.mjs 에 ${m.SLUG} 덩어리 없음`;
  if (m.이름말() !== 덩어리.answerRe.source) return "이름 판별 말이 clients.mjs 와 다름";
  return null;
}

const 직접 = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (직접) {
  const ci = process.argv.indexOf("--client");
  const SLUG = ci > 0 ? process.argv[ci + 1] : null;
  if (!SLUG || !패널파일[SLUG]) {
    console.log(`사용: node scripts/seed-panel.mjs --client <${Object.keys(패널파일).join("|")}> [--dry|--apply]`);
    process.exit(1);
  }
  const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry");
  const m = await 패널파일[SLUG]();
  const 덩어리 = 코드덩어리(SLUG);
  const { 패널, 이름말, 파일럿 } = m;

  const { Pool } = await import("pg");
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const mm = /^([A-Z_]+)=(.*)$/.exec(l);
    if (mm && !process.env[mm[1]]) process.env[mm[1]] = mm[2];
  }
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  const db = await pool.connect();
  const q = (s, p = []) => db.query(s, p).then((r) => r.rows);
  try {
    const 틀림 = 패널점검(m);
    if (틀림) throw new Error(틀림);
    let [c] = await q(`select id, name, answer_pattern, measure_active from geo.clients where slug = $1`, [SLUG]);
    if (c && c.id !== 덩어리.id) throw new Error(`${SLUG} DB id ${c.id} ≠ clients.mjs id ${덩어리.id}`);
    const 새로 = !c;
    if (새로) {
      if (!m.새고객) throw new Error(`${SLUG} 고객사 없음`);
      const [자리] = await q(`select slug from geo.clients where id = $1`, [덩어리.id]);
      if (자리) throw new Error(`id ${덩어리.id} 를 ${자리.slug} 가 쓰고 있음 — clients.mjs id 를 고친다`);
      c = { id: 덩어리.id, name: 덩어리.name, answer_pattern: null, measure_active: false };
    }
    const [있는파일럿] = 새로 ? [] : await q(`select id, status, started_on::text as started_on from geo.pilots where client_id = $1`, [c.id]);
    const 있는질문 = 있는파일럿
      ? await q(`select position, stage, text, approved from geo.pilot_questions where pilot_id = $1 order by position`, [있는파일럿.id])
      : [];

    console.log(`${c.name} (client ${c.id}) · ${APPLY ? "넣음" : "dry — DB 안 씀"}`);
    if (새로) console.log(`  고객사: 새로 — slug ${SLUG} · ${덩어리.domain} · relation ${m.새고객.relation} · id ${덩어리.id}(clients.mjs)`);
    console.log(`  파일럿: ${있는파일럿 ? `있음 ${있는파일럿.id} ${있는파일럿.status} ${있는파일럿.started_on} — 그대로 둠` : `새로 — 0원 ${파일럿.status}, 오늘부터 30일`}`);
    if (파일럿.competitors) console.log(`  경쟁사: ${있는파일럿 ? "있는 파일럿이라 안 바꿈" : 파일럿.competitors}`);
    console.log(`  이름 판별: ${c.answer_pattern ?? "(비어 있음)"} → ${이름말()}`);
    console.log(`  측정 대상 고정(measure_active): ${c.measure_active} → true  (리허설 30+7일이 지나도 계속 잰다)`);
    console.log(`  질문 ${패널.length}개 (approved=false · 원장이 /admin/pilots 에서 승인)`);
    for (const [i, [stage, text, 출처]] of 패널.entries()) {
      const 칸 = 있는질문.find((x) => x.position === i + 1);
      console.log(`  q${String(i + 1).padEnd(2)} ${stage.padEnd(8)} ${text}   ← ${출처}${칸 ? `   [이미 있음: ${칸.text}${칸.approved ? " · 승인됨" : ""} — 덮어쓰지 않음]` : ""}`);
    }
    const 셈 = 패널.reduce((acc, [s]) => ((acc[s] = (acc[s] ?? 0) + 1), acc), {});
    console.log(`  단계: ${Object.entries(셈).map(([s, n]) => `${s} ${n}`).join(" · ")}`);

    if (APPLY) {
      await q("begin");
      if (새로) {
        // started_on 은 KST 날짜로 — 기본값 current_date 는 DB(UTC) 날짜다
        await q(`insert into geo.clients (id, slug, name, domain, relation, note, answer_pattern, measure_active, started_on)
                 values ($1,$2,$3,$4,$5,$6,$7,true,(now() at time zone 'Asia/Seoul')::date)`,
          [덩어리.id, SLUG, 덩어리.name, 덩어리.domain, m.새고객.relation, m.새고객.note, 이름말()]);
      }
      const [p] = await q(
        `insert into geo.pilots (client_id, price, payment_ref, contact_name, contact_email, contact_phone, receipt_type, terms_evidence,
                                 paid_at, started_on, ends_on, status, terms_accepted_at, competitors)
         values ($1,$2,$3,$4,$5,$6,$7,$8,null,(now() at time zone 'Asia/Seoul')::date,(now() at time zone 'Asia/Seoul')::date + 30,$9,now(),$10)
         on conflict (client_id) do update set client_id = excluded.client_id returning id`,
        [c.id, 파일럿.price, 파일럿.payment_ref, 파일럿.contact_name, 파일럿.contact_email, 파일럿.contact_phone,
          파일럿.receipt_type, 파일럿.terms_evidence, 파일럿.status, 파일럿.competitors ?? ""]);
      for (const [i, [stage, text]] of 패널.entries()) {
        await q(`insert into geo.pilot_questions (pilot_id, position, stage, text, approved) values ($1,$2,$3,$4,false)
                 on conflict (pilot_id, position) do nothing`, [p.id, i + 1, stage, text]);
      }
      await q(`update geo.clients set answer_pattern = $2, measure_active = true where id = $1`, [c.id, 이름말()]);
      await q("commit");
      const [n] = await q(`select count(*)::int n, count(*) filter (where approved)::int a from geo.pilot_questions where pilot_id = $1`, [p.id]);
      console.log(`\n넣음 — 파일럿 ${p.id} · 질문 ${n.n}개(승인 ${n.a}) · 승인은 /admin/pilots`);
    }
  } catch (e) {
    await q("rollback").catch(() => {});
    console.log("실패:", e.message);
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
}
