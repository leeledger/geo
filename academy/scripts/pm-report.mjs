/**
 * 총괄(PM) 아침 보고 — 하루 한 장. 현황판 /admin/ops 맨 위 「오늘 아침 보고」가 읽는다.
 *
 * 영상(Hermes 멀티프로필, 원장 2026-09-24)의 자비스 보고 양식을 따른다:
 *   상태 · 결론 · 직원별 한 일 · 확인 필요 · 원장 할 일 · 산출물 · 다음
 *
 * 모델을 부르지 않는다(Arch D2). 숫자는 DB 에서 센 것만, 문장은 정해진 틀에 숫자만 넣는다.
 * 슬롭이 들어올 자리가 없고 지어낼 수 없다.
 *
 * 확인 필요 (원장 할 일 목록과 따로 — 할 일에는 안 올린다, D4)
 *   (a) 5번 이상 시도하고도 안 끝난 열린 일감 (company.mjs 가 payload.escalated 를 적는다)
 *   (b) 감사 조사가 사람 대기
 *   (c) 정해진 작업이 24시간 넘게 늦음
 *   (d) 자동 코드 수리가 스스로 멈췄거나 수리안이 원장 승인을 기다림 (repair-core 수리상태)
 *
 * 회사 루프(company.mjs)가 매시 끝에 부른다. KST 08시 이후이고 오늘 보고가 없을 때만 만든다.
 *
 *   node scripts/pm-report.mjs           오늘 보고가 없으면 만든다 (08시 전이면 안 만든다)
 *   node scripts/pm-report.mjs --dry     만들어 찍기만 한다. 저장 안 함, 시각 무관
 *   node scripts/pm-report.mjs --force   있어도 다시 만들어 덮어쓴다
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 확장줄 } from "./loop-grow.mjs";
import { 수리상태, 수리입력 } from "../../web/lib/repair-core.mjs";
import { 글기록읽기 } from "../../web/lib/post-auto-core.mjs";

const KST = 9 * 3600 * 1000;
const 시 = 3600 * 1000;

/** 직원 — agents/<id> 와 같은 이름 */
const 직원들 = [
  ["pm", "매시 점검"], ["research", "측정"], ["content", "글 쓰기"], ["illustrate", "그림"],
  ["deliver", "색인·블로그 옮기기"], ["audit", "자동 점검"], ["repair", "자동 코드 수리"],
  // 영업은 멈춤(2026-09-24 원장: 학원 레퍼런스가 서기 전까지 영업 카테고리 불필요). 다시 켜면 여기와 정해진작업에 되돌린다
];

/**
 * 정해진 작업 — 주기(시간). 이 주기에 하루를 더 넘겨도 기록이 없으면 「24시간 넘게 늦음」.
 * ★ .github/workflows/*.yml 의 cron 과 web/lib/agents.ts ROLES 에서 옮긴 것. yml 을 바꾸면 여기도
 * self 는 그 일이 스스로 남기는 활동 — 옮긴 줄(자동 작업 X)과 둘 중 늦은 쪽을 본다
 */
const 정해진작업 = {
  watch: { 이름: "사이트 점검", 주기: 3 },
  audit: { 이름: "자동 점검", 주기: 24, self: "a.agent = 'audit'" },
  scout: { 이름: "문제 정찰", 주기: 24 },
  optimize: { 이름: "AI 답변 측정", 주기: 24 },
  serp: { 이름: "검색 순위 측정", 주기: 24 },
  snapshot: { 이름: "색인 알림", 주기: 24 },
  repair: { 이름: "자동 코드 수리", 주기: 24, self: "a.agent = 'repair'" },
  write: { 이름: "주간 초안 작성", 주기: 24 * 7 },
};
/** 옮긴 줄의 작업 → 직원. 스스로 활동을 적는 작업(audit·repair·sales)은 옮긴 줄을 실패일 때만 센다(이중 계산) */
const 작업직원 = { watch: "pm", scout: "research", serp: "research", optimize: "research", snapshot: "deliver", write: "content", audit: "audit", repair: "repair" };   // sales 는 멈춤 — 직원들에 없는 id 를 주면 셈[id] 가 비어 보고가 죽는다
const 스스로적음 = new Set(["audit", "repair", "sales"]);

const 직원of = (agent, kind) => {
  if (agent === "content") return kind === "illustrate" ? "illustrate" : "content";
  if (agent === "ops") return "pm";
  if (agent === "measure" || agent === "improve") return "research";
  return 직원들.some(([id]) => id === agent) ? agent : "pm";
};

const kst = (d) => new Date(new Date(d).getTime() + KST);
const 월일 = (d) => { const k = kst(d); return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`; };
const 시각 = (d) => { const k = kst(d); return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`; };
/** 「감사가」「점검이」 — 받침에 따라 (web/lib/agents.ts 와 같은 셈) */
const 이가 = (w) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 === 0 ? `${w}가` : `${w}이`;
};
const 요일 = ["일", "월", "화", "수", "목", "금", "토"];
/** 어절 경계에서 자른다 — web/lib/todo-text.ts cut 과 같은 꼴 */
const cut = (s, n) => {
  const t = String(s ?? "").trim();
  if (t.length <= n) return t;
  let x = t.slice(0, n);
  const sp = x.lastIndexOf(" ");
  if (sp > n * 0.5) x = x.slice(0, sp);
  return `${x.replace(/[\s,·:—-]+$/, "")}…`;
};

/** 다음 주간 초안 시각 — write.yml 월 06:07 KST */
const 다음초안 = (now) => {
  const k = kst(now);
  const 오늘시각 = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 6, 7) - KST;
  const 남은날 = k.getUTCDay() === 1 && now.getTime() < 오늘시각 ? 0 : ((8 - k.getUTCDay()) % 7) || 7;
  const t = new Date(오늘시각 + 남은날 * 86400000);
  return `${월일(t)}(${요일[kst(t).getUTCDay()]}) 06:07`;
};

export const 표만들기 = (q) => q(`create table if not exists geo.pm_reports (
  day date primary key, at timestamptz not null default now(), status text not null, body jsonb not null)`);

/** DB 에서 세어 보고 한 장을 짓는다. 저장은 안 한다 */
export async function 보고짓기(q, now = new Date()) {
  const k = kst(now);
  const 오늘 = k.toISOString().slice(0, 10);
  // 어제 09시(KST) = 어제 00시(UTC)
  const 시작 = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - 1, 0, 0));

  const 활동들 = await q(
    `select a.agent, a.action, a.ok, a.at, t.kind from geo.agent_activity a
       left join geo.agent_tasks t on t.id = a.task_id
      where a.at >= $1 and a.at <= $2 order by a.at`, [시작, now]);
  const 열린 = await q(
    `select id, agent, kind, status, attempts, title, coalesce((payload->>'escalated')::boolean, false) escalated
       from geo.agent_tasks where status not in ('완료', '닫힘')`);

  // ── 직원별 한 일
  const 셈 = Object.fromEntries(직원들.map(([id]) => [id, { 성공: 0, 실패: 0, 마지막: null, 점검: 0 }]));
  for (const a of 활동들) {
    if (a.action === "회사 루프") { 셈.pm.점검++; continue; }
    // 확인 필요로 올린 표시는 한 일이 아니다. 성공으로도 실패로도 세지 않는다 — 그 일은 확인 필요 목록에 따로 뜬다
    if (a.action === "원장 확인 필요로 올림") continue;
    if (a.action === "매시 점검 시작" || a.action === "매시 점검 깨움") continue;   // 출근 표시일 뿐 일이 아니다
    const m = /^자동 작업 ([a-z]+)$/.exec(a.action);
    let id;
    if (m) {
      id = 작업직원[m[1]] ?? "pm";
      if (스스로적음.has(m[1]) && a.ok) continue;
    } else id = 직원of(a.agent, a.kind);
    const s = 셈[id];
    a.ok ? s.성공++ : s.실패++;
    s.마지막 = a;
  }

  // ── 자동 코드 수리 — 현황판과 같은 셈(repair-core). 멈춤·승인 기다림만 원장님 확인 줄에 올린다
  const 수리 = 수리상태(await 수리입력(q));

  // ── 정해진 작업의 마지막 기록
  const 늦음 = [];
  for (const [wf, j] of Object.entries(정해진작업)) {
    const [r] = await q(
      `select max(at) at from geo.agent_activity a where a.action = $1 ${j.self ? `or ${j.self}` : ""}`, [`자동 작업 ${wf}`]);
    if (!r?.at) { 늦음.push({ wf, 말: `${j.이름} 기록이 한 번도 없습니다` }); continue; }
    const 지남 = (now - new Date(r.at)) / 시;
    // 주기 + 24시간 + 옮겨 적기 여유(90분, agents.ts LATE_GRACE_MIN)
    if (지남 > j.주기 + 24 + 1.5) 늦음.push({ wf, 말: `${이가(j.이름)} ${Math.floor(지남)}시간째 안 돌았습니다 (마지막 ${월일(r.at)} ${시각(r.at)})` });
  }

  // ── 확인 필요
  const 되풀이 = 열린.filter((t) => (t.attempts >= 5 || t.escalated) && t.status !== "사람 대기");
  const 조사 = 열린.filter((t) => t.agent === "audit" && t.kind === "investigate" && t.status === "사람 대기");
  const 확인필요 = [
    // attempts 는 시도 수다(관찰로 다시 띄운 것도 센다). 실패 수로 쓰지 않는다(Richard 19)
    ...되풀이.map((t) => `「${cut(t.title, 50)}」 — ${t.attempts}번 해 봤는데 안 끝났습니다. 자동으로 계속 다시 합니다`),
    // 조사는 건마다 적지 않는다 — 할 일은 「오늘 하실 일」에 있다
    ...(조사.length ? [`자동 점검이 원장님 판단을 기다리는 일 ${조사.length}건 — 「오늘 하실 일」에 있습니다`] : []),
    ...늦음.map((x) => x.말),
    ...(수리.kind === "paused" ? [`자동 코드 수리: ${수리.text}`] : []),
    ...(수리.kind === "waiting" ? [`자동 코드 수리: ${수리.text} — 현황판에서 합치기/버리기`] : []),
  ];

  // ── 직원별 지금 상태
  const 열린셈 = Object.fromEntries(직원들.map(([id]) => [id, { n: 0, 사람: 0, 되풀이: 0 }]));
  for (const t of 열린) {
    const s = 열린셈[직원of(t.agent, t.kind)];
    s.n++;
    if (t.status === "사람 대기") s.사람++;
    if (t.attempts >= 5 || t.escalated) s.되풀이++;
  }
  const 직원 = 직원들.map(([id, 이름]) => {
    const c = 셈[id];
    const o = 열린셈[id];
    const 활동 = c.성공 + c.실패;
    const 한일 = [
      id === "pm" && c.점검 ? `매시 점검 ${c.점검}번` : null,
      활동 ? `일 ${활동}건 · 실패 ${c.실패}건` : id === "pm" && c.점검 ? null : "어제 9시부터 한 일이 없습니다",
    ].filter(Boolean).join(" · ");
    const 지금 = [
      id === "repair" && 수리.kind !== "none" ? 수리.text : null,
      o.n ? `열린 일 ${o.n}건` : "열린 일이 없습니다",
      o.사람 ? `그중 ${o.사람}건은 원장님 손을 기다립니다` : null,
      o.되풀이 ? `${o.되풀이}건은 5번 이상 시도하고도 안 끝났습니다` : null,
      c.마지막 && !c.마지막.ok ? `마지막 일(${시각(c.마지막.at)})이 실패했습니다` : null,
    ].filter(Boolean).join(" · ");
    return { id, 이름, 한일, 성공: c.성공, 실패: c.실패, 지금 };
  });

  // ── 산출물 · 원장 할 일 · 다음
  const [p] = await q(
    `select count(*) filter (where created_at >= $1)::int 새초안,
            count(*) filter (where published and published_at >= $1)::int 발행,
            count(*) filter (where not published and not (coalesce(review_notes, '{}'::jsonb) ? '비공개이유'))::int 검토대기
       from academy.posts`, [시작]);
  const 색인 = 활동들.filter((a) => a.ok && (["announce", "crawl-push", "brand-defense", "gsc-submit"].includes(a.kind)
    || ["구글 색인 요청", "빙 주소 제출", "자동 작업 snapshot"].includes(a.action))).length;
  const 원장할일 = 열린.filter((t) => t.status === "사람 대기").length;
  // 학원 주 1편 자동 글(Step 43) — 감수 회차·자동 발행·못 냄을 사람 말 한 줄로. 표가 없으면 안 붙인다
  const 글줄 = await 글기록읽기(q, 1);
  const 산출물 = [`새 초안 ${p.새초안}편`, `발행 ${p.발행}편`, `색인 알림 ${색인}건`, ...(글줄 ? [글줄] : [])];
  const 다음 = [
    확인필요.length ? `확인 필요 ${확인필요.length}건을 먼저 봐 주세요` : null,
    원장할일 ? `「오늘 하실 일」 ${원장할일}건` : null,
    p.검토대기 ? `검토 대기 초안 ${p.검토대기}편 — 사실 확인 뒤 발행` : null,
    `다음 주간 초안: ${다음초안(now)}`,
  ].filter(Boolean);

  // ── 상태와 결론
  const 총 = 직원.reduce((n, s) => n + s.성공 + s.실패, 0);
  const 실패 = 직원.reduce((n, s) => n + s.실패, 0);
  const 멈춤 = 되풀이.length + 늦음.length;
  const status = 멈춤 ? "막힘" : 확인필요.length || 실패 ? "주의" : "정상";
  const conclusion = status === "막힘"
    ? `멈춘 일이 ${멈춤}건 있습니다. 확인 필요부터 봐 주세요.`
    : status === "주의"
      ? [실패 ? `어제 9시부터 일 ${총}건 중 ${실패}건이 실패했습니다.` : `어제 9시부터 일 ${총}건을 했습니다.`,
         확인필요.length ? `원장님이 보실 것은 ${확인필요.length}건입니다.` : ""].filter(Boolean).join(" ")
      : `어제 9시부터 일 ${총}건을 했고 실패는 없습니다.`;

  const AI답변 = await AI답변읽기(q, now).catch((e) => { console.log(`  ⚠ AI 답변 측정을 못 읽음 ${e.message}`); return []; });
  const 고객별 = await 고객줄읽기(q, now).catch((e) => { console.log(`  ⚠ 고객별 줄을 못 읽음 ${e.message}`); return []; });
  const 확장 = await 확장줄읽기(q, now).catch((e) => { console.log(`  ⚠ 확장 질문 줄을 못 읽음 ${e.message}`); return []; });

  return { day: 오늘, status, body: { status, conclusion, 직원, 확인필요, 원장할일, 산출물, 다음, AI답변, 고객별, ...(확장.length ? { 확장 } : {}), 기간: { 시작: 시작.toISOString(), 끝: now.toISOString() } } };
}

/**
 * 「확장 질문 n개 중 k개 불림」 고객마다 한 줄(Step 31 D40). 승인 20문항 밖이라 위 숫자(AI답변·고객별)와 따로 적는다.
 * 확장 질문이 있는 고객만 — 없으면 빈 목록이고 보고 모양은 Step 31 전과 같다
 */
async function 확장줄읽기(q, now = new Date()) {
  const 오늘 = kst(now).toISOString().slice(0, 10);
  const 질문 = await q(`select c.id, c.slug, c.name, 'q' || pq.position as prompt_id from geo.pilot_questions pq
                          join geo.pilots p on p.id = pq.pilot_id join geo.clients c on c.id = p.client_id
                         where pq.stage = 'extend' order by c.id, pq.position`);
  if (!질문.length) return [];
  // 표가 아직 없으면(운영 DB 2026-09-30) 잰 것이 없는 것 — 멈추지 않고 전부 「덜 잼」
  const [표] = await q(`select to_regclass('academy.ai_probe_measurements')::text as t`);
  const rows = !표?.t ? [] : await q(`select client_id, prompt_id, collection_method, mentioned, cited from academy.ai_probe_measurements
                         where measured_on >= $1::date - 6 and prompt_id = any($2::text[])`, [오늘, [...new Set(질문.map((x) => x.prompt_id))]]);
  const out = [];
  for (const id of [...new Set(질문.map((x) => x.id))]) {
    const mine = 질문.filter((x) => x.id === id);
    out.push({ slug: mine[0].slug, name: mine[0].name, 줄: 확장줄(mine, rows.filter((r) => r.client_id === id)) });
  }
  return out;
}

/**
 * 학원 밖 고객 한 줄씩(Step 30 D36). 위의 학원 숫자(AI답변·산출물)는 건드리지 않는다.
 *   AI 답변  곳(collection_method)마다 가장 최근 측정일 하루치 「n번 중 k번 이름 나옴」. 3일 넘게 안 잰 곳은 뺀다(AI답변읽기와 같은 셈)
 *   방문     어제까지 7일 방문자(geo.site_visits, Step 29). 표가 없으면 「방문 기록 없음」
 *   일감     완료·닫힘이 아닌 것과 그중 사람 대기(원장 몫)·세션 대기(세션 몫)
 */
const 더하기일 = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
async function 고객줄읽기(q, now = new Date()) {
  const 오늘 = kst(now).toISOString().slice(0, 10);
  const 고객들 = await q(`select id, slug, name from geo.clients where slug <> 'robotncoding' order by id`);
  const [표] = await q(`select to_regclass('geo.site_visits')::text as t`);
  const out = [];
  for (const c of 고객들) {
    const 측정 = (await q(
      `with d as (select collection_method m, max(measured_on) as day from academy.ai_measurements a
                   where client_id = $1 and measured_on > now() - interval '30 days' and coalesce(a.stage, '') <> 'brand' group by 1)
       select d.m, a.engine, d.day::text as day, count(*)::int n, count(*) filter (where a.mentioned)::int k
         from d join academy.ai_measurements a on a.client_id = $1 and a.collection_method = d.m and a.measured_on = d.day and a.attempt = 1
                and coalesce(a.stage, '') <> 'brand'
        group by 1, 2, 3 order by 1, 2`, [c.id]))
      .filter((r) => now.getTime() - Date.parse(`${r.day}T00:00:00+09:00`) <= 3 * 86400000);
    let AI;
    if (측정.length) {
      AI = `이름 안 넣은 질문 — ${측정.map((r) => `${엔진이름[r.engine] ?? r.engine} ${r.n}개 중 ${r.k}개에 이름 나옴(${월일(`${r.day}T00:00:00+09:00`)})`).join(" · ")}`;
    } else {
      const [승인] = await q(`select count(*) filter (where pq.approved)::int n from geo.pilot_questions pq
                               join geo.pilots p on p.id = pq.pilot_id where p.client_id = $1`, [c.id]);
      AI = 승인.n ? "AI 답변 최근 3일 측정 없음" : "AI 답변 측정 없음 — 승인된 질문 0개";
    }
    // 기록을 시작하기 전 날은 0 이 아니라 모르는 날이다 — 시작일이 창 안이면 그날부터라고 적는다
    const [v] = 표?.t
      ? await q(`select min(day)::text as since, count(distinct visitor) filter (where day between $2::date - 7 and $2::date - 1)::int n
                   from geo.site_visits where client_id = $1`, [c.id, 오늘])
      : [null];
    const 방문 = !v?.since ? "방문 기록 없음"
      : v.since >= 오늘 ? `방문 기록 ${월일(`${v.since}T00:00:00+09:00`)} 시작 — 어제까지 숫자 없음`
      : `방문자 ${v.n}명(${v.since > 더하기일(오늘, -7) ? `기록 시작 ${월일(`${v.since}T00:00:00+09:00`)}부터` : "7일"} 어제까지)`;
    // 밀린 일 — 고객 상태 칸(web/lib/client-status.ts)과 같은 상태 목록
    const [일] = await q(`select count(*)::int n, count(*) filter (where status = '사람 대기')::int h, count(*) filter (where status = '세션 대기')::int s
                          from geo.agent_tasks where client_id = $1 and status in ('사람 대기', '세션 대기', '로컬 대기', '수리 대기', '실패')`, [c.id]);
    out.push({
      slug: c.slug, name: c.name,
      줄: [AI, 방문, `밀린 일 ${일.n}건(원장님 ${일.h} · Claude 세션 ${일.s})`].join(" · "),
    });
  }
  return out;
}

/**
 * 엔진별 AI 답변 — 원장(2026-09-24) 「AI 질문도 여러 곳에 지속적으로 하고 리포팅」.
 * 방법(collection_method)마다 가장 최근 측정일과 그 전 측정일을 같은 문항끼리만 비교한다.
 * 방법이 다른 숫자는 합치지 않는다(ai-measure.mjs 규칙). 20문항 1회는 흔들림이 크다 — 이름 수 차이가 3 이하면 「비슷」으로 쓴다
 */
const 엔진이름 = { "claude-code-web": "Claude", "chatgpt-web": "ChatGPT", "perplexity-web": "Perplexity", "gemini-web": "Gemini" };
async function AI답변읽기(q, now = new Date()) {
  const rows = await q(
    `with d as (
       select collection_method m, engine, measured_on,
              dense_rank() over (partition by collection_method order by measured_on desc) r
         from academy.ai_measurements where client_id = 1 and measured_on > now() - interval '30 days' and coalesce(stage, '') <> 'brand'
        group by 1, 2, 3)
     select d.m, d.engine, d.r, d.measured_on::text as day,
            count(*)::int n, count(*) filter (where a.mentioned)::int 이름, count(*) filter (where a.cited)::int 인용,
            array_agg(a.prompt_id) ids
       from d join academy.ai_measurements a on a.collection_method = d.m and a.engine = d.engine and a.measured_on = d.measured_on and a.client_id = 1 and a.attempt = 1
                                    and coalesce(a.stage, '') <> 'brand'
      where d.r <= 2 group by 1, 2, 3, 4 order by 1, 3`);
  const out = [];
  for (const m of [...new Set(rows.map((r) => r.m))]) {
    // dense_rank 는 bigint 라 문자열로 온다
    const [지금, 전] = [rows.find((r) => r.m === m && Number(r.r) === 1), rows.find((r) => r.m === m && Number(r.r) === 2)];
    if (!지금 || 지금.n < 2) continue;   // 시험으로 한두 문항만 잰 날은 뺀다. 도중에 멈춘 날은 「일부」로 남긴다(Richard 21)
    if (now.getTime() - Date.parse(`${지금.day}T00:00:00+09:00`) > 3 * 86400000) continue;   // 매일 재니 3일 넘게 없으면 그만 쓴 방법(옛 API 측정)은 뺀다
    let 비교 = null;
    if (전) {
      const 공통 = 지금.ids.filter((x) => 전.ids.includes(x));
      if (공통.length >= 5) {
        const [a, b] = await Promise.all([지금, 전].map((x) => q(
          `select count(*) filter (where mentioned)::int 이름, count(*) filter (where cited)::int 인용 from academy.ai_measurements
            where client_id = 1 and collection_method = $1 and measured_on = $2 and prompt_id = any($3) and engine = $4 and attempt = 1
              and coalesce(stage, '') <> 'brand'`, [m, x.day, 공통, x.engine]).then((r) => r[0])));
        const d = a.이름 - b.이름;
        비교 = { day: 전.day, 공통: 공통.length, 전이름: b.이름, 지금이름: a.이름, 전인용: b.인용, 지금인용: a.인용,
          말: Math.abs(d) <= 3 ? "비슷" : d > 0 ? "늘었음" : "줄었음" };
      }
    }
    out.push({ 엔진: 엔진이름[지금.engine] ?? 지금.engine, day: 지금.day, n: 지금.n, 전체: 지금.n >= 18, 링크없음: 지금.engine === "gemini-web", 이름: 지금.이름, 인용: 지금.인용, 비교 });
  }
  return out;
}

/**
 * 회사 루프가 부르는 곳. 돌려주는 말 은 로그 한 줄.
 *   force  있어도 덮어쓴다   dry  저장하지 않고 보고만 돌려준다
 */
export async function PM보고(q, { force = false, dry = false, now = new Date() } = {}) {
  if (!dry) await 표만들기(q);
  const k = kst(now);
  const 오늘 = k.toISOString().slice(0, 10);
  if (!dry && !force) {
    if (k.getUTCHours() < 8) return { 말: "08시 전 — 만들지 않음" };
    const [있음] = await q(`select 1 from geo.pm_reports where day = $1`, [오늘]);
    if (있음) return { 말: "오늘 보고가 이미 있음" };
  }
  const r = await 보고짓기(q, now);
  if (dry) return { 말: `${r.day} ${r.status} (저장 안 함)`, 보고: r };
  const 넣음 = await q(
    `insert into geo.pm_reports (day, at, status, body) values ($1, now(), $2, $3::jsonb)
     on conflict (day) do ${force ? "update set at = now(), status = excluded.status, body = excluded.body" : "nothing"}
     returning day`, [r.day, r.status, JSON.stringify(r.body)]);
  return { 말: 넣음.length ? `${r.day} ${r.status} — ${r.body.conclusion}` : "다른 루프가 먼저 만듦", 보고: r };
}

// ─────────────────────────────── 직접 돌릴 때
const 직접 = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (직접) {
  const { Pool } = await import("pg");
  for (const l of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" } });
  const q = (s, p = []) => pool.query(s, p).then((r) => r.rows);
  try {
    const r = await PM보고(q, { force: process.argv.includes("--force"), dry: process.argv.includes("--dry") });
    console.log(r.말);
    if (r.보고) {
      const b = r.보고.body;
      console.log(`\n[${b.status}] ${r.보고.day} 아침 보고\n${b.conclusion}\n`);
      if (b.확인필요.length) console.log(`확인 필요\n${b.확인필요.map((s) => `  · ${s}`).join("\n")}\n`);
      console.log(`직원\n${b.직원.map((s) => `  ${s.이름.padEnd(4, "　")} ${s.한일} | ${s.지금}`).join("\n")}\n`);
      console.log(`원장 할 일 ${b.원장할일}건 · 산출물 ${b.산출물.join(" · ")}`);
      for (const a of b.AI답변 ?? []) console.log(`  AI ${a.엔진} ${a.day} 이름 ${a.이름}/${a.n} · 인용 ${a.인용}/${a.n}${a.비교 ? ` (${a.비교.day} 같은 ${a.비교.공통}문항 ${a.비교.전이름}→${a.비교.지금이름}, ${a.비교.말})` : ""}`);
      for (const c of b.고객별 ?? []) console.log(`  ${c.name}: ${c.줄}`);
      for (const c of b.확장 ?? []) console.log(`  ${c.name}: ${c.줄}`);
      console.log(`다음\n${b.다음.map((s) => `  · ${s}`).join("\n")}`);
      console.log(`\nbody = ${JSON.stringify(b)}`);
    }
  } catch (e) {
    console.log("아침 보고 실패:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
