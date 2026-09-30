/**
 * 아이로그 질문 패널 초안 20개 + 0원 리허설 파일럿 (Step 30 D34).
 *
 * 9/10 에 고객사로 받았는데 geo.pilots·pilot_questions 가 없어 AI 측정이 0건이었다(학원 381건).
 * 측정기(ai-measure·ai-web-measure)와 개선 루프(daily-agent)는 승인 질문이 있는 고객만 잰다.
 *
 * 질문은 지어내지 않았다. 재료는 셋뿐이다.
 *   consider  회사 루프 who-wins 가 만든 「겨냥 초안」 일감 7건의 질문 원문 (geo.agent_tasks kind=question-draft, client 2 — 2026-09-30 DB 에서 읽음)
 *   problem   아이로그 가이드(C:\dev\자동피드백생성기 lib/guides.ts) 주제 — 가이드 제목 그대로가 아니라 채팅창 말투로 고침(Arch 2026-09-30).
 *             영어 내신 출제는 주제 밖이라 빼고 요금 질문으로 바꿈(요금 답은 guides.ts·marketing-facts.ts 에 있다)
 *   keyword   검색어형(Step 22 틀처럼 사람이 치는 말) — clients.mjs 아이로그 검색어와 guides.ts 의 query 칸
 *   brand     이름 질문 3개 — 학원 패널의 이름 질문 꼴(「어떤 곳이야?」「이 사이트 무슨 …」)과 guides.ts FAQ 원문
 * 기능은 guides.ts·marketing-facts.ts 에 적힌 것(출결 키패드·알림톡·문자·수업 리포트·영어 예상 문제)만 질문에 들어간다.
 *
 * 승인은 원장이 /admin/pilots 에서 한다. 여기서는 approved=false 로만 넣는다. 이미 있는 칸은 덮어쓰지 않는다.
 *
 *   node scripts/seed-ilog-panel.mjs            (기본) 넣을 것을 찍기만 한다. DB 안 씀
 *   node scripts/seed-ilog-panel.mjs --apply    넣는다 — Arch 가 돌린다
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bySlug } from "../clients.mjs";

export const SLUG = "ilog";

/** [stage, 질문, 출처] — 출처는 검토용. DB 에는 안 넣는다 */
export const 패널 = [
  ["consider", "학원 관리 프로그램 뭐가 좋은가요?", "겨냥 초안 일감 #28"],
  ["consider", "학원 관리 프로그램 추천 순위나 후기 알려줘", "겨냥 초안 일감 #29"],
  ["consider", "무료로 쓸 수 있는 학원 관리 프로그램 있나요?", "겨냥 초안 일감 #30"],
  ["consider", "학원에서 카톡 알림 보내는 프로그램 뭐 써요?", "겨냥 초안 일감 #32"],
  ["consider", "학원 수업 리포트 보내는 앱 어떤 게 좋아요?", "겨냥 초안 일감 #33"],
  ["consider", "학원관리프로그램 추천 좀 해주세요", "겨냥 초안 일감 #417"],
  ["consider", "학원 출결 관리 앱 뭐가 있어요?", "겨냥 초안 일감 #757"],
  ["problem", "학원 관리 프로그램 고를 때 뭘 봐야 해?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — how-to-choose-academy-management-program"],
  ["problem", "무료 학원 관리 프로그램은 어디까지 공짜야?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — free-academy-management-program"],
  ["problem", "학원 출결을 학부모한테 카톡으로 자동으로 보내려면 어떻게 해?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — academy-attendance-kakao-notification"],
  ["problem", "학원 수업 리포트를 AI가 써 주는 프로그램 있어?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — ai-class-report"],
  ["problem", "학원 관리 프로그램 한 달에 보통 얼마야?", "guides.ts 주제 · 채팅 말투로 고침(Arch) — 요금(영어 내신 출제는 주제 밖이라 뺌)"],
  ["keyword", "학원 관리 프로그램 추천", "guides.ts query · 설계서 예시"],
  ["keyword", "무료 학원 관리 프로그램", "guides.ts query · clients.mjs c3"],
  ["keyword", "학원 출결 관리 앱", "clients.mjs c4"],
  ["keyword", "학원 카톡 알림 프로그램", "clients.mjs c5"],
  ["keyword", "학원 수업 리포트 앱", "guides.ts query · clients.mjs c6"],
  ["brand", "아이로그 학원 관리 프로그램 어떤 거야?", "이름 질문 — 학원 패널 「어떤 곳이야?」 꼴"],
  ["brand", "ilog.ai.kr 이 사이트 뭐 하는 곳이야?", "이름 질문 — 학원 패널 「robotncoding.com 이 사이트 무슨 학원이야?」 꼴"],
  ["brand", "아이로그는 정말 무료인가요?", "guides.ts how-to-choose FAQ 원문"],
];

/** AI 답에서 이름을 세는 말 — clients.mjs 가 원문이다(한 곳) */
export const 이름말 = () => bySlug(SLUG).answerRe.source;

const 파일럿 = {
  price: 0, payment_ref: "자사 실증", contact_name: "원장",
  // guides.ts FAQ 에 적힌 아이로그 문의 주소
  contact_email: "ilog.ai@kakao.com",
  contact_phone: "자사", receipt_type: "해당 없음", terms_evidence: "대표자 본인 운영", status: "리허설",
};

const 직접 = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (직접) {
  const APPLY = process.argv.includes("--apply");
  const { Pool } = await import("pg");
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  const db = await pool.connect();
  const q = (s, p = []) => db.query(s, p).then((r) => r.rows);
  try {
    if (패널.length !== 20) throw new Error(`질문이 ${패널.length}개`);
    const [c] = await q(`select id, name, answer_pattern, measure_active from geo.clients where slug = $1`, [SLUG]);
    if (!c) throw new Error(`${SLUG} 고객사 없음`);
    const [있는파일럿] = await q(`select id, status, started_on::text as started_on from geo.pilots where client_id = $1`, [c.id]);
    const 있는질문 = 있는파일럿
      ? await q(`select position, stage, text, approved from geo.pilot_questions where pilot_id = $1 order by position`, [있는파일럿.id])
      : [];

    console.log(`${c.name} (client ${c.id}) · ${APPLY ? "넣음" : "dry — DB 안 씀"}`);
    console.log(`  파일럿: ${있는파일럿 ? `있음 ${있는파일럿.id} ${있는파일럿.status} ${있는파일럿.started_on} — 그대로 둠` : `새로 — 0원 ${파일럿.status}, 오늘부터 30일`}`);
    console.log(`  이름 판별: ${c.answer_pattern ?? "(비어 있음)"} → ${이름말()}`);
    console.log(`  측정 대상 고정(measure_active): ${c.measure_active} → true  (리허설 30+7일이 지나도 계속 잰다)`);
    console.log(`  질문 ${패널.length}개 (approved=false · 원장이 /admin/pilots 에서 승인)`);
    for (const [i, [stage, text, 출처]] of 패널.entries()) {
      const 칸 = 있는질문.find((x) => x.position === i + 1);
      console.log(`  q${String(i + 1).padEnd(2)} ${stage.padEnd(8)} ${text}   ← ${출처}${칸 ? `   [이미 있음: ${칸.text}${칸.approved ? " · 승인됨" : ""} — 덮어쓰지 않음]` : ""}`);
    }
    const 셈 = 패널.reduce((m, [s]) => ((m[s] = (m[s] ?? 0) + 1), m), {});
    console.log(`  단계: ${Object.entries(셈).map(([s, n]) => `${s} ${n}`).join(" · ")}`);

    if (APPLY) {
      await q("begin");
      const [p] = await q(
        `insert into geo.pilots (client_id, price, payment_ref, contact_name, contact_email, contact_phone, receipt_type, terms_evidence,
                                 paid_at, started_on, ends_on, status, terms_accepted_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,null,(now() at time zone 'Asia/Seoul')::date,(now() at time zone 'Asia/Seoul')::date + 30,$9,now())
         on conflict (client_id) do update set client_id = excluded.client_id returning id`,
        [c.id, 파일럿.price, 파일럿.payment_ref, 파일럿.contact_name, 파일럿.contact_email, 파일럿.contact_phone,
          파일럿.receipt_type, 파일럿.terms_evidence, 파일럿.status]);
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
