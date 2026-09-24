import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { getPilot } from "@/lib/pilots";
import { engineName } from "@/lib/agents";
import { updatePilotTask, updateAudit, approveQuestions, updateQuestion, updateContent } from "@/lib/pilot-actions";
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
@media(max-width:800px){.pd-task,.pd-row{grid-template-columns:1fr}.pd-qs{columns:1}}
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

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ key?: string }> }) {
  const [{ id }, { key }] = await Promise.all([params, searchParams]);
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
