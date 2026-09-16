import type { Ops } from "@/lib/ops";
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
  ];
  const agents = roles.map((a) => d.ok ? a : {
    ...a, status: "unknown" as Status, headline: "데이터를 읽지 못했습니다",
    reason: "최근 상태와 성과를 확인할 수 없습니다. 0건이나 정상 상태로 표시하지 않습니다.",
    next: "데이터 연결을 확인한 뒤 다시 조회합니다.", last: null, metric: "—",
  });
  const attention = agents.filter((a) => a.status === "attention" || a.status === "review");
  return (
    <section className="staff-board" aria-labelledby="staff-title">
      <div className="staff-heading">
        <div><p className="staff-eyebrow">TEAM OVERVIEW</p><h2 id="staff-title">직원별 업무 현황</h2><p>{clientName} · 기록을 바탕으로 정리한 상태</p></div>
        <span className="staff-refresh">5분마다 갱신 · 한국 시각</span>
      </div>
      <div className="staff-summary">
        <div><span className="staff-summary-label">지금 살펴볼 일</span><strong>{!d.ok ? "상태를 확인할 수 없습니다" : attention.length ? `${attention.length}개 담당 업무에 확인할 일이 있습니다` : "담당별 기록을 확인했습니다"}</strong><p>카드에서 확인한 사실과 다음 행동을 함께 읽어 주세요.</p>{d.ok && attention.length > 0 && <nav className="staff-priorities" aria-label="확인할 담당 업무">{attention.map((a) => <a key={a.id} href={`#staff-${a.id}`}>{a.name} 확인 ↓</a>)}</nav>}</div>
        <div className="staff-count"><b>{d.ok ? attention.length : "—"}</b><span>확인·검토</span></div>
        <div className="staff-count"><b>{d.ok ? agents.filter((a) => a.status === "recorded").length : "—"}</b><span>기록 확인</span></div>
      </div>
      <p className="staff-caveat">실시간 실행 로그는 아직 연결되지 않았습니다. 아래 상태는 작업 중 여부가 아닌, 저장된 기록과 확인할 일을 뜻합니다.</p>
      <div className="staff-grid">
        {agents.map((a) => (
          <article key={a.id} className={`staff-card ${a.status}`} id={`staff-${a.id}`}>
            <header><span className={`staff-avatar avatar-${a.id}`} aria-hidden="true">{a.initials}</span><div><h3>{a.name}</h3><span className="staff-mode">{a.mode}</span></div><span className={`staff-status ${a.status}`}>{LABEL[a.status]}</span></header>
            <p className="staff-role">{a.role}</p>
            <div className="staff-finding"><h4>{a.headline}</h4><p>{a.reason}</p></div>
            <div className="staff-action"><span>다음 행동</span><p>{a.next}</p></div>
            <div className="staff-evidence"><div><span>{a.lastLabel}</span><time>{d.ok ? stamp(a.last) : "확인 불가"}</time></div><div><span>{a.metricLabel}</span><strong>{a.metric}</strong></div></div>
            <details><summary>담당 업무 보기</summary><p>{a.jobs}</p></details>
          </article>
        ))}
      </div>
    </section>
  );
}
