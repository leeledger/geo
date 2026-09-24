import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import { listInquiries, inquirySummary, SOURCES, type Inquiry } from "@/lib/inquiries";
import { addInquiry, resolveInquiry } from "@/lib/inquiry-actions";
import { listClients } from "@/lib/ops";
import AdminNav from "../AdminNav";
import SubmitButton from "../SubmitButton";

/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/inquiry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 문의 기록 — 「어떻게 알고 오셨어요」.
 *
 * 맨 위는 결과를 아직 안 적은 상담. 그 다음이 새 문의 입력(30초). 지난 기록은 최근 10건만 카드로, 나머지는 자세히.
 * AI 답변을 보고 온 사람은 서버 기록에 안 남는다 — 직접 묻는 것 말고는 방법이 없다.
 */

const CSS = `
.inq-pick{display:flex;flex-wrap:wrap;gap:7px}
.inq-pick input{position:absolute;opacity:0;width:0;height:0}
.inq-pick label{display:inline-block;margin:0;padding:8px 13px;border-radius:9px;background:var(--sunk);
  border:1px solid var(--line);color:var(--ink2);font-size:14px;cursor:pointer}
.inq-pick input:checked + label{background:#2A2010;border-color:var(--acc);color:var(--acc);font-weight:700}
.inq-pick input:focus-visible + label{outline:2px solid var(--acc);outline-offset:2px}
.inq-f{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.inq-f .l{display:block;font-size:14px;color:var(--ink2);margin:14px 0 6px}
.inq-f .l:first-of-type{margin-top:0}
.inq-f textarea,.inq-f input[type=text],.inq-f input[type=date]{width:100%}
.inq-f textarea{min-height:62px;resize:vertical}
.inq-f .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.inq-f .go{margin-top:18px;width:100%;padding:13px;font-size:16px}
@media(max-width:560px){.inq-f .row{grid-template-columns:1fr}}
.inq-list{display:grid;gap:8px}
.inq-res{display:flex;gap:6px}
.inq-res form{margin:0}
.inq-clients{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.inq-clients a{border:1px solid var(--line);border-radius:999px;padding:5px 14px;font-size:14px;font-weight:700;color:var(--ink2);text-decoration:none;background:var(--sunk)}
.inq-clients a[aria-current="page"]{border-color:var(--cool);color:var(--ink)}
`;

const md = (d: string) => `${Number(d.slice(5, 7))}/${d.slice(8, 10)}`;
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function Row({ r, resolve }: { r: Inquiry; resolve?: boolean }) {
  return (
    <div className="adm-card">
      <div className="h">{md(r.day)} · {r.source}{r.grade ? ` · ${r.grade}` : ""}</div>
      <div className="d">{r.said ? `「${r.said}」` : "한 말 기록 없음"}{!resolve && ` · ${r.enrolled === null ? "결과 미입력" : r.enrolled ? "등록" : "안 함"}`}</div>
      {resolve && (
        <div className="a inq-res">
          <form action={resolveInquiry}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="result" value="yes" />
            <SubmitButton className="adm-btn ok">등록</SubmitButton>
          </form>
          <form action={resolveInquiry}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="result" value="no" />
            <SubmitButton className="adm-btn alt">안 함</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

export default async function InquiryPage({
  searchParams,
}: { searchParams: Promise<{ key?: string; c?: string }> }) {
  const { key, c } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(HERE));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const clients = await listClients();
  const client = clients.find((x) => x.slug === c) ?? clients[0];
  const [rows, sum] = await Promise.all([listInquiries(60, client?.id), inquirySummary(client?.id)]);
  const m = sum[0];
  const unresolved = rows.filter((r) => r.enrolled === null);
  const done = rows.filter((r) => r.enrolled !== null);

  return (
    <div className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>문의 기록</h1>
          <AdminNav here="/admin/inquiry" />
        </div>
        {clients.length > 1 && (
          <nav className="inq-clients" aria-label="고객사">
            {clients.map((x) => (
              <Link key={x.id} href={`/admin/inquiry?c=${x.slug}`} aria-current={x.id === client?.id ? "page" : undefined}>{x.name}</Link>
            ))}
          </nav>
        )}

        <section className="adm-todo" aria-labelledby="inq-todo">
          <h2 id="inq-todo">결과 미입력{unresolved.length > 0 && <span className="n"> {unresolved.length}건</span>}</h2>
          {unresolved.length === 0 ? (
            <p className="none">없음 — 상담 결과가 모두 적혀 있습니다</p>
          ) : (
            <div className="inq-list">
              {unresolved.map((r) => <Row key={r.id} r={r} resolve />)}
            </div>
          )}
        </section>

        <h2>새 문의</h2>
        <p className="sub" style={{ marginBottom: 10 }}>상담 첫 마디에 「어떻게 알고 오셨어요」를 묻고 한 줄 남깁니다.</p>
        <form className="inq-f" action={addInquiry}>
          <input type="hidden" name="client_id" value={client?.id ?? 1} />
          <span className="l">어떻게 알고 오셨나</span>
          <div className="inq-pick">
            {SOURCES.map((s, i) => (
              <span key={s}>
                <input type="radio" id={`s-${s}`} name="source" value={s} defaultChecked={i === 0} required />
                <label htmlFor={`s-${s}`}>{s}</label>
              </span>
            ))}
          </div>

          <label className="l" htmlFor="said">그분이 한 말 (그대로)</label>
          <textarea id="said" name="said" placeholder="AI한테 물어봤더니 여기가 나왔어요" />

          <div className="row">
            <div>
              <span className="l">연락 경로</span>
              <div className="inq-pick">
                {["전화", "카카오", "방문"].map((ch, i) => (
                  <span key={ch}>
                    <input type="radio" id={`c-${ch}`} name="channel" value={ch} defaultChecked={i === 0} />
                    <label htmlFor={`c-${ch}`}>{ch}</label>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="l" htmlFor="grade">아이 학년</label>
              <input id="grade" type="text" name="grade" placeholder="초5" />
            </div>
          </div>

          <div className="row">
            <div>
              <label className="l" htmlFor="day">날짜</label>
              <input id="day" type="date" name="day" defaultValue={kstToday()} />
            </div>
            <div>
              <span className="l">등록 여부</span>
              <div className="inq-pick">
                {[["", "아직"], ["yes", "등록"], ["no", "안 함"]].map(([v, t], i) => (
                  <span key={t}>
                    <input type="radio" id={`e-${t}`} name="enrolled" value={v} defaultChecked={i === 0} />
                    <label htmlFor={`e-${t}`}>{t}</label>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <SubmitButton className="adm-btn go">기록하기</SubmitButton>
        </form>

        <h2>지난 기록</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          {m
            ? `${Number(m.month.slice(5, 7))}월 문의 ${m.total}건 · 검색·AI ${m.fromSearch}건 · 그중 AI ${m.fromAi}건 · 등록 ${m.enrolled}명`
            : "아직 기록이 없습니다 — 다음 상담부터 한 줄씩 남기시면 됩니다"}
        </p>
        {done.length > 0 && (
          <div className="inq-list">
            {done.slice(0, 10).map((r) => <Row key={r.id} r={r} />)}
          </div>
        )}
        {done.length > 10 && (
          <details className="adm-more">
            <summary>자세히 — 나머지 {done.length - 10}건</summary>
            <div className="in inq-list">
              {done.slice(10).map((r) => <Row key={r.id} r={r} />)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
