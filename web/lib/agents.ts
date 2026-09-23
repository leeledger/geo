import { pool } from "./ops";

/**
 * 에이전트 직원 — 지금. 현황판 ② 실시간 줄이 읽는 것.
 *
 * 원장(9/22): 「실시간으로 에이전트 직원들이 일을 잘 처리하고 있는지 보여야 해」.
 * 판정은 서버에서 한다. 못 읽으면 「확인 못함」 — 정상으로 칠하지 않는다.
 *
 * 직원은 회사 전체의 직원이다. 고객사마다 따로 있지 않다 — 그래서 고객사로 거르지 않는다.
 * (GitHub 실행 기록을 옮긴 줄은 첫 고객사 번호로 적혀서, 고객사로 거르면 아이로그 화면에선 전부 「지연」이 된다)
 *
 * 정해진 시각은 .github/workflows/*.yml 의 cron 을 KST 로 옮긴 상수다.
 * ★ yml 의 cron 을 바꾸면 여기도 바꾼다. 안 바꾸면 멀쩡한 직원이 「지연」으로 뜬다.
 */

/** 화면 글자는 AgentStrip 의 LABEL (클라이언트가 이 파일을 불러오면 pg 까지 딸려 간다 — 타입만 가져간다) */
export type AgentState = "unknown" | "off" | "stuck" | "late" | "wait" | "working" | "pcoff" | "idle" | "ok";

/** 활동 한 줄 (geo.agent_activity + 그 일감의 kind) */
export type Act = { agent: string; action: string; ok: boolean; summary: string; at: string; kind: string | null };
/** 안 끝난 일감 */
export type OpenTask = { agent: string; kind: string; status: string; title: string; updatedAt: string };

export type AgentRow = {
  id: string;
  name: string;
  state: AgentState;
  /** 상태의 이유. 정상이면 null — 화면은 이 직원이 하는 일(does)을 대신 보여 준다 */
  reason: string | null;
  /** 이 직원이 하는 일 한 줄. 로그를 깎은 글이 아니라 손으로 쓴 문장이다(2026-09-24 원장: 무슨 말인지 모르겠다) */
  does: string;
  last: { at: string; text: string; ok: boolean } | null;
  next: string | null;
  today: { ok: number; fail: number };
};

export type Agents = {
  ok: boolean;
  /** 서버가 읽은 시각(ISO). 화면의 「n분 전」 기준점과 「마지막 HH:MM」 */
  at: string;
  rows: AgentRow[];
  /** 오늘(KST) Claude 호출 수. cap 은 env CLAUDE_DAILY_MAX — 없으면 null 이고 화면은 상한을 안 쓴다 */
  claude: { n: number; cap: number | null } | null;
};

/**
 * 정해진 일 하나.
 * wf        GitHub 자동 작업 이름(yml 파일 이름). 회사 루프가 「자동 작업 {wf}」로 옮겨 적는다
 * self      그 일이 스스로 남기는 활동 (agent, action). 옮긴 줄과 둘 다 있으면 둘 중 하나만 있어도 「했다」
 * times     KST HH:MM. dow 가 있으면 그 요일만(0=일, 1=월)
 * hourly    매시 몇 분 — 시각 대신 「2시간 무소식」 하나로 판정
 * countMirror  옮긴 줄을 오늘 건수에 세는가. 스스로 활동을 적는 일은 안 센다(이중 계산) — 단 옮긴 줄이 실패면 실패로 센다
 * catchup   GitHub 이 예약을 건너뛰면 회사 루프가 2시간 뒤 대신 띄운다 (company.mjs 예약 표와 같은 목록)
 * pc        원장 PC 의 로컬 에이전트. 한 번 비면 회색 「PC 꺼짐」, 두 번 연속 비면 빨간 「지연」(Arch 결정 9/22 — 퇴근한 저녁마다 빨간 불이면 경보 피로)
 */
type Job = {
  name: string;
  wf?: string;
  self?: { agent: string; action?: string };
  times?: string[];
  dow?: number;
  hourly?: number;
  countMirror: boolean;
  catchup?: boolean;
  pc?: boolean;
};

type Role = { id: string; name: string; does: string; agents: string[]; jobs: Job[] };

/* yml 의 cron 을 바꾸면 여기도 — cron 은 UTC, 여기는 KST(+9) */
export const ROLES: Role[] = [
  {
    id: "ops", name: "운영", does: "매시 일을 나눠 맡기고, 건너뛴 예약과 실패한 작업을 다시 돌립니다", agents: ["ops", "audit"],
    jobs: [
      { name: "매시 점검", self: { agent: "ops", action: "회사 루프" }, hourly: 23, countMirror: false },            // company.yml  23 * * * *
      { name: "사이트 점검", wf: "watch", countMirror: true,                                                        // watch.yml    11 */3 * * *
        times: ["00:11", "03:11", "06:11", "09:11", "12:11", "15:11", "18:11", "21:11"] },
      { name: "감사", wf: "audit", self: { agent: "audit" }, times: ["06:35"], countMirror: false, catchup: true },                 // audit.yml    35 21 * * *
      { name: "문제 정찰", wf: "scout", times: ["06:37"], countMirror: true, catchup: true },                                       // scout.yml    37 21 * * *
    ],
  },
  {
    id: "repair", name: "수리공", does: "감사에서 나온 코드 문제를 고쳐 올립니다", agents: ["repair"],
    jobs: [{ name: "수리", wf: "repair", self: { agent: "repair" }, times: ["06:50"], countMirror: false }],        // repair.yml   50 21 * * *
  },
  {
    id: "measure", name: "측정", does: "매일 아침 AI 답변과 검색 순위를 잽니다", agents: ["measure", "improve"],
    jobs: [
      { name: "AI 답변 측정", wf: "optimize", times: ["07:05"], countMirror: true, catchup: true },                            // optimize.yml 5 22 * * *
      { name: "검색 순위 측정", wf: "serp", times: ["07:41"], countMirror: true, catchup: true },                                   // serp.yml     41 22 * * *
    ],
  },
  {
    id: "content", name: "콘텐츠", does: "월요일 아침 글감으로 초안을 씁니다", agents: ["content"],
    // 검토 일감은 회사 루프(매시)가 집어 간다 — 그건 운영 줄의 회사 루프로 본다
    jobs: [{ name: "주간 초안 작성", wf: "write", times: ["06:07"], dow: 1, countMirror: true, catchup: true }],                   // write.yml    7 21 * * 0 (월 06:07 KST)
  },
  {
    // 콘텐츠 활동 중 일감 kind 가 illustrate 인 것. 회사 루프가 집어 가고 하루 6회 상한 — 정해진 시각이 없다
    id: "illustrate", name: "삽화", does: "초안이 생기면 도해를 그립니다", agents: ["content"], jobs: [],
  },
  {
    id: "deliver", name: "유통", does: "새 글을 검색 엔진에 알리고 네이버 블로그로 옮깁니다", agents: ["deliver"],
    jobs: [
      { name: "색인 알림", wf: "snapshot", times: ["03:23"], countMirror: true, catchup: true },                                    // snapshot.yml 23 18 * * *
      // 원장 PC 의 로컬 에이전트. PC 가 꺼져 있으면 기록이 없다 — 그것도 알려야 할 일이다
      { name: "원장 PC 작업", self: { agent: "deliver", action: "로컬 에이전트 출근" }, times: ["12:40", "19:10"], countMirror: false, pc: true },
    ],
  },
  {
    id: "sales", name: "영업", does: "월요일 아침 전화할 곳과 통화문을 준비합니다", agents: ["sales"],
    jobs: [{ name: "영업 주간 정리", wf: "sales", self: { agent: "sales", action: "영업 주간" }, times: ["08:10"], dow: 1, countMirror: false }], // sales.yml 10 23 * * 0
  },
];

/** 회사 루프가 옮겨 적은 「자동 작업 X」를 사람 말로 */
export const WORKFLOW_PLAIN: Record<string, string> = {
  watch: "사이트 점검", scout: "문제 정찰", serp: "검색 순위 측정", snapshot: "색인 알림", write: "주간 초안 작성",
  optimize: "AI 답변 측정", audit: "감사", repair: "수리", sales: "영업 주간 정리", company: "매시 점검",
};

/** 옮겨 적기가 최대 1시간 늦다(회사 루프 매시 :23) + GitHub 예약 실행 자체가 늦게 뜨는 몫. 그래서 90분 */
export const LATE_GRACE_MIN = 90;
/** 매시 도는 회사 루프는 이만큼 조용하면 지연 */
export const HOURLY_SILENT_MIN = 120;
/** 「일하는 중」은 실행 중 일감이 이 안에 갱신됐을 때만. 그보다 오래면 멈춘 채 남은 표시일 수 있다 */
export const WORKING_FRESH_MIN = 30;

/* ─────────────────────────────── 쉬운 말 */

/** 엔진 표기 — 문자열 안에 무엇이 들었나로만 가른다. 방법(method) 이름은 쓰지 않는다 */
export function engineName(s: string): string {
  const t = s.toLowerCase();
  if (t.includes("claude")) return "Claude";
  if (/gpt|openai|chatgpt/.test(t)) return "ChatGPT";
  if (t.includes("perplexity")) return "퍼플렉시티";
  if (t.includes("gemini")) return "Gemini";
  return "AI";
}

/**
 * 화면에 내놓을 한 줄. 주소·경로·표 이름·해시·옵션·파일 이름을 지우고 엔진 키를 사람 이름으로.
 * 데이터는 안 고친다 — 보여 줄 때만.
 */
export function plain(s: string | null | undefined): string {
  let t = String(s ?? "");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t.replace(/\b([a-z]+)\.yml\b/gi, (_, w: string) => WORKFLOW_PLAIN[w.toLowerCase()] ?? "자동 작업");
  t = t.replace(/(^|[\s(])\/[^\s)]*/g, "$1");                          // /admin/outreach · /home/runner/...
  t = t.replace(/\b[a-z][\w-]*\/[\w/.:-]+/gi, "");                     // auto/fix-319 같은 가지·경로
  t = t.replace(/\bgeo\.\w+/g, "");
  t = t.replace(/\b[\w-]+\.(?:mjs|cjs|js|ts|tsx|json|sql)\b(?::\d+)?/gi, "");
  t = t.replace(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/gi, "");   // 커밋 해시
  t = t.replace(/(^|\s)--[\w-]+(?:=\S+)?/g, "$1");
  t = t.replace(/\bapi-[\w.-]+/gi, "AI");
  t = t.replace(/[\w.-]*openrouter[\w.-]*/gi, "AI");
  t = t.replace(/[\w.-]*(?:claude|anthropic)[\w.-]*/gi, "Claude");
  t = t.replace(/[\w.-]*(?:chatgpt|openai|gpt)[\w.-]*/gi, "ChatGPT");
  t = t.replace(/[\w.-]*perplexity[\w.-]*/gi, "퍼플렉시티");
  t = t.replace(/[\w.-]*gemini[\w.-]*/gi, "Gemini");
  t = t.replace(/microsoft(?=[^a-z]|$)/gi, "빙").replace(/빙를/g, "빙을").replace(/빙가/g, "빙이").replace(/빙는/g, "빙은").replace(/빙와/g, "빙과");
  t = t.replace(/\bvendor\b/gi, "");
  t = t.replace(/\bR\d+\b/g, "감사 규칙").replace(/영점/g, "0에 머묾");   // 감사 용어
  t = t.replace(/\s*\(?최고\s*\d+(?:\.\d+)?\s*%\)?/g, "");
  t = t.replace(/\s*\d+(?:\.\d+)?\s*%/g, "");
  // 지운 자리에 남은 외톨이 조사(「통화 뒤 에 결과」 「: 의 비교군」). 「이 학원」의 「이」처럼 낱말도 되는 것은 안 지운다
  t = t.replace(/(^|[\s:(])(?:의|에|를|을|으로|에서)(?=\s)/g, "$1");
  t = t.replace(/\(\s*\)/g, "").replace(/\s+([,)])/g, "$1").replace(/(·\s*){2,}/g, "· ").replace(/\s+/g, " ").trim();
  t = t.replace(/\bgoogle\b/gi, "구글").replace(/\bnaver\b/gi, "네이버").replace(/\bcrawl-push\b/g, "색인 재요청")
    .replace(/빙\(빙\)/g, "빙").replace(/빙는/g, "빙은").replace(/감사 규칙 감사 (?:신호|규칙)/g, "감사 규칙")
    .replace(/\(\s*→\s*/g, "(").replace(/감사 규칙와/g, "감사 규칙과").replace(/감사 규칙는/g, "감사 규칙은");
  return t.replace(/^[·—:\s-]+|[·—:\s-]+$/g, "");
}

const MIRROR = /^자동 작업 ([a-z]+)$/;

/**
 * 활동 한 줄을 사람 말로.
 * 옮긴 줄은 GitHub 실행이 끝났다는 뜻일 뿐이다 — 「수리 성공」처럼 일의 성과로 읽히게 쓰지 않는다(Richard 9/22).
 * 실패는 원인 원문을 빼고 「<일> 실패 — 로그 확인」. 원문은 자세히의 직원별 현황에만 있다.
 */
export function said(a: Act): string {
  const m = MIRROR.exec(a.action);
  if (m) return `${WORKFLOW_PLAIN[m[1]] ?? "자동 작업"} ${a.ok ? "끝남" : "실패"}`;
  const head = plain(a.action.replace(/^회사 루프$/, "매시 점검").replace(/^시험:\s*/, ""));
  if (!a.ok) return `${head} 실패`;
  const tail = plain(a.summary);
  return tail ? `${head} · ${tail}` : head;
}

/** 「감사가」「정찰이」 — 받침에 따라 */
const 이가 = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 === 0 ? `${w}가` : `${w}이`;
};

const isMirror = (a: Act) => MIRROR.test(a.action);

/* ─────────────────────────────── 역할 가르기 */

const JOB_BY_WF = new Map(ROLES.flatMap((r) => r.jobs.filter((j) => j.wf).map((j) => [j.wf!, { role: r.id, job: j }] as const)));

export function roleOfAct(a: Act): string | null {
  const m = MIRROR.exec(a.action);
  if (m) return JOB_BY_WF.get(m[1])?.role ?? null;   // 옮긴 줄은 agent 가 ops 로 적혀 있어도 이름으로 가른다
  return roleOfAgent(a.agent, a.kind);
}

function roleOfAgent(agent: string, kind: string | null): string | null {
  if (agent === "content") return kind === "illustrate" ? "illustrate" : "content";
  return ROLES.find((r) => r.id !== "illustrate" && r.agents.includes(agent))?.id ?? null;
}

/* ─────────────────────────────── KST 시각 */

const KST_MS = 9 * 3600 * 1000;
const kstDay = (t: number) => new Date(t + KST_MS).toISOString().slice(0, 10);
const kstHm = (t: number) => new Date(t + KST_MS).toISOString().slice(11, 16);
const dowOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const at = (day: string, hm: string) => Date.parse(`${day}T${hm}:00+09:00`);
const plusDays = (day: string, n: number) => kstDay(Date.parse(`${day}T12:00:00+09:00`) + n * 86400000);

type Slot = { t: number; label: string };
/**
 * 유예(90분)까지 지난 정해진 시각들, 최신이 앞. 오늘부터 8일 전까지 본다(요일 제한 반영) —
 * 오늘만 보면 어제 놓친 일이 자정 뒤에 「정상」으로 칠해지고, 월요일에 놓친 주 1회 일이 엿새 동안 정상이다(Richard 9/22).
 */
function dueSlots(j: Job, now: number): Slot[] {
  if (!j.times) return [];
  const today = kstDay(now);
  const out: Slot[] = [];
  for (let k = 0; k <= 8; k++) {
    const day = plusDays(today, -k);
    if (j.dow !== undefined && dowOf(day) !== j.dow) continue;
    for (const hm of j.times) {
      const t = at(day, hm);
      if (now - t >= LATE_GRACE_MIN * 60000) out.push({ t, label: day === today ? hm : `${Number(day.slice(5, 7))}/${day.slice(8, 10)} ${hm}` });
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

function nextSlot(jobs: Job[], now: number): number | null {
  let best: number | null = null;
  const keep = (t: number) => { if (t > now && (best === null || t < best)) best = t; };
  for (const j of jobs) {
    if (j.hourly !== undefined) {
      const h = Math.floor(now / 3600000) * 3600000 + j.hourly * 60000;   // KST 는 UTC+9 정시 차라 시 단위 내림이 같다
      keep(h > now ? h : h + 3600000);
      continue;
    }
    for (let k = 0; k <= 7; k++) {
      const day = plusDays(kstDay(now), k);
      if (j.dow !== undefined && dowOf(day) !== j.dow) continue;
      for (const hm of j.times ?? []) keep(at(day, hm));
    }
  }
  return best;
}

function fmtNext(t: number | null, now: number): string | null {
  if (t === null) return null;
  const d = kstDay(t), today = kstDay(now);
  if (d === today) return kstHm(t);
  if (d === plusDays(today, 1)) return `내일 ${kstHm(t)}`;
  return `${"일월화수목금토"[dowOf(d)]} ${kstHm(t)}`;
}

const matches = (j: Job, a: Act) =>
  (j.wf !== undefined && a.action === `자동 작업 ${j.wf}`) ||
  (j.self !== undefined && a.agent === j.self.agent && (j.self.action === undefined || a.action === j.self.action));

/* ─────────────────────────────── 판정 (순수 함수 — 시각을 받아서 node 로 시험한다) */

export type JudgeInput = {
  /** 이 역할의 활동, 최신이 앞 */
  acts: Act[];
  /** 이 역할의 안 끝난 일감 */
  tasks: OpenTask[];
  /** geo.settings repair_paused (수리공만 의미 있음) */
  paused?: boolean;
  /** 최근 7일 geo.repairs 에서 합친 수 (수리공만). null = 못 읽음 */
  merged7?: number | null;
  /** 다시 돌려도 실패해 사람 대기로 넘어간 GitHub 작업(company.mjs workflow-failed 일감 wf-<file>). 이것들엔 재시도를 약속하지 않는다 */
  gaveUp?: Set<string>;
};

const daysAgo = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / 86400000);

export function judge(role: Role, input: JudgeInput, now: number): AgentRow {
  const { acts, tasks } = input;
  // 수리공은 옮긴 줄(워크플로가 돌았다)로 판정하지 않는다 — 스위치가 꺼져도 워크플로는 「성공」한다
  const isRepair = role.id === "repair";
  const own = isRepair ? acts.filter((a) => !isMirror(a)) : acts;
  const shown = own[0] ?? null;
  const base = {
    id: role.id, name: role.name, does: role.does,
    last: shown ? { at: shown.at, text: said(shown), ok: shown.ok } : null,
    next: fmtNext(nextSlot(role.jobs, now), now),
    today: countToday(role, acts, now),
  };
  const row = (state: AgentState, reason: string | null): AgentRow => ({ ...base, state, reason });

  // 꺼짐 — 수리공 스위치. 켜는 건 원장님 (에이전트가 켜지 않는다)
  if (isRepair) {
    if (input.paused) {
      const why = own.find((a) => a.summary.startsWith("수리공 멈춤 — "));
      const text = why ? plain(why.summary.replace(/^수리공 멈춤 — /, "").replace(/\s*\(.*$/, "")) : "";
      return row("off", `멈춰 있습니다 — ${text || "사람이 풀 때까지"}`);
    }
    if (shown && shown.summary.startsWith("스위치 꺼짐")) return row("off", "꺼 두었습니다. 켜면 코드 문제를 스스로 고칩니다 — 켜는 건 원장님");
  }

  // 막힘 — 가장 최근 활동이 실패. 수리공의 「검토 불합격」은 검토 관문이 제 일을 한 것이라 막힘으로 안 친다
  const failing = isRepair ? acts.filter((a) => !(a.agent === "repair" && a.summary.includes("검토 불합격"))) : acts;
  const latest = failing[0] ?? null;
  if (latest && !latest.ok) {
    const d = daysAgo(latest.at, now);
    // 매시 점검이 새로 띄우는 것은 GitHub 작업 실패뿐이다(수리·영업 제외 — company.mjs workflow-failed). 나머지는 약속하지 않는다
    const wf = MIRROR.exec(latest.action)?.[1];
    const then = (wf === "repair" || wf === "sales") && input.gaveUp?.has(wf) ? "오늘 하실 일에 올렸습니다"
      : wf && input.gaveUp?.has(wf) ? "다시 돌려도 실패해 오늘 하실 일에 올렸습니다"
      : wf && wf !== "repair" && wf !== "sales" ? "매시 점검이 한 번 다시 돌립니다"
      : "로그는 맨 아래 「자세히」";
    return row("stuck", `${said(latest)}${d >= 1 ? ` (${d}일 전)` : ""} — ${then}`);
  }

  // 지연 — 유예가 지난 정해진 시각 뒤에 기록이 없다. 원장 PC 는 한 번은 회색, 두 번 연속이면 지연
  let pcMiss: string | null = null;
  for (const j of role.jobs) {
    if (j.hourly !== undefined) {
      const last = acts.find((a) => matches(j, a));
      if (!last || now - Date.parse(last.at) > HOURLY_SILENT_MIN * 60000) {
        return row("late", `${이가(j.name)} ${HOURLY_SILENT_MIN / 60}시간 넘게 안 돌았습니다`);
      }
      continue;
    }
    const due = dueSlots(j, now);
    if (!due.length) continue;
    const doneSince = (t: number) => acts.some((a) => matches(j, a) && Date.parse(a.at) >= t);
    if (doneSince(due[0].t)) continue;
    if (j.pc) {
      if (due[1] && !doneSince(due[1].t)) return row("late", `원장 PC 가 ${due[1].label}·${due[0].label} 두 번 안 켜져 있었습니다 — 네이버 이관·구글 색인 요청이 밀립니다`);
      pcMiss = `원장 PC 가 ${due[0].label} 에 꺼져 있었습니다 — 다음 시각에 합니다`;
      continue;
    }
    return row("late", j.catchup
      ? `${due[0].label} ${이가(j.name)} 안 돌았습니다 — 2시간이 지나도 안 뜨면 매시 점검이 대신 돌립니다`
      : `${due[0].label} ${이가(j.name)} 안 돌았습니다`);
  }

  // 일하는 중
  const run = tasks.find((t) => t.status === "실행 중" && now - Date.parse(t.updatedAt) <= WORKING_FRESH_MIN * 60000);
  if (run) return row("working", plain(run.title));

  // 원장님 차례 — 이 직원 일감 중 사람이 해야 넘어가는 것
  const human = tasks.filter((t) => t.status === "사람 대기").length;
  if (human) return row("wait", `원장님 확인 ${human}건을 기다립니다`);

  if (pcMiss) return row("pcoff", pcMiss);

  // 수리공 — 최근 7일 합친 수리가 없으면 「정상」이 아니다
  if (isRepair && input.merged7 === 0) return row("idle", "최근 7일 고친 것이 없습니다");

  // 쉬는 중 — 정해진 시각이 없는 역할만
  if (!role.jobs.length) {
    const recent = shown && now - Date.parse(shown.at) <= 24 * 3600000;
    const open = tasks.some((t) => t.status !== "완료" && t.status !== "닫힘");
    if (!recent && !open) return row("idle", "지금은 할 일이 없습니다");
  }

  return row("ok", null);
}

function countToday(role: Role, acts: Act[], now: number) {
  const today = kstDay(now);
  let ok = 0, fail = 0;
  for (const a of acts) {
    if (kstDay(Date.parse(a.at)) !== today) continue;
    const m = MIRROR.exec(a.action);
    if (m) {
      const j = JOB_BY_WF.get(m[1])?.job;
      if (!j) continue;
      if (!j.countMirror) { if (!a.ok) fail++; continue; }   // 스스로 적는 일 — 옮긴 줄은 실패만
    }
    if (a.ok) ok++; else fail++;
  }
  return { ok, fail };
}

/* ─────────────────────────────── 읽기 */

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

function claudeCap(): number | null {
  const n = Number(process.env.CLAUDE_DAILY_MAX);
  return Number.isInteger(n) && n > 0 ? n : null;   // 없으면 상한을 지어내지 않는다
}

export async function readAgents(now = Date.now()): Promise<Agents> {
  const stamp = new Date(now).toISOString();
  // 오류 원문은 서버 로그에만 — 응답·화면에는 「상태를 못 읽었습니다」만 (내부 이름이 샌다)
  const unknown = (): Agents => ({
    ok: false, at: stamp, claude: null,
    rows: ROLES.map((r) => ({ id: r.id, name: r.name, does: r.does, state: "unknown", reason: "상태를 못 읽었습니다", last: null, next: null, today: { ok: 0, fail: 0 } })),
  });
  try {
    const p = pool();
    // 10일 — 주 1회 일(월요일 초안·영업)의 마지막 활동까지 덮는다
    const { rows: ar } = await p.query(
      `select a.agent, a.action, a.ok, coalesce(a.summary, '') as summary, a.at, t.kind
         from geo.agent_activity a left join geo.agent_tasks t on t.id = a.task_id
        where a.at > now() - interval '10 days'
        order by a.at desc`);
    const { rows: tr } = await p.query(
      `select agent, kind, status, title, updated_at from geo.agent_tasks where status not in ('완료', '닫힘')`);
    const { rows: sr } = await p.query(`select value from geo.settings where key = 'repair_paused'`);
    let claude: Agents["claude"] = null;
    try {
      const { rows: [c] } = await p.query(
        `select count(*)::int as n from geo.claude_calls
          where (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`);
      claude = { n: c.n, cap: claudeCap() };
    } catch (e) { console.error("claude_calls 읽기 실패", e); }

    const acts: Act[] = ar.map((r) => ({ agent: r.agent, action: r.action, ok: !!r.ok, summary: r.summary, at: iso(r.at), kind: r.kind ?? null }));
    const tasks: OpenTask[] = tr.map((r) => ({ agent: r.agent, kind: r.kind, status: r.status, title: r.title, updatedAt: iso(r.updated_at) }));
    const paused = sr[0]?.value === "true";
    const gaveUp = new Set<string>();
    try {
      const { rows: gr } = await p.query(
        `select payload->>'file' as file from geo.agent_tasks where kind = 'workflow-failed' and status = '사람 대기'`);
      for (const g of gr) if (g.file) gaveUp.add(String(g.file).replace(/[.]yml$/, ""));
    } catch (e) { console.error("workflow-failed 읽기 실패", e); }
    let merged7: number | null = null;
    try {
      const { rows: [m] } = await p.query(
        `select count(*)::int as n from geo.repairs
          where (status = '합침' or merged_at is not null) and coalesce(merged_at, updated_at) > now() - interval '7 days'`);
      merged7 = m.n;
    } catch (e) { console.error("repairs 읽기 실패", e); }

    return {
      ok: true, at: stamp, claude,
      rows: ROLES.map((r) => judge(r, {
        acts: acts.filter((a) => roleOfAct(a) === r.id),
        tasks: tasks.filter((t) => roleOfAgent(t.agent, t.kind) === r.id),
        paused: r.id === "repair" ? paused : false,
        merged7: r.id === "repair" ? merged7 : null,
        gaveUp,
      }, now)),
    };
  } catch (e) {
    console.error("에이전트 상태 읽기 실패", e);
    return unknown();
  }
}
