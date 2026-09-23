import { plain, WORKFLOW_PLAIN } from "./agents";

/**
 * ① 오늘 원장님이 하실 일 — 일감 한 줄을 원장이 읽을 문장으로.
 *
 * 에이전트가 만든 일감(investigate·repair-approval·workflow-failed·감사/수리 human)은 제목이 로그 문장이다.
 * plain() 으로 깎으면 「의 major…」 같은 조각이 남는다(Richard 9/22) — 그래서 kind·payload 로 문장을 새로 만든다.
 * 숫자는 payload.facts 에서만 가져온다. 대응표에 없는 kind 는 plain() 원문을 어절 경계에서 자른다.
 * 데이터는 안 고친다. 보여 줄 때만.
 */

export type TodoTask = {
  agent: string;
  kind: string;
  title: string;
  detail: string;
  error: string;
  evidence: string;
  link: string | null;
  payload: Record<string, unknown> | null;
};

export type TodoAction =
  | { type: "link"; label: string; href: string }
  | { type: "finish" }
  | { type: "naver" }
  | { type: "details"; label: string; body: string };

export type TodoText = {
  title: string;
  why: string;
  action: TodoAction;
  /** 최근 조치가 근거에 적혀 있으면 「조치 중 · 9/22 …」 — 화면은 흐리게, 맨 뒤로 */
  doing: string | null;
};

const VENDOR: Record<string, [string, string]> = {
  // [이름, 주격]
  microsoft: ["빙", "빙이"], google: ["구글", "구글이"], naver: ["네이버", "네이버가"],
  openai: ["ChatGPT", "ChatGPT 가"], anthropic: ["Claude", "Claude 가"], perplexity: ["퍼플렉시티", "퍼플렉시티가"],
};

/** 감사 규칙 → 무엇이 문제인가 (audit.mjs 의 R1~R6) */
const RULE: Record<string, string> = {
  R1: "같은 일이 되풀이해 실패합니다",
  R2: "자동 측정이 멈췄습니다",
  R3: "완료로 닫혔는데 근거가 없는 일이 있습니다",
  R4: "AI 답변에서 우리 사이트 인용이 0에 머뭅니다",
  R6: "출근 기록만 있고 실제로 한 일이 없습니다",
};

/** 수리공이 적는 detail 문구 → 왜 원장 차례인가 (repair.mjs 의 사람 대기 분기) */
const REPAIR_WHY: [RegExp, string][] = [
  [/검토에서 떨어|검토 불합격/, "자동 수리안이 검토에서 떨어졌습니다 — Claude 세션에서 고칩니다"],
  [/가드에 걸/, "자동 수리안이 안전 검사에 걸렸습니다 — Claude 세션에서 고칩니다"],
  [/못 고친|못 고침/, "수리공이 못 고쳤습니다 — Claude 세션에서 고칩니다"],
  [/번 실패/, "자동 수리가 되풀이해 실패했습니다 — Claude 세션에서 고칩니다"],
  [/합치다 멈/, "자동 수리를 합치다 멈췄습니다 — 코드는 그대로입니다"],
  [/사람이 합칩니다/, "자동으로 못 합쳤습니다 — 사람이 합칩니다"],
  [/되돌/, "자동 수리를 되돌렸습니다 — 다시 볼 일입니다"],
  [/거절/, "원장님이 거절한 수리안입니다 — 조사를 닫을지 정합니다"],
  [/다시 열림/, "전에 고친 문제가 다시 생겼습니다"],
  [/고칠 수 없는 파일/, "수리공이 손댈 수 없는 파일입니다 — Claude 세션에서 고칩니다"],
  [/효과 없음|신호가 그대로/, "수리 뒤 7일 동안 그대로입니다"],
];

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** 어절 경계에서 자른다. 잘린 끝의 조사·쉼표는 버린다 */
export function cut(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  let x = t.slice(0, n);
  const sp = x.lastIndexOf(" ");
  if (sp > n * 0.5) x = x.slice(0, sp);
  x = x.replace(/[\s,·:—-]+$/, "");
  return `${x}…`;
}

/** 첫 줄의 첫 문장 */
function first(s: string): string {
  const line = s.split("\n").map((x) => x.trim()).find(Boolean) ?? "";
  const m = /^(.+?[.다요])(?:\s|$)/.exec(line);
  return m ? m[1] : line;
}

const localHref = (link: string) => link.replace(/^https:\/\/geo-rose-nine\.vercel\.app/, "");

function linkAction(link: string | null): TodoAction {
  if (!link) return { type: "finish" };
  const href = localHref(link);
  const label = href.startsWith("/admin/drafts") ? "읽고 발행하기"
    : href.startsWith("/admin/inquiry") ? "입력하기"
    : href.startsWith("/admin/outreach") ? "영업판 열기"
    : href.startsWith("/admin/material") ? "적기"
    : href.includes("smartplace.naver.com") ? "플레이스 열기"
    : "열기";
  return { type: "link", label, href };
}

/** 근거 마지막 줄이 최근(3일) 조치면 「조치 중 · 9/22 …」 */
function doingOf(evidence: string, now: number): string | null {
  const lines = evidence.split("\n").map((x) => x.trim()).filter(Boolean);
  const last = lines[lines.length - 1];
  if (!last) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: \d{2}:\d{2})? (.+)$/.exec(last);
  if (!m) return null;
  const when = Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00:00+09:00`);
  if (now - when > 3 * 86400000) return null;
  const text = m[4];
  if (!/(제출|알림 보냄|요청함|보냄|올림|넣음|등록함|고침|합침)/.test(text)) return null;
  if (/(실패|못 |불합격|거절|멈춤)/.test(text)) return null;
  return `조치 중 · ${Number(m[2])}/${m[3]} ${cut(plain(text), 40)}`;
}

export function todoText(t: TodoTask, now = Date.now()): TodoText {
  const p = obj(t.payload);
  const doing = doingOf(t.evidence ?? "", now);

  if (t.kind === "investigate") {
    const rule = String(p.rule ?? "");
    const f = obj(p.facts);
    let title = RULE[rule] ?? "자동 조사가 원장 확인을 기다립니다";
    if (rule === "R5") {
      const v = VENDOR[String(f.vendor ?? "")];
      const total = num(f.pages_total), got = num(f.pages_crawled);
      title = v && total !== null && got !== null
        ? `${v[1]} 우리 글 ${total}쪽 중 ${got}쪽만 읽었습니다`
        : `${v ? v[1] : "검색 로봇이"} 우리 글을 덜 읽습니다`;
    }
    const src = `${t.error} ${t.detail}`;
    // 수리공이 꺼져 있으면 조사 끝난 코드 문제가 여기로 온다. 원장이 읽고 판단할 일이 아니라 Claude 세션이 고칠 일이다
    const why = REPAIR_WHY.find(([re]) => re.test(src))?.[1] ?? "코드를 고쳐야 합니다 — Claude 세션을 열면 처리합니다";
    const 결론 = String(obj(p.diagnosis)["결론"] ?? "");
    const action: TodoAction = 결론 ? { type: "details", label: "조사 내용 보기", body: cut(plain(결론), 320) } : linkAction(t.link);
    return { title, why, action, doing };
  }

  if (t.kind === "repair-approval") {
    const what = plain(t.title.replace(/^자동 수리 승인 대기:\s*/, ""));
    return {
      title: "자동 수리안 — 합칠지 정해 주세요",
      why: what ? cut(what, 80) : "검토를 통과한 수리안입니다",
      action: t.link ? { type: "link", label: "보고 정하기", href: localHref(t.link) } : { type: "finish" },
      doing,
    };
  }

  if (t.kind === "workflow-failed") {
    const file = String(p.file ?? "").replace(/\.yml$/, "");
    const name = WORKFLOW_PLAIN[file] ?? "자동 작업";
    const url = typeof p.url === "string" ? p.url : t.link;
    return {
      title: `${name} 자동 실행이 실패했습니다`,
      why: "마지막 실행이 실패했습니다 — 로그를 봅니다",
      action: url ? { type: "link", label: "로그 보기", href: url } : { type: "finish" },
      doing,
    };
  }

  if (t.kind === "material") {
    // 재료가 마르면 자동 초안이 일반론이 된다. 원장이 버린 초안 3편이 전부 그랬다(2026-09-23)
    const unused = num(p.unused);
    const 멈춤 = num(p.빈손);
    return {
      title: 멈춤 !== null && 멈춤 >= 2 ? `글이 ${멈춤}주째 안 나갔습니다 — 글감 한 줄` : "이번 주 글감 한 줄 적기",
      why: unused === 0
        ? "상담·수업에서 들은 말 한 줄이면 됩니다. 남은 글감이 없어 이번 주 초안이 멈춰 있습니다"
        : `상담·수업에서 들은 말 한 줄이면 됩니다. 남은 글감 ${unused ?? "?"}개 — 3개 밑이면 초안이 뻔해집니다`,
      action: { type: "link", label: "적기", href: "/admin/material" },
      doing,
    };
  }

  if (t.kind === "naver-attempt") {
    return { title: cut(plain(t.title), 60), why: cut(plain(first(t.error || t.detail)), 90), action: { type: "naver" }, doing };
  }

  // 자주 오는 사람 일 — 로그 제목 대신 할 일을 문장으로
  if (t.link?.includes("/admin/inquiry")) {
    const n = /(\d+)건/.exec(t.title)?.[1];
    return {
      title: n ? `상담 ${n}건 — 등록했는지 적기` : "상담 결과 적기",
      why: "문의가 등록으로 이어졌는지는 이것으로만 압니다. 건마다 버튼 하나입니다",
      action: linkAction(t.link), doing,
    };
  }
  if (t.link?.includes("/admin/outreach")) {
    const m = /후보 (\d+)곳.*통화문 (\d+)곳/.exec(t.title);
    return {
      title: m ? `영업 전화 ${m[1]}곳 · 통화문 ${m[2]}곳 준비됨` : cut(plain(t.title), 60),
      why: "통화 뒤 영업판에 결과와 다음 연락일을 적으면 다음 주 목록에서 빠집니다",
      action: linkAction(t.link), doing,
    };
  }
  if (t.kind === "listing") {
    const query = typeof p.query === "string" ? p.query : "";
    return {
      title: query ? `「${query}」 검색에 올라가기` : cut(plain(t.title), 60),
      why: cut(plain(first(t.detail)), 90),
      action: linkAction(t.link), doing,
    };
  }

  // 그 밖 — 원문을 쉬운 말로 깎고 어절 경계에서 자른다
  return {
    title: cut(plain(t.title), 60),
    why: cut(plain(first(t.error || t.detail)), 90),
    action: linkAction(t.link),
    doing,
  };
}
