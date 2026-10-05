/**
 * 30일 파일럿 보고서 — 기준선(착수 뒤 첫 7일)과 최종(30일 마지막 7일) (Step 26 D6·D7·D8·D18).
 *
 *   node scripts/pilot-report.mjs --stage baseline --client <slug> [--dry]
 *   node scripts/pilot-report.mjs --stage final    --client <slug> [--dry]
 *
 * DB 에 남은 사실만 적는다. DB 는 읽기만 한다.
 * --dry 는 표준출력만. 아니면 고객별 비공개 폴더 deliverables/<slug>/pilot-reports/ 에 Markdown 과 손 확인 캡처를 쓴다
 * (web/public 이 아니다 — 웹으로 서빙되지 않고, .gitignore 로 저장소에도 안 올라간다).
 * 셈은 academy/pilot-report-core.mjs, 날짜는 academy/pilot-plan.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { 파일럿일정, 착수찾기, kst날짜 } from "../pilot-plan.mjs";
import { 측정설정 } from "../measure-targets.mjs";
import {
  곳정보, 곳들, 곳이름, 창, 셈, 몇번, 비율글, 잰날, 브랜드문항, 이름정규식, 경쟁사목록, 점유, 점유칸,
  곳비교, 판정, 창겹침, 최소잰날,
} from "../pilot-report-core.mjs";
import { countUsed } from "../../web/lib/marketing-core.mjs";
import { GROWTH_FOOT } from "../../web/lib/growth-core.mjs";

for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const slug = arg("--client"), stage = arg("--stage"), DRY = process.argv.includes("--dry");
if (!slug || !["baseline", "final"].includes(stage)) {
  console.log("사용법: node scripts/pilot-report.mjs --stage baseline|final --client <slug> [--dry]");
  process.exit(1);
}

const u = new URL(process.env.DATABASE_URL); u.searchParams.delete("sslmode");
const db = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
const q = (s, p = []) => db.query(s, p).then((r) => r.rows);
const 오늘 = kst날짜();
const 칸 = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ");
const 짧은날 = (d) => d.slice(5);

const SURFACE = { google_ai_overview: "구글 AI 개요", naver_ai_briefing: "네이버 AI 브리핑", google_ai_mode: "구글 AI 모드" };

async function main() {
  const [p] = await q(`select p.*, p.started_on::text as started_on_t, p.ends_on::text as ends_on_t,
      c.id as cid, c.slug, c.name, c.domain, c.answer_pattern
    from geo.pilots p join geo.clients c on c.id = p.client_id where c.slug = $1`, [slug]).catch(() =>
    q(`select p.*, p.started_on::text as started_on_t, p.ends_on::text as ends_on_t, c.id as cid, c.slug, c.name, c.domain
         from geo.pilots p join geo.clients c on c.id = p.client_id where c.slug = $1`, [slug]));
  if (!p) { console.log(`파일럿 없음: ${slug}`); return; }
  const 날칸 = (x) => (x == null ? null : x instanceof Date ? kst날짜(x) : String(x).slice(0, 10));

  const questions = await q(`select position, stage, text from geo.pilot_questions where pilot_id = $1 and approved order by position`, [p.id]);
  if (!questions.length) { console.log(`${p.name}: 승인된 질문이 없어 보고서를 만들 수 없습니다 — 착수 전`); return; }

  // 착수일 — 칸이 있으면 그것. 없으면 승인 시각 이후 첫 측정일. 승인 시각도 없는 옛 파일럿(Step 26 전)은 등록 때 시작일 이후 첫 측정일로 추정한다
  const 첫날들 = async (from) => (await q(`select distinct measured_on::text as d from academy.ai_measurements
      where client_id = $1 and prompt_id ~ '^q[0-9]+$' and measured_on >= $2::date order by 1 limit 3`, [p.cid, from])).map((r) => r.d);
  let 착수 = 날칸(p.kickoff_on), 착수근거 = "착수일 기록";
  if (!착수 && p.questions_approved_at) {
    착수 = 착수찾기(p.questions_approved_at, await 첫날들(kst날짜(new Date(new Date(p.questions_approved_at).getTime() - 86400000))));
    착수근거 = "질문 승인 뒤 첫 측정일(아직 기록 전)";
  }
  if (!착수 && !p.questions_approved_at) {
    착수 = (await 첫날들(p.started_on_t))[0] ?? null;
    착수근거 = "추정 — 승인 시각을 남기기 전 파일럿이라 등록 뒤 첫 측정일";
  }
  const 일정 = 파일럿일정({ kickoff_on: 착수, paid_on: 날칸(p.paid_on), needs_build: p.needs_build ?? "none", site_launch_on: 날칸(p.site_launch_on) });
  if (!일정.착수) { console.log(`${p.name}: 착수 전입니다 — 승인한 질문으로 첫 측정을 한 날이 착수일입니다`); return; }

  const 끝창 = stage === "final" ? 일정.최종 : 일정.기준선;
  if (!끝창) {
    console.log(일정.구축
      ? `${p.name}: 사이트 연 날이 없어 30일 창을 못 정합니다 — 파일럿 화면 「계약·일정」에 연 날을 넣어 주세요`
      : `${p.name}: 입금 확인 전 — 30일은 입금 확인일부터 셉니다(신청서). 파일럿 화면 「계약·일정」에 입금 확인일을 넣어 주세요`);
    return;
  }

  // 측정 — 승인 질문(q<번호>)만, 지금 질문 문구와 같은 기록만. 문구가 바뀐 옛 기록은 세지 않고 몇 건인지 적는다
  const 범위 = { from: 일정.기준선.from, to: 끝창.to };
  const raw = await q(`select measured_on::text as d, collection_method, engine, prompt_id, prompt_text, mentioned, cited, raw->>'answer' as answer
      from academy.ai_measurements where client_id = $1 and measured_on between $2 and $3 and prompt_id ~ '^q[0-9]+$'`,
    [p.cid, 범위.from, 범위.to]);
  const 질문 = new Map(questions.map((x) => [`q${x.position}`, x]));
  const rows = [], 다른문구 = [];
  for (const r of raw) {
    const x = 질문.get(r.prompt_id);
    if (!x) continue;
    if (r.prompt_text !== x.text) { 다른문구.push(r); continue; }
    rows.push({ ...r, stage: x.stage, position: x.position });
  }

  // 경쟁사 (D18). 우리 이름은 측정과 같은 판별(geo.clients.answer_pattern → clients.mjs)
  const conf = 측정설정({ id: p.cid, slug: p.slug, name: p.name, domain: p.domain, answer_pattern: p.answer_pattern });
  const 경쟁사 = 경쟁사목록(p.competitors);
  const 이름들 = [{ key: "우리", re: conf?.answerRe ?? 이름정규식(p.name) }, ...경쟁사.map((n) => ({ key: n, re: 이름정규식(n) }))];

  // 손 확인 기록 (D8). 표가 아직 없으면(스키마 적용 전) 없다고 적는다
  const checks = await q(`select id, question, surface, checked_on::text as checked_on, shown, note, capture_type,
      ${DRY ? "null::bytea" : "capture"} as capture from geo.pilot_manual_checks where pilot_id = $1 order by checked_on, id`, [p.id]).catch(() => null);

  const 폴더 = path.join(fileURLToPath(new URL("../../deliverables", import.meta.url)), slug, "pilot-reports");
  const 캡처파일 = (c) => `capture-${c.id}.${String(c.capture_type).split("/")[1] === "jpeg" ? "jpg" : String(c.capture_type).split("/")[1]}`;

  const out = [];
  const w = (s = "") => out.push(s);
  const 방법절 = (창들) => {
    w("## 수집 방법");
    w();
    w(`질문은 고객이 승인한 20개 그대로다. 곳마다 하루 1회 묻는다. 한 번 나온 것을 적중으로 세지 않고, 질문×곳마다 「n번 중 k번」으로 적는다. 곳이 다르면 합치지 않는다.`);
    w(`「언급」은 답에 이름이 나온 것, 「인용」은 출처 목록에 ${p.domain} 이 있는 것이다. 답 원문과 출처는 질문마다 보관해 다시 셀 수 있다.`);
    w();
    for (const m of 곳들(rows)) {
      const 엔진 = [...new Set(rows.filter((r) => r.collection_method === m).map((r) => r.engine))].join(", ");
      w(`- **${곳이름(m)}** — ${곳정보[m]?.방법 ?? "계약 밖 수집 방법이라 판정에 쓰지 않는다"} · 엔진 기록 ${엔진 || "없음"}`);
      for (const [이름, 창w] of 창들) {
        const 날 = 잰날(창(rows.filter((r) => r.collection_method === m), 창w), 창w);
        const n = 창(rows.filter((r) => r.collection_method === m), 창w).length;
        w(`  - ${이름} ${창w.from} ~ ${창w.to} · 잰 날 ${날.잰.length}/${날.전부.length}${날.빠진.length ? ` (빠진 날 ${날.빠진.map(짧은날).join(", ")})` : ""} · 표본 ${n}`);
      }
    }
    if (!rows.length) w("- 이 기간에 잰 기록이 없다");
    w();
    w("잰 날이 빠지면(PC 꺼짐·차단) 빠진 대로 적었다. 채워 넣지 않았다.");
    if (다른문구.length) w(`질문 문구가 지금 승인본과 다른 옛 기록 ${다른문구.length}건은 세지 않았다.`);
    w("구글 AI 개요·네이버 AI 브리핑은 자동 측정이 없어 아래 「손 확인」에 따로 적는다.");
    w();
  };

  const 질문표 = (제목, 대상, 창w) => {
    const ms = 곳들(창(rows, 창w));
    w(`### ${제목}`);
    w();
    w(`| 질문 | ${ms.map(곳이름).join(" | ")} |`);
    w(`|---|${ms.map(() => "---").join("|")}|`);
    for (const x of 대상) {
      const 칸들 = ms.map((m) => {
        const s = 셈(창(rows, 창w).filter((r) => r.collection_method === m && r.position === x.position));
        return s.n ? `${몇번(s.n, s.m)} · 인용 ${s.c}번` : "안 잼";
      });
      w(`| ${x.position}. ${칸(x.text)} | ${칸들.join(" | ")} |`);
    }
    const 합 = ms.map((m) => 비율글(셈(창(rows, 창w).filter((r) => r.collection_method === m && 대상.some((x) => x.position === r.position)))));
    w(`| **곳별 합계** | ${합.join(" | ")} |`);
    w();
  };

  const 성과 = questions.filter((x) => !브랜드문항(x.stage)), 브랜드 = questions.filter((x) => 브랜드문항(x.stage));

  const 경쟁절 = (창w, 제목) => {
    w(`## 경쟁사 — ${제목}`);
    w();
    if (!경쟁사.length) { w("경쟁사 미설정 — 파일럿 화면 「계약·일정」에 경쟁사 이름을 넣으면 이 절이 채워진다."); w(); return; }
    w(`이미 보관한 답 원문에서 셌다(새로 묻지 않았다). 브랜드 3문항은 뺐다 — 질문에 우리 이름이 들어 있다. 괄호는 답 안에서 처음 나온 순서의 분포다. 곳끼리 합치지 않고, 점수로 묶지 않는다.`);
    w(`우리 이름은 측정과 같은 판별로, 경쟁사는 넣은 이름 글자 그대로 찾았다(${경쟁사.join(", ")}). 이름이 흔하면 다른 곳이 섞일 수 있다.`);
    w();
    for (const m of 곳들(창(rows, 창w))) {
      const mine = 창(rows, 창w).filter((r) => r.collection_method === m);
      w(`### ${곳이름(m)}`);
      w();
      if (!mine.length) { w("안 잼 — 표본 0"); w(); continue; }
      w(`| 질문 | ${이름들.map((x) => 칸(x.key)).join(" | ")} |`);
      w(`|---|${이름들.map(() => "---").join("|")}|`);
      for (const x of 성과) {
        const z = 점유(mine.filter((r) => r.position === x.position), 이름들);
        if (!z.n && !z.원문없음) continue;
        w(`| ${x.position}. ${칸(x.text)} | ${이름들.map((e) => 점유칸(z.n, z.이름별[e.key])).join(" | ")} |`);
      }
      const 합 = 점유(mine.filter((r) => !브랜드문항(r.stage)), 이름들);
      w(`| **17문항 합계** | ${이름들.map((e) => 점유칸(합.n, 합.이름별[e.key])).join(" | ")} |`);
      if (합.원문없음) w(`\n답 원문이 없는 기록 ${합.원문없음}건은 경쟁사 셈에서 빠졌다.`);
      w();
    }
  };

  const 캡처들 = [];
  const 손절 = (회차들) => {
    w("## 손 확인 — 구글 AI 개요 · 네이버 AI 브리핑");
    w();
    w("자동 측정 도구가 없어 담당자가 직접 본 기록이다(시작·30일 차 각 1회, 화면 캡처 첨부). 표본이 작아 방향 참고용이고 위 비율에 넣지 않았다.");
    w();
    if (checks == null) { w("손 확인 표가 아직 없다(스키마 적용 전)."); w(); return; }
    for (const [이름, 조건] of 회차들) {
      const cs = checks.filter(조건);
      w(`### ${이름}`);
      w();
      if (!cs.length) { w(`기록 없음 — 파일럿 화면 「손 확인 기록」에서 넣는다.`); w(); continue; }
      w("| 날짜 | 화면 | 질문 | 결과 | 캡처 |");
      w("|---|---|---|---|---|");
      for (const c of cs) {
        const 파일 = c.capture_type ? 캡처파일(c) : null;
        if (파일 && c.capture) 캡처들.push([파일, c.capture]);
        w(`| ${c.checked_on} | ${SURFACE[c.surface] ?? c.surface} | ${칸(c.question)} | ${c.shown}${c.note ? ` — ${칸(c.note)}` : ""} | ${파일 ?? "없음"} |`);
      }
      w();
    }
  };

  const 기간줄 = `착수 ${일정.착수} (${착수근거}) · ${일정.구축 ? `구축·세팅 있음 · 사이트 연 날 ${일정.시작 ?? "미입력"}` : `구축 없음 · 입금 확인일 ${일정.시작 ?? "미입력"}`} · 30일 ${일정.시작 ? `${일정.시작} ~ ${일정.끝}` : 일정.구축 ? "연 날 미입력" : "입금 확인 전"}`;

  if (stage === "baseline") {
    const b = 일정.기준선;
    w(`# ${p.name} · 기준선 보고`);
    w();
    w(`기준선: ${b.from} ~ ${b.to} (착수 뒤 첫 7일)  `);
    w(`${기간줄}  `);
    w(`만든 날: ${오늘}${오늘 <= b.to ? ` — 기준선 7일이 아직 안 끝났다. ${오늘}까지 잰 것만 적었다` : ""}`);
    w();
    방법절([["기준선", b]]);
    w("## 질문별 결과 — 기준선 7일");
    w();
    질문표("지역·문제·비교 17문항 (성과 지표)", 성과, b);
    질문표("브랜드 3문항 (방어 지표 — 판정에 안 씀)", 브랜드, b);
    경쟁절(b, "기준선 7일");
    손절([["기준선 회차", (c) => !일정.최종 || c.checked_on < 일정.최종.from]]);
    w("## 보장하지 않는 것");
    w();
    w("노출·순위·문의를 보장하지 않는다. 보장하는 것은 약속한 작업의 수행과 같은 조건의 재측정 보고다.");
  } else {
    const b = 일정.기준선, f = 일정.최종;
    const 끝났나 = 오늘 > f.to;
    const [inq] = await q(`select count(*)::int total, count(*) filter (where source = 'AI')::int ai,
        count(*) filter (where source in ('AI','네이버검색','구글검색'))::int search,
        count(*) filter (where enrolled)::int enrolled, count(*) filter (where enrolled is null)::int unknown
      from academy.inquiries where client_id = $1 and day between $2 and $3`, [p.cid, 일정.시작, 일정.끝]);
    const 비교들 = 곳들(rows).map((m) => 곳비교(rows, m, b, f));
    const 겹침 = 창겹침(일정);
    const 결론 = 판정({ 비교들, 문의: inq, 끝났나, 겹침 });
    const [tasks, audits, content] = await Promise.all([
      q(`select * from geo.pilot_tasks where pilot_id = $1 order by due_on, id`, [p.id]),
      q(`select * from geo.local_audits where pilot_id = $1`, [p.id]),
      q(`select * from geo.content_approvals where pilot_id = $1`, [p.id]),
    ]);

    w(`# ${p.name} · 30일 파일럿 최종 보고`);
    w();
    w(`${기간줄}  `);
    w(`비교: 기준선 ${b.from} ~ ${b.to} vs 마지막 7일 ${f.from} ~ ${f.to}  `);
    w(`만든 날: ${오늘}${끝났나 ? "" : ` — 마지막 7일이 아직 안 끝났다. ${오늘}까지 잰 것만 적었다`}  `);
    w(`판정: **${결론.결과}** — ${결론.이유}  `);
    w(결론.곳);
    w();
    방법절([["기준선", b], ["마지막 7일", f]]);

    w("## 곳별 비교 — 지역·문제·비교 17문항");
    w();
    w(`같은 곳·같은 방법끼리만 비교한다. 두 창 모두 ${최소잰날}일 이상 잰 곳만 비교하고, 못 미치면 「표본 부족」이다. 브랜드 3문항은 뺐다.`);
    w();
    w("| 곳 | 기준선 | 마지막 7일 | 비교 |");
    w("|---|---|---|---|");
    for (const x of 비교들) {
      const 판 = !x.약속 ? "계약 밖 방법 — 판정에 안 씀"
        : 겹침 ? "창 겹침 — 비교 안 함"
        : !x.비교됨 ? `표본 부족 (잰 날 ${x.기준날.잰.length}일 · ${x.끝날.잰.length}일)`
        : `언급 비율 ${x.변화}`;
      w(`| ${곳이름(x.곳)} | ${비율글(x.기준)} | ${비율글(x.끝)} | ${판} |`);
    }
    w();
    w("판정은 언급(답에 이름이 나온) 비율로만 한다. 인용 비율은 참고로 옆에 적었다.");
    if (겹침) { w(); w(겹침); }
    w();

    w("## 질문별 결과");
    w();
    질문표("기준선 7일 — 17문항", 성과, b);
    질문표("마지막 7일 — 17문항", 성과, f);
    질문표("브랜드 3문항 — 기준선 (방어 지표 — 판정에 안 씀)", 브랜드, b);
    질문표("브랜드 3문항 — 마지막 7일", 브랜드, f);

    경쟁절(b, "기준선 7일");
    경쟁절(f, "마지막 7일");
    손절([["기준선 회차", (c) => c.checked_on < f.from], ["30일 차 회차", (c) => c.checked_on >= f.from]]);

    w("## 상담 유입 (30일)");
    w();
    w(`- 전체 문의 ${inq.total}건`);
    w(`- AI 직접 확인 ${inq.ai}건`);
    w(`- AI·검색 확인 ${inq.search}건`);
    w(`- 등록 ${inq.enrolled}명`);
    w(`- 결과 미입력 ${inq.unknown}건`);
    w();
    w("## 납품");
    w();
    for (const t of tasks) w(`- [${t.status === "완료" ? "x" : " "}] ${t.title}${t.evidence ? ` — ${String(t.evidence).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join(" / ")}` : ""}`);
    w();
    w("## 정보 정합성");
    w();
    w(`- 확인 ${audits.filter((a) => a.verdict !== "미확인").length}/${audits.length}`);
    w(`- 불일치 ${audits.filter((a) => a.verdict === "불일치").length}건`);
    w();
    w("## 콘텐츠");
    w();
    for (const c of content) w(`- ${c.title || "제목 미정"} · ${c.status}${c.published_url ? ` · ${c.published_url}` : ""}`);
    w();
    w("## 갱신 판단");
    w();
    w(결론.결과 === "성공" ? "성공 기준이 확인됐다. 월 구독(파일럿 뒤 선택)을 안내할 수 있다."
      : 결론.결과 === "실패" ? "성공 기준이 확인되지 않았다. 실패 원인을 문서로 남기고 갱신을 권하지 않는다."
      : "판정을 보류한다. 같은 조건의 비교나 상담 결과가 채워지기 전에는 갱신을 권하지 않는다.");
    w();
    w("노출·순위·문의를 보장하지 않는다. 보장하는 것은 약속한 작업의 수행과 같은 조건의 재측정 보고다. 변화가 없거나 나빠져도 그대로 적었다.");
  }

  /**
   * 바깥 글(Step 35 D56) — 올린 글 주소가 AI 답 출처(citations)에 나왔나. 곳별로 센다(곳 = 측정 방법).
   * 표가 없거나 올린 글이 없으면 절을 안 쓴다. 기여(이 글 덕에 이름이 나왔다)는 추정하지 않는다
   */
  const 올린 = await q(`select id, posted_url, (posted_at at time zone 'Asia/Seoul')::date::text as posted_day from geo.marketing_posts
      where client_id = $1 and status = '올림' and posted_url is not null and posted_at is not null`, [p.cid]).catch(() => []);
  if (올린.length) {
    const 첫날 = 올린.map((x) => x.posted_day).sort()[0];
    const 출처 = await q(`select m.collection_method as engine, m.measured_on::text as measured_on, c->>'url' as url
        from academy.ai_measurements m, jsonb_array_elements(m.citations) c
        where m.client_id = $1 and m.measured_on between $2::date and $3::date and m.prompt_id ~ '^q[0-9]+$'`, [p.cid, 첫날, 오늘]);
    const 셈결과 = countUsed(올린, 출처);
    w("## 바깥 글 — AI 답 출처로 쓰였나");
    w();
    w(`올린 글 ${셈결과.posted}개 중 ${셈결과.used}개가 AI 답 출처로 쓰였다(${첫날} ~ ${오늘} 승인 질문 측정. 올린 날 전 측정은 안 셈).`);
    for (const [곳, n] of Object.entries(셈결과.perEngine)) w(`- ${곳이름(곳)} ${n}개`);
    w();
    w("출처 목록에 올린 주소가 나온 것만 셌다. 이 글 덕에 이름이 나왔다는 기여는 추정하지 않았다.");
    w();
  }

  /**
   * 고객 저장소 주간 성장 리포트(Step 36) — 그 고객 행이 있을 때만. 숫자는 리포트 값 그대로, 주 단위.
   * 기간 안 = 리포트 생성일이 파일럿 범위 안. 표가 없거나 행이 없으면 절을 안 쓴다
   */
  const 성장 = await q(`select week, generated::text as generated, source_url, gsc, cf from geo.growth_reports
      where client_id = $1 and generated between $2::date and $3::date order by week`, [p.cid, 범위.from, 범위.to]).catch(() => []);
  if (성장.length) {
    w(`## 구글 검색·서버 통계 (${p.name} 성장 리포트)`);
    w();
    w("| 주 | 서치콘솔 7일 기간 | 클릭 | 노출 | CTR | 평균 순위 | Cloudflare 7일 | 요청 | 페이지뷰 | 일별 순방문자 합 |");
    w("|---|---|---:|---:|---:|---:|---|---:|---:|---:|");
    const 수 = (v) => Math.round(v).toLocaleString("ko-KR");
    for (const r of 성장) {
      const g = r.gsc, c = r.cf;
      const 구글 = g ? `${g.range7.startDate}~${g.range7.endDate} | ${수(g.last7.clicks)} | ${수(g.last7.impressions)} | ${(g.last7.ctr * 100).toFixed(1)}% | ${g.last7.position ? g.last7.position.toFixed(1) : "-"}` : "리포트에 없음 | | | |";
      const 서버 = c ? `~${c.until}, ${c.last7.days}일 | ${수(c.last7.requests)} | ${수(c.last7.pageViews)} | ${수(c.last7.uniques)}` : "리포트에 없음 | | |";
      w(`| ${r.week} | ${구글} | ${서버} |`);
    }
    w();
    w(`출처: ${성장.map((r) => r.source_url).join(" · ")}`);
    w();
    for (const l of GROWTH_FOOT) w(`${l}  `);
    w();
  }

  const md = out.join("\n") + "\n";
  if (DRY) { console.log(md); return; }
  fs.mkdirSync(폴더, { recursive: true });
  const 파일 = path.join(폴더, `${stage}-${오늘}.md`);
  fs.writeFileSync(파일, md);
  for (const [이름, buf] of 캡처들) fs.writeFileSync(path.join(폴더, 이름), buf);
  console.log(`보고서: ${파일}${캡처들.length ? ` · 캡처 ${캡처들.length}장` : ""}`);
}

main()
  .catch((e) => { console.log("실패:", e.message); process.exitCode = 1; })
  .finally(() => db.end());
