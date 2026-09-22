import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/admin-auth";
import { listOutreach, OUTREACH_STATUSES, type OutreachTarget } from "@/lib/outreach";
import { updateOutreach } from "@/lib/outreach-actions";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HERE = "/admin/outreach";

/**
 * 첫 고객 영업판. 맨 위는 「오늘 할 일 — 위에서 3곳」, 나머지 후보는 자세히.
 * 공개 정보는 후보 선정용이다. 세 조건을 통화로 확인한 곳에만 파일럿을 제안한다.
 */

const yn = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "unknown");
const qualifies = (t: OutreachTarget) => t.ownerConsults === true && t.monthlyInquiries5plus === true && t.singleLocation === true;

const CSS = `
.out-list{display:grid;gap:10px}
.out-card .top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.out-card .rank{font-size:14px;color:var(--acc);margin-right:6px}
.out-flag{font-size:14px;padding:2px 10px;border:1px solid var(--line);border-radius:999px;color:var(--ink2);white-space:nowrap}
.out-flag.ok{color:var(--ok);border-color:#285b49}
.out-links{display:flex;gap:12px;font-size:14px;margin-top:4px;flex-wrap:wrap}
.out-edit{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);align-items:end}
.out-edit label{font-size:14px;color:var(--ink2);display:grid;gap:4px}
.out-edit select,.out-edit input{width:100%;font-size:14px;padding:7px 9px}
.out-edit .wide{grid-column:span 2}
.out-edit .adm-btn{justify-self:start}
.out-script>summary{cursor:pointer;font-size:14px;color:var(--ink2);font-weight:700;margin-top:10px}
.out-script p{font-size:14px;line-height:1.7;color:#d7c7a8;margin:8px 0 0}
.adm-todo .out-steps{margin:0 0 10px;padding-left:22px;font-size:16px;line-height:1.7}
@media(max-width:640px){.out-edit{grid-template-columns:1fr 1fr}.out-edit .wide{grid-column:1/-1}}
`;

function Card({ t, i }: { t: OutreachTarget; i: number }) {
  return (
    <article className="adm-card out-card">
      <div className="top">
        <div className="h"><span className="rank">#{i + 1}</span>{t.name}</div>
        <span className={`out-flag ${qualifies(t) ? "ok" : ""}`}>{qualifies(t) ? "제안 가능" : t.status}</span>
      </div>
      <div className="d">{t.district} {t.neighborhood} · {t.address ?? "주소 추가 확인"} · {t.phone ?? "전화번호 추가 확인"}</div>
      {t.nextAction && <div className="d">다음: {t.nextAction}{t.nextDue ? ` · ${t.nextDue}` : ""}</div>}
      {t.evidenceNote && <div className="d">{t.evidenceNote}</div>}
      <div className="out-links">
        {t.phone && <a href={`tel:${t.phone}`}>전화</a>}
        {t.website && <a href={t.website} target="_blank" rel="noreferrer">홈페이지</a>}
        <a href={t.evidenceUrl} target="_blank" rel="noreferrer">선정 근거</a>
      </div>
      <form className="out-edit" action={updateOutreach}>
        <input type="hidden" name="id" value={t.id} />
        {([["owner", "원장 직접 상담", t.ownerConsults], ["volume", "월 문의 5건+", t.monthlyInquiries5plus], ["single", "단일 지점", t.singleLocation]] as const).map(([n, l, v]) => (
          <label key={n}>{l}
            <select name={n} defaultValue={yn(v)}>
              <option value="unknown">미확인</option><option value="yes">예</option><option value="no">아니오</option>
            </select>
          </label>
        ))}
        <label>상태<select name="status" defaultValue={t.status}>{OUTREACH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="wide">다음 행동<input name="next" defaultValue={t.nextAction} /></label>
        <label>기한<input type="date" name="due" defaultValue={t.nextDue ?? ""} /></label>
        <label className="wide">메모<input name="note" defaultValue={t.note} /></label>
        <button className="adm-btn">저장</button>
      </form>
    </article>
  );
}

export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(HERE));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));
  const targets = await listOutreach();
  const count = (s: string) => targets.filter((t) => t.status === s).length;
  const top = targets.slice(0, 3);
  const rest = targets.slice(3);

  return (
    <main className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>첫 고객 영업판</h1>
          <AdminNav here="/admin/outreach" />
        </div>
        <p className="sub" style={{ marginBottom: 12 }}>
          후보 {targets.length}곳 · 조건 충족 {count("조건 충족")} · 제안 {count("제안 발송")} · 결제 {count("결제")} · 세 조건 확인 {targets.filter(qualifies).length}
        </p>

        <section className="adm-todo" aria-labelledby="out-h">
          <h2 id="out-h">오늘 할 일 — 위에서 3곳</h2>
          {targets.length === 0 ? <p className="none">없음 — 영업 후보 표가 아직 비어 있습니다</p> : <>
            <ol className="out-steps" style={{ display: "block", listStyle: "decimal" }}>
              <li>전화해서 원장 연결을 요청합니다.</li>
              <li>원장 직접 상담 · 월 문의 5건 이상 · 단일 지점, 세 가지만 확인합니다.</li>
              <li>셋 다 맞으면 30일 유료 파일럿을 말하고 제안문을 보냅니다.</li>
              <li>통화 직후 아래 상태와 다음 행동을 저장합니다.</li>
            </ol>
            <div className="out-list">{top.map((t, i) => <Card key={t.id} t={t} i={i} />)}</div>
            <details className="out-script">
              <summary>통화문 보기</summary>
              <p>“사이티드의 이재원입니다. 네이버 순위 광고가 아니라, 학부모가 ChatGPT나 AI 검색에 ‘이 지역 코딩학원’을 물었을 때 학원이 어떤 근거로 언급되는지 30일 동안 측정하고 고치는 일을 합니다. 성과 판정이 가능한 학원만 받고 있어서 두 가지만 여쭤보겠습니다. 원장님이 신규 상담을 직접 받으시나요? 최근 한 달 신규 문의가 대략 5건 이상인가요?”</p>
              <p>조건 충족 시: “3곳만 39만원 유료 파일럿으로 진행합니다. 질문 20개를 두 번 기준 측정하고, 정보 정합성 수정안·근거 콘텐츠 1개·30일 재측정·상담 유입 기록표까지 드립니다. 노출이나 순위는 보장하지 않습니다. 결과가 없으면 실패 원인을 남기고 갱신 권유도 하지 않습니다.”</p>
            </details>
          </>}
        </section>

        {rest.length > 0 && (
          <details className="adm-more">
            <summary>자세히 — 나머지 후보 {rest.length}곳</summary>
            <div className="in out-list">{rest.map((t, i) => <Card key={t.id} t={t} i={i + 3} />)}</div>
          </details>
        )}
      </div>
    </main>
  );
}
