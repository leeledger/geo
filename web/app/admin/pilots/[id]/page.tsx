import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { getPilot } from "@/lib/pilots";
import { engineName } from "@/lib/agents";
import { updatePilotTask, updateAudit, approveQuestions, updateQuestion, updateContent, updatePilotContract, markBaselineSent } from "@/lib/pilot-actions";
import { NEEDS_BUILD, NEEDS_BUILD_LABEL, refundGuide } from "@/lib/pilot-plan";
import { SURFACES, SHOWN } from "@/lib/manual-checks";
import AdminNav from "../../AdminNav";
import SubmitButton from "../../SubmitButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 파일럿 한 곳. 맨 위는 「오늘 해야 할 일」(기한이 오늘이거나 지난, 안 끝난 업무).
 * 전체 업무·목표 질문 20개·측정 원장·로컬 정합성·콘텐츠 승인은 각각 접는다.
 * 폼·필드·액션은 그대로 — 한 줄로 눌려 있던 것을 풀어 쓰고 배치만 바꿨다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const D = (x: any) => x?.toISOString?.().slice(0, 10) ?? String(x ?? "").slice(0, 10);
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const CSS = `
.pd-k{font-size:14px;color:var(--ink2);margin:4px 0 0}
.pd-links{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;margin-top:6px}
.pd-task{display:grid;grid-template-columns:96px 1fr 150px 2fr auto;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0;font-size:14px}
.pd-task:first-child{border-top:0}
.pd-task input,.pd-task select,.pd-row input,.pd-row select{width:100%;font-size:14px;padding:7px 9px}
.pd-task .who{color:var(--ink2)}
.pd-late{color:var(--crit)}
.pd-sec{margin-top:10px}
.pd-sec>summary{cursor:pointer}
.pd-qs{columns:2;column-gap:24px}
.pd-q{break-inside:avoid;border-bottom:1px solid var(--line);padding:8px 0;font-size:14px}
.pd-q i{color:var(--acc);font-style:normal;margin-right:6px}
.pd-q .adm-btn{margin-top:6px}
.pd-ai{display:flex;gap:8px;flex-wrap:wrap}
.pd-pill{border:1px solid var(--line);padding:8px 11px;border-radius:8px;font-size:14px;background:var(--card)}
.pd-row{display:grid;grid-template-columns:130px 100px 1fr 110px 2fr auto;gap:6px;padding:8px 0;border-top:1px solid var(--line);align-items:center;font-size:14px}
.pd-row:first-child{border-top:0}
.pd-check{display:grid;grid-template-columns:2fr 150px 110px 150px;gap:8px;align-items:center;margin:8px 0 10px}
.pd-check select,.pd-check input{width:100%;font-size:14px;padding:7px 9px}
.pd-contract{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pd-contract label{font-size:14px;color:var(--ink2);display:grid;gap:4px}
.pd-contract input,.pd-contract select{width:100%}
.pd-contract .w2,.pd-contract .adm-btn{grid-column:1/-1}
@media(max-width:800px){.pd-task,.pd-row,.pd-check,.pd-contract{grid-template-columns:1fr}.pd-qs{columns:1}}
`;

function TaskForm({ t, path, today }: { t: any; path: string; today: string }) {
  const late = t.status !== "완료" && D(t.due_on) < today;
  return (
    <form className="pd-task" action={updatePilotTask}>
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="path" value={path} />
      <span className={late ? "pd-late" : undefined}>{D(t.due_on)}{late ? " 지남" : ""}</span>
      <span><b>{t.title}</b> <span className="who">· {t.owner}</span></span>
      <select name="status" defaultValue={t.status} aria-label="상태">
        <option>대기</option><option>진행</option><option>완료</option><option>막힘</option>
      </select>
      <input name="evidence" defaultValue={t.evidence} placeholder="완료 근거 URL·파일·메모" aria-label="완료 근거" />
      <SubmitButton className="adm-btn">저장</SubmitButton>
    </form>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ key?: string; check?: string }> }) {
  const [{ id }, { key, check }] = await Promise.all([params, searchParams]);
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(`/admin/pilots/${id}`));
  if (!(await isAdmin(key))) redirect(`/admin/login?to=/admin/pilots/${id}`);
  const x = await getPilot(id);
  if (!x) notFound();
  const path = `/admin/pilots/${id}`;
  const today = kstToday();
  const done = x.tasks.filter((t: any) => t.status === "완료").length;
  const approved = x.questions.filter((q: any) => q.approved).length;
  const due = x.tasks.filter((t: any) => t.status !== "완료" && D(t.due_on) <= today);

  return (
    <main className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>{x.pilot.name}</h1>
          <AdminNav here="/admin/pilots" />
        </div>
        <p className="pd-k">
          {x.pilot.domain} · {D(x.pilot.started_on)} ~ {D(x.pilot.ends_on)} · 390,000원 입금 {x.pilot.payment_ref} · 업무 {done}/{x.tasks.length} · 질문 승인 {approved}/20 · 측정 {x.ai.length}회 ·
          정합성 확인 {x.audits.filter((a: any) => a.verdict !== "미확인").length}/20
        </p>
        <p className="pd-k">
          {x.pilot.kickoff_on ? <>착수 {D(x.pilot.kickoff_on)}</> : <>착수 전 — 질문 승인 뒤 첫 측정일이 착수일이 됩니다</>}
          {" · "}{NEEDS_BUILD_LABEL[x.pilot.needs_build] ?? "구축 여부 미입력"}
          {x.pilot.kickoff_on && x.pilot.needs_build !== "none" && !x.pilot.site_launch_on ? " · 사이트 연 날 미입력 — 30일은 연 날부터 셉니다" : ""}
          {" · "}기준선 보고 {x.pilot.baseline_sent_at ? `보냄 ${D(new Date(new Date(x.pilot.baseline_sent_at).getTime() + 9 * 3600 * 1000))}` : "안 보냄"}
          {x.pilot.cancelled_on ? ` · 취소 ${D(x.pilot.cancelled_on)}` : ""}
        </p>
        <div className="pd-links">
          <Link href="/admin/pilots">← 파일럿 목록</Link>
          <a href={`/api/pilots/${id}/prompts`}>측정 질문 받기</a>
          <a href="/tools/measurement-workbench.html" target="_blank" rel="noreferrer">측정 도구 열기</a>
          <a href={`/record/${x.pilot.inquiry_key}`} target="_blank" rel="noreferrer">고객 상담 기록 링크</a>
        </div>

        <section className="adm-todo" aria-labelledby="pd-h" style={{ marginTop: 14 }}>
          <h2 id="pd-h">오늘 해야 할 일{due.length > 0 && <span className="n"> {due.length}건</span>}</h2>
          {due.length === 0
            ? <p className="none">없음 — 기한이 온 업무를 다 끝냈습니다</p>
            : <div>{due.map((t: any) => <TaskForm key={t.id} t={t} path={path} today={today} />)}</div>}
        </section>

        <details className="adm-more">
          <summary>전체 업무 {x.tasks.length}개</summary>
          <div className="in">{x.tasks.map((t: any) => <TaskForm key={t.id} t={t} path={path} today={today} />)}</div>
        </details>

        <details className="adm-more">
          <summary>목표 질문 20개 — 승인 {approved}/20</summary>
          <div className="in">
            <div className="pd-qs">
              {x.questions.map((q: any) => (
                <form className="pd-q" action={updateQuestion} key={q.id}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="path" value={path} />
                  <i>{q.position}. {q.stage}{q.approved ? " · 승인" : ""}</i>
                  <input name="text" defaultValue={q.text} aria-label={`질문 ${q.position}`} style={{ width: "100%" }} />
                  <SubmitButton className="adm-btn alt">수정</SubmitButton>
                </form>
              ))}
            </div>
            {approved < 20 && (
              <form action={approveQuestions} style={{ marginTop: 14 }}>
                <input type="hidden" name="pilot_id" value={id} />
                <input type="hidden" name="path" value={path} />
                <SubmitButton className="adm-btn">고객 승인 완료로 표시</SubmitButton>
              </form>
            )}
          </div>
        </details>

        <details className="adm-more" id="manual" open={Boolean(check)}>
          <summary>손 확인 기록 — 구글·네이버 AI 화면 {x.checks.length}건</summary>
          <div className="in">
            {check && <p className="sub" role="alert" style={{ color: "var(--crit)" }}>{check}</p>}
            <p className="sub">자동 측정이 없는 화면을 직접 본 결과입니다. 시작·30일 차 각 1회. 표본이 작아 방향 참고용이고 자동 측정 비율에 넣지 않습니다.</p>
            <form className="pd-check" action={`/api/pilots/${id}/checks`} method="post" encType="multipart/form-data">
              <select name="question" required aria-label="질문" defaultValue="">
                <option value="" disabled>질문 고르기</option>
                {x.questions.map((q: any) => <option key={q.id} value={q.text}>{q.position}. {q.text}</option>)}
              </select>
              <select name="surface" aria-label="화면">{SURFACES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <select name="shown" aria-label="결과">{SHOWN.map((s) => <option key={s}>{s}</option>)}</select>
              <input type="date" name="checked_on" defaultValue={today} required aria-label="확인한 날" />
              <input type="file" name="capture" accept="image/png,image/jpeg,image/webp" aria-label="캡처 (2MB 까지)" />
              <input name="note" placeholder="메모" aria-label="메모" maxLength={500} />
              {/* 캡처(2MB)는 서버 동작 본문 상한(1MB)을 넘어 경로 처리기로 보낸다 — 평범한 제출 버튼 */}
              <button className="adm-btn" type="submit">적기</button>
            </form>
            {x.checks.map((c: any) => (
              <div className="pd-row" key={c.id}>
                <span>{c.checked_on}</span>
                <span>{SURFACES.find((s) => s.key === c.surface)?.label ?? c.surface}</span>
                <span>{c.question}</span>
                <b>{c.shown}</b>
                <span>{c.note}</span>
                {c.has_capture ? <a href={`/api/pilots/${id}/checks/${c.id}`} target="_blank" rel="noreferrer">캡처</a> : <span className="sub">캡처 없음</span>}
              </div>
            ))}
          </div>
        </details>

        <details className="adm-more">
          <summary>계약·일정 — 구축 여부 · 사이트 연 날 · 경쟁사 · 환불</summary>
          <div className="in">
            <form className="pd-contract" action={updatePilotContract}>
              <input type="hidden" name="pilot_id" value={id} />
              <input type="hidden" name="path" value={path} />
              <label>필요한 준비
                <select name="needs_build" defaultValue={x.pilot.needs_build ?? "none"}>
                  {NEEDS_BUILD.map((n) => <option key={n} value={n}>{NEEDS_BUILD_LABEL[n]}</option>)}
                </select>
              </label>
              <label>사이트 연 날(구축·세팅만)<input type="date" name="site_launch_on" defaultValue={x.pilot.site_launch_on ? D(x.pilot.site_launch_on) : ""} /></label>
              <label className="w2">경쟁사 (쉼표로 3~5곳 · 보고서 점유율)<input name="competitors" defaultValue={x.pilot.competitors ?? ""} maxLength={220} /></label>
              <label>사업자 유형<input name="biz_type" defaultValue={x.pilot.biz_type ?? ""} maxLength={40} /></label>
              <label>환불 절 서면 전달일<input type="date" name="refund_terms_sent_on" defaultValue={x.pilot.refund_terms_sent_on ? D(x.pilot.refund_terms_sent_on) : ""} /></label>
              <label>세금계산서 발행일<input type="date" name="invoice_issued_on" defaultValue={x.pilot.invoice_issued_on ? D(x.pilot.invoice_issued_on) : ""} /></label>
              <label>취소일<input type="date" name="cancelled_on" defaultValue={x.pilot.cancelled_on ? D(x.pilot.cancelled_on) : ""} /></label>
              <label>환불액(원)<input name="refund_amount" inputMode="numeric" pattern="\d{1,7}" defaultValue={x.pilot.refund_amount ?? ""} /></label>
              <p className="sub w2">지금 취소하면: {refundGuide(x.pilot)}. 구축·세팅 환불은 계약서 기준입니다.</p>
              <SubmitButton className="adm-btn">저장</SubmitButton>
            </form>
            {!x.pilot.baseline_sent_at && (
              <form action={markBaselineSent} style={{ marginTop: 12 }}>
                <input type="hidden" name="pilot_id" value={id} />
                <input type="hidden" name="path" value={path} />
                <SubmitButton className="adm-btn alt">기준선 보고를 보냈음으로 표시</SubmitButton>
              </form>
            )}
          </div>
        </details>

        <details className="adm-more">
          <summary>AI 측정 원장 — {x.ai.length}회</summary>
          <div className="in pd-ai">
            {x.ai.length ? x.ai.map((a: any, i: number) => (
              <div className="pd-pill" key={i}>{a.day} · {engineName(String(a.engine ?? ""))}<br /><b>언급 {a.mentioned}/{a.n} · 인용 {a.cited}/{a.n}</b></div>
            )) : <span className="sub">아직 측정 없음. 같은 화면·로그인 상태·20문항을 회차마다 유지합니다.</span>}
          </div>
        </details>

        <details className="adm-more">
          <summary>로컬 정보 정합성</summary>
          <div className="in">
            {x.audits.map((a: any) => (
              <form className="pd-row" action={updateAudit} key={a.id}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="path" value={path} />
                <b>{a.source}</b><span>{a.field}</span>
                <input name="observed" defaultValue={a.observed} placeholder="현재 표시" />
                <select name="verdict" defaultValue={a.verdict}><option>미확인</option><option>일치</option><option>불일치</option><option>없음</option></select>
                <input name="recommendation" defaultValue={a.recommendation} placeholder="수정안 또는 확인 근거" />
                <SubmitButton className="adm-btn">저장</SubmitButton>
              </form>
            ))}
          </div>
        </details>

        <details className="adm-more">
          <summary>근거 콘텐츠 승인</summary>
          <div className="in">
            {x.content.map((c: any) => (
              <form className="pd-row" action={updateContent} key={c.id}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="path" value={path} />
                <input name="title" defaultValue={c.title} placeholder="질문형 제목" />
                <input name="draft_url" defaultValue={c.draft_url ?? ""} placeholder="초안 URL" />
                <select name="status" defaultValue={c.status}><option>주제 선정</option><option>초안</option><option>수정 요청</option><option>승인</option><option>게시</option></select>
                <input name="published_url" defaultValue={c.published_url ?? ""} placeholder="게시 URL" />
                <input name="customer_note" defaultValue={c.customer_note} placeholder="고객 사실 확인 메모" />
                <SubmitButton className="adm-btn">저장</SubmitButton>
              </form>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
