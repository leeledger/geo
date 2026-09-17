import type { Ops } from "@/lib/ops";
import { finishTask } from "@/lib/task-actions";
import "./agent-board.css";

type Status = "attention" | "review" | "recorded" | "unknown";
const LABEL: Record<Status, string> = {
  attention: "확인 필요", review: "검토할 일 있음", recorded: "기록 확인", unknown: "확인 불가",
};
const stamp = (value: string | null) => value
  ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
  : "기록 없음";

export default function AgentBoard({ data: d, clientName }: { data: Ops; clientName: string }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const measurementOld = !d.serp.day || d.serp.day.slice(0, 10) !== today;
  const roles: {
    id: string; name: string; initials: string; role: string; mode: string;
    status: Status; headline: string; reason: string; next: string;
    last: string | null; lastLabel: string; metric: string; metricLabel: string; jobs: string;
  }[] = [
    {
      id: "improve", name: "개선 담당", initials: "개", role: "AI 답변에서 안 불린 질문을 골라 행동하고 효과를 잽니다", mode: "매일 07:05 GitHub 자동 실행",
      status: !d.agentLoop.day ? "review" : d.agentLoop.day !== today || d.agentLoop.status === "실패" || d.agentLoop.status === "사람 대기" ? "attention" : "recorded",
      headline: !d.agentLoop.day ? "개선 실행 기록이 없습니다"
        : d.agentLoop.day !== today ? `오늘 실행 기록이 없습니다 (마지막 ${d.agentLoop.day})`
        : d.agentLoop.status === "실패" ? "오늘 루프가 실패했습니다"
        : d.agentLoop.status === "사람 대기" ? "사람이 할 일에서 막혀 있습니다"
        : "오늘 행동을 실행했습니다",
      reason: d.agentLoop.diagnosis + (d.agentLoop.evidence ? ` · 근거: ${d.agentLoop.evidence}` : ""),
      next: d.agentLoop.action,
      last: d.agentLoop.startedAt, lastLabel: "마지막 실행",
      metric: d.agentLoop.engines || d.agentLoop.status, metricLabel: d.agentLoop.engines ? "그날 자동 측정 적중 (API · 소비자 화면 아님)" : "실행 상태",
      jobs: "AI 질문 20개 자동 측정 → 지난 행동 효과 판정 → 질문 하나 고르기 → 색인 알림·초안 작성·경쟁 출처 분석 → 원장 기록. 발행은 사람이 합니다. 최근 기록: " +
        (d.agentLoop.history.map((h) => `${h.day} ${h.kind ?? "-"} ${h.status}${h.verdict !== "판정 전" ? ` → ${h.verdict}${h.note ? ` (${h.note})` : ""}` : ""}`).join(" / ") || "없음"),
    },
    {
      id: "ops", name: "운영 담당", initials: "운", role: "전체 흐름을 살피고 우선순위를 정합니다", mode: "3시간마다 자동 점검",
      status: d.serp.brandLost.length ? "attention" : d.crawl.last24h === 0 ? "review" : "recorded",
      headline: d.serp.brandLost.length ? "브랜드 검색 결과 확인이 필요합니다" : d.crawl.last24h === 0 ? "최근 크롤러 기록을 확인할 차례입니다" : "최근 수집 기록을 확인했습니다",
      reason: d.serp.brandLost.length ? `최근 측정에서 미노출: ${d.serp.brandLost.join(" · ")}` : `최근 24시간 크롤러 방문 ${d.crawl.last24h.toLocaleString("ko-KR")}회. 방문 기록은 점검 작업의 실행 여부와 별개입니다.`,
      next: d.serp.brandLost.length ? "검색 결과와 브랜드 식별 기준을 대조해 원인을 조사합니다." : d.crawl.last24h === 0 ? "사이트 응답과 수집 장치부터 확인합니다. 방문 부재만으로 장애를 단정하지 않습니다." : "다음 점검에서 수집·발행·측정 기록의 변화를 확인합니다.",
      last: d.lastAt.next, lastLabel: "마지막 조치 기록", metric: String(d.crawl.last24h), metricLabel: "24시간 크롤러 방문", jobs: "상태 점검 · 브리핑 · 문제 우선순위 · 후속 확인",
    },
    {
      id: "measure", name: "측정 담당", initials: "측", role: "검색 노출과 변화의 근거를 남깁니다", mode: "매일 07:41 자동 측정",
      status: measurementOld ? "review" : "recorded",
      headline: measurementOld ? "오늘 측정 기록이 아직 없습니다" : "오늘 검색 노출을 측정했습니다",
      reason: d.serp.day ? `최근 측정일 ${d.serp.day.slice(0, 10)} · 경쟁 검색어 ${d.serp.rivalTotal}개 중 ${d.serp.rivalWon}개에서 노출됐습니다.` : "측정 기록이 없어 현재 노출을 판단할 수 없습니다.",
      next: measurementOld ? "예정 시각과 측정 실행 결과를 확인합니다. 아직 예정 전이면 기다립니다." : d.serp.rivalWon === 0 ? "경쟁 검색어의 실제 검색 결과를 조사해 개선할 지면을 찾습니다." : "노출된 질문과 미노출 질문을 비교해 다음 개선 대상을 정합니다.",
      last: d.lastAt.measure, lastLabel: "마지막 노출 측정", metric: `${d.serp.rivalWon} / ${d.serp.rivalTotal}`, metricLabel: "노출된 경쟁 검색어", jobs: "검색 노출 측정 · 크롤러 분석 · 사이트 진단 · 결과 비교",
    },
    {
      id: "content", name: "콘텐츠 담당", initials: "콘", role: "고객의 질문에 답하는 글을 만듭니다", mode: "주간 초안 자동 · 발행 전 검토",
      status: d.posts.draft > 0 ? "review" : d.posts.sinceDays === null || d.posts.sinceDays > 7 ? "review" : "recorded",
      headline: d.posts.draft > 0 ? `검토할 초안 ${d.posts.draft}편이 있습니다` : d.posts.sinceDays === null ? "발행 기록이 없습니다" : `마지막 발행은 ${d.posts.sinceDays}일 전입니다`,
      reason: d.posts.draft > 0 ? "초안 수는 저장된 미발행 글 기준입니다. 사실 확인과 발행 여부를 검토해야 합니다." : "발행 주기는 고객사의 콘텐츠 운영 범위와 함께 판단합니다.",
      next: d.posts.draft > 0 ? "초안의 근거와 표현을 확인하고, 검토가 끝난 글의 발행을 준비합니다." : "콘텐츠 계약 범위를 확인하고 다음 질문과 주제를 선정합니다.",
      last: d.lastAt.content, lastLabel: "마지막 사이트 발행", metric: String(d.posts.draft), metricLabel: "검토할 초안", jobs: "주제 선정 · 근거 조사 · 집필 · 도해 · 발행 전 사실 확인",
    },
    {
      id: "deliver", name: "유통 담당", initials: "유", role: "발행한 글이 발견되도록 연결합니다", mode: "색인 알림 자동 · 이관은 로그인 필요",
      status: d.lastAt.deliver ? "recorded" : "review",
      headline: d.lastAt.deliver ? "네이버 이관 기록이 있습니다" : "네이버 이관 기록을 확인해 주세요",
      reason: d.lastAt.deliver ? "이관 기록과 검색 색인 완료는 서로 다른 단계입니다." : "기록이 없다고 실패한 것은 아닙니다. 고객사의 네이버 운영 범위부터 확인합니다.",
      next: "유통 대상 글과 이관 여부를 대조합니다. 구글 요청·네이버 이관에는 로그인 세션이 필요합니다.",
      last: d.lastAt.deliver, lastLabel: "마지막 네이버 이관", metric: String(d.posts.published), metricLabel: "사이트 발행 글 · 이관 수 아님", jobs: "IndexNow 알림 · 구글 색인 요청 · 네이버 이관 · 반영 확인",
    },
    {
      id: "sales", name: "성과 담당", initials: "성", role: "진단을 상담으로, 상담을 등록·계약 결과로 닫습니다", mode: "대시보드 열 때 미완료 결과 확인",
      status: d.sales.newLeads > 0 || d.sales.unresolvedInquiries > 0 ? "attention" : d.sales.scans30d > 0 && d.sales.leads30d === 0 ? "review" : "recorded",
      headline: d.sales.unresolvedInquiries > 0 ? `결과가 비어 있는 상담 ${d.sales.unresolvedInquiries}건이 있습니다` : d.sales.newLeads > 0 ? `아직 처리하지 않은 리드 ${d.sales.newLeads}건이 있습니다` : d.sales.scans30d > 0 && d.sales.leads30d === 0 ? "무료 진단이 상담으로 이어지지 않았습니다" : "문의 결과 기록을 확인했습니다",
      reason: `최근 30일 무료 진단 ${d.sales.scans30d}건 · 리드 ${d.sales.leads30d}건 · 전환 ${d.sales.scanToLeadPct}%입니다. 상담 결과 미입력은 ${d.sales.unresolvedInquiries}건입니다.`,
      next: d.sales.unresolvedInquiries > 0 ? "문의 기록에서 등록·미등록 결과를 확인해 업무를 닫습니다." : d.sales.newLeads > 0 ? "리드 큐에서 연락 여부와 상담 가능성을 기록합니다." : d.sales.leads30d === 0 ? "무료 진단 결과의 제안 문구와 입력 마찰을 바꾸고 30일 전환율을 다시 봅니다." : "유입 경로별 계약 전환을 비교해 다음 영업 대상을 정합니다.",
      last: null, lastLabel: "미처리 리드", metric: String(d.sales.newLeads), metricLabel: "지금 처리할 리드", jobs: "무료 진단 전환 · 리드 후속 · 문의 유입 확인 · 등록·계약 결과 기록",
    },
  ];
  /**
   * 회사 루프의 실제 일감·활동을 카드에 덮어 쓴다.
   * 전에는 숫자를 보고 문장만 골랐다 — 그 문장을 실행하는 곳이 없어서 원장이 「왜 자동으로 안 하냐」고 물었다.
   * 이제 카드는 「일감 표에 무엇이 있고, 마지막으로 실제로 무엇을 했나」를 보여 준다.
   */
  const W = d.company;
  const hoursAgo = (s: string) => (Date.now() - new Date(s).getTime()) / 3600000;
  const lastLine = (s: string) => s.trim().split("\n").filter(Boolean).at(-1) ?? "";
  const withWork = roles.map((a) => {
    if (!W.ok) return { ...a, queue: null as null | { run: number; wait: number; human: number; local: number; watch: number }, acts: [] as typeof W.activity };
    const ts = W.tasks.filter((t) => t.agent === a.id && t.status !== "완료" && t.status !== "닫힘");
    const acts = W.activity.filter((x) => x.agent === a.id);
    const act = acts[0];
    const by = (s: string) => ts.filter((t) => t.status === s);
    const run = by("실행 중")[0], fail = by("실패"), wait = by("대기"), human = by("사람 대기"), local = by("로컬 대기"), watch = by("관찰");
    const queue = { run: by("실행 중").length, wait: wait.length + fail.length, human: human.length, local: local.length, watch: watch.length };
    const top = run ?? fail[0] ?? human[0] ?? wait[0] ?? local[0] ?? watch[0];
    const recent = act && hoursAgo(act.at) < 26;
    if (a.id === "improve") {
      return { ...a, queue, acts, last: act?.at ?? a.last, lastLabel: act ? `마지막 실제 활동 (${act.ok ? "성공" : "실패"})` : a.lastLabel };
    }
    return {
      ...a, queue, acts,
      status: (human.length || fail.length ? "attention" : recent || watch.length || wait.length ? "recorded" : "review") as Status,
      headline: run ? `일하는 중: ${run.title}`
        : fail.length ? `재시도 대기: ${fail[0].title}`
        : human.length ? `원장님 확인 ${human.length}건: ${human[0].title}`
        : wait.length ? `다음 일 ${wait.length}건: ${wait[0].title}`
        : local.length ? `PC 에서 할 일 ${local.length}건: ${local[0].title}`
        : act ? `최근 한 일: ${act.action}` : "아직 실행 기록이 없습니다",
      reason: top ? (lastLine(top.evidence) || top.detail) : act ? act.summary : a.reason,
      next: !top ? (act ? "새 신호가 생기면 매시 23분 회사 루프가 일감을 만듭니다." : a.next)
        : top.status === "사람 대기" ? `원장님 할 일 — ${top.error || top.detail}`
        : top.status === "로컬 대기" ? "원장 PC 의 로컬 에이전트가 12:40·19:10 에 처리합니다 (PC 가 켜져 있어야 합니다)."
        : top.status === "관찰" ? `조치를 끝내고 효과를 기다리는 중 · 다음 확인 후 필요하면 다시 합니다.`
        : "매시 23분 회사 루프가 집어 갑니다.",
      last: act?.at ?? null, lastLabel: act ? `마지막 실제 활동 (${act.ok ? "성공" : "실패"})` : "실제 활동 기록 없음",
    };
  });
  const agents = withWork.map((a) => d.ok ? a : {
    ...a, status: "unknown" as Status, headline: "데이터를 읽지 못했습니다",
    reason: "최근 상태와 성과를 확인할 수 없습니다. 0건이나 정상 상태로 표시하지 않습니다.",
    next: "데이터 연결을 확인한 뒤 다시 조회합니다.", last: null, metric: "—",
  });
  const attention = agents.filter((a) => a.status === "attention" || a.status === "review");
  const humanTasks = W.tasks.filter((t) => t.status === "사람 대기");
  const localTasks = W.tasks.filter((t) => t.status === "로컬 대기");
  const working = W.tasks.filter((t) => t.status === "실행 중" || t.status === "대기" || t.status === "실패").length;
  const NAME: Record<string, string> = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  return (
    <section className="staff-board" aria-labelledby="staff-title">
      <div className="staff-heading">
        <div><p className="staff-eyebrow">TEAM OVERVIEW</p><h2 id="staff-title">직원별 업무 현황</h2><p>{clientName} · 일감 표와 실제 활동 기록</p></div>
        <span className="staff-refresh">5분마다 갱신 · 한국 시각</span>
      </div>
      <div className="staff-summary">
        <div><span className="staff-summary-label">지금 살펴볼 일</span><strong>{!d.ok ? "상태를 확인할 수 없습니다" : humanTasks.length ? `원장님이 하실 일 ${humanTasks.length}건` : attention.length ? `${attention.length}개 담당 업무에 확인할 일이 있습니다` : "에이전트들이 스스로 처리 중입니다"}</strong><p>{W.ok ? `자동으로 처리할 일감 ${working}건 · PC 에서 할 일 ${localTasks.length}건` : "회사 루프 기록을 아직 읽지 못했습니다."}</p>{d.ok && attention.length > 0 && <nav className="staff-priorities" aria-label="확인할 담당 업무">{attention.map((a) => <a key={a.id} href={`#staff-${a.id}`}>{a.name} 확인 ↓</a>)}</nav>}</div>
        <div className="staff-count"><b>{d.ok ? humanTasks.length : "—"}</b><span>원장님 할 일</span></div>
        <div className="staff-count"><b>{d.ok && W.ok ? working : "—"}</b><span>자동 처리 중</span></div>
      </div>

      {W.ok && humanTasks.length > 0 && (
        <div className="staff-todo" aria-label="원장님이 하실 일">
          <h3>원장님이 하실 일</h3>
          <ol>
            {humanTasks.map((t) => (
              <li key={t.id}>
                <div><b>{t.title}</b><span>{NAME[t.agent] ?? t.agent} · {t.error || t.detail}</span></div>
                {t.link ? <a href={t.link.replace(/^https:\/\/geo-rose-nine\.vercel\.app/, "")}>{t.link.includes("/admin/drafts") ? "읽고 발행하기" : "열기"} →</a>
                  : <form action={finishTask}><input type="hidden" name="id" value={t.id} /><button type="submit" className="staff-done">했어요</button></form>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="staff-caveat">카드는 일감 표(geo.agent_tasks)와 실제 활동 기록(geo.agent_activity)을 읽습니다. 회사 루프는 매시 23분, 개선 루프는 매일 07:05, 로그인이 필요한 일은 원장 PC 에서 12:40·19:10 에 돕니다.</p>
      <div className="staff-grid">
        {agents.map((a) => (
          <article key={a.id} className={`staff-card ${a.status}`} id={`staff-${a.id}`}>
            <header><span className={`staff-avatar avatar-${a.id}`} aria-hidden="true">{a.initials}</span><div><h3>{a.name}</h3><span className="staff-mode">{a.mode}</span></div><span className={`staff-status ${a.status}`}>{LABEL[a.status]}</span></header>
            <p className="staff-role">{a.role}</p>
            <div className="staff-finding"><h4>{a.headline}</h4><p>{a.reason}</p></div>
            <div className="staff-action"><span>다음 행동</span><p>{a.next}</p></div>
            {a.queue && <div className="staff-queue"><span>자동 대기 <b>{a.queue.wait + a.queue.run}</b></span><span>관찰 <b>{a.queue.watch}</b></span><span>원장님 <b>{a.queue.human}</b></span><span>PC <b>{a.queue.local}</b></span></div>}
            <div className="staff-evidence"><div><span>{a.lastLabel}</span><time>{d.ok ? stamp(a.last) : "확인 불가"}</time></div><div><span>{a.metricLabel}</span><strong>{a.metric}</strong></div></div>
            <details><summary>최근 활동 · 담당 업무</summary>
              {a.acts.length > 0 && <ul className="staff-acts">{a.acts.slice(0, 6).map((x, i) => <li key={i} className={x.ok ? "" : "bad"}><time>{stamp(x.at)}</time> {x.action}{x.summary ? ` — ${x.summary}` : ""}{x.runUrl?.startsWith("http") && <> · <a href={x.runUrl} target="_blank" rel="noreferrer">로그</a></>}</li>)}</ul>}
              <p>{a.jobs}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
