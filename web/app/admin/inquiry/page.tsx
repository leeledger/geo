import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { listInquiries, inquirySummary, SOURCES } from "@/lib/inquiries";
import { addInquiry, resolveInquiry } from "@/lib/inquiry-actions";
import Link from "next/link";
/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/inquiry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 문의 기록 화면.
 *
 * 상담 끝나고 30초 안에 입력돼야 한다. 넘어가면 안 쓰게 되고,
 * 안 쓰면 노출이 문의로 이어지는지 영영 모른다.
 * 그래서 칸을 다섯 개로 줄이고, 유입 경로는 버튼으로 골라 누르게 했다.
 */

const CSS = `
.inq{--bg:#0C1016;--card:#141A22;--sunk:#10151C;--line:#232C38;--soft:#1A222C;
  --ink:#E8EDF3;--ink2:#A7B2C0;--mut:#7B8696;--faint:#5A6474;
  --acc:#F5A623;--cool:#3DD6C4;--ok:#3DD6A0;--crit:#D2705F;
  background:var(--bg);color:var(--ink);min-height:100vh;
  font-family:"Noto Sans KR",system-ui,sans-serif;padding:38px 0 90px}
.inq .w{max-width:900px;margin:0 auto;padding:0 24px}
.inq .mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
.inq h1{font-size:25px;font-weight:900;letter-spacing:-.035em;margin:0 0 6px}
.inq .eb{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--acc);margin-bottom:8px}
.inq .lead{font-size:14px;color:var(--mut);margin:0 0 8px;word-break:keep-all}
.inq h2{font-size:16px;font-weight:800;margin:42px 0 12px;letter-spacing:-.02em}
.inq a.back{font-size:13px;color:var(--cool);text-decoration:none}

.inq-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:20px 0 4px}
.inq-s{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.inq-s .v{font-family:"IBM Plex Mono",monospace;font-size:26px;font-weight:500;
  font-variant-numeric:tabular-nums}
.inq-s .v small{font-size:12.5px;color:var(--mut);margin-left:4px}
.inq-s .k{font-size:12px;color:var(--mut);margin-top:4px}
.inq-s.hi .v{color:var(--cool)}

form.inq-f{background:var(--card);border:1px solid var(--line);border-radius:14px;
  padding:20px 22px;margin-top:14px}
.inq-f label{display:block;font-size:12px;color:var(--mut);margin:14px 0 7px}
.inq-f label:first-child{margin-top:0}
.inq-f input[type=text],.inq-f input[type=date],.inq-f textarea{
  width:100%;background:var(--sunk);color:var(--ink);border:1px solid var(--line);
  border-radius:9px;padding:11px 13px;font-family:inherit;font-size:14.5px}
.inq-f textarea{min-height:62px;resize:vertical;line-height:1.7}
.inq-f input:focus,.inq-f textarea:focus{outline:none;border-color:var(--acc)}

.pick{display:flex;flex-wrap:wrap;gap:7px}
.pick input{position:absolute;opacity:0;width:0;height:0}
.pick label{display:inline-block;margin:0;padding:8px 13px;border-radius:9px;
  background:var(--sunk);border:1px solid var(--line);color:var(--ink2);
  font-size:13.5px;cursor:pointer;transition:.15s}
.pick label:hover{border-color:var(--faint)}
.pick input:checked + label{background:#2A2010;border-color:var(--acc);color:var(--acc);font-weight:700}
.pick.cool input:checked + label{background:#0F2724;border-color:var(--cool);color:var(--cool)}

.inq-f .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.inq-f button{margin-top:20px;width:100%;background:var(--acc);color:#12161F;border:0;
  border-radius:10px;padding:14px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer}
.inq-f button:hover{filter:brightness(1.07)}

.inq-tw{overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:var(--card)}
.inq table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:620px}
.inq th,.inq td{text-align:left;padding:11px 15px;border-bottom:1px solid var(--soft);vertical-align:top}
.inq thead th{background:var(--sunk);font-size:11px;letter-spacing:.08em;color:var(--mut);font-weight:600}
.inq tbody tr:last-child td{border-bottom:0}
.inq td.m{font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--mut);white-space:nowrap}
.inq .tag{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11.5px;
  background:var(--soft);color:var(--ink2)}
.inq .tag.ai{background:#2A2010;color:var(--acc)}
.inq .tag.se{background:#0F2724;color:var(--cool)}
.inq .said{color:var(--ink2);font-size:13px;word-break:keep-all}
.inq .empty{padding:34px 20px;text-align:center;color:var(--faint);font-size:14px}
.inq .pending{border:1px solid #523d22;background:#211a11;border-radius:12px;padding:14px 17px;
  margin-top:18px;color:var(--ink2);font-size:13.5px;line-height:1.7}
.inq .pending b{color:var(--acc)}
.inq .outcome{display:flex;gap:5px;align-items:center}
.inq .outcome form{margin:0}.inq .outcome button{border:1px solid var(--line);background:var(--sunk);
  color:var(--ink2);border-radius:7px;padding:5px 8px;font:inherit;font-size:11.5px;cursor:pointer}
.inq .outcome button.y{border-color:#275d4c;color:var(--cool)}
.inq .why{border-left:3px solid var(--cool);background:var(--sunk);border-radius:0 12px 12px 0;
  padding:15px 19px;margin-top:16px;font-size:13.5px;color:var(--ink2);line-height:1.8;
  word-break:keep-all}
.inq .why b{color:var(--ink)}
`;

const SEARCHY = new Set(["네이버검색", "구글검색", "네이버플레이스", "AI"]);
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });

export default async function InquiryPage({
  searchParams,
}: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const [rows, sum] = await Promise.all([listInquiries(), inquirySummary()]);
  const m = sum[0];
  const unresolved = rows.filter((r) => r.enrolled === null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="inq">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="eb">Cited · 문의 기록</div>
        <h1>어떻게 알고 오셨어요</h1>
        <p className="lead">
          상담 첫 마디에 이걸 묻고 한 줄 남깁니다. 30초면 됩니다.
        </p>
        <Link className="back" href="/admin/ops">← 운영 현황</Link>

        <div className="inq-sum">
          <div className="inq-s">
            <div className="v">{m?.total ?? 0}<small>건</small></div>
            <div className="k">이번 달 문의</div>
          </div>
          <div className="inq-s hi">
            <div className="v">{m?.fromSearch ?? 0}<small>건</small></div>
            <div className="k">검색·AI로 온 사람</div>
          </div>
          <div className="inq-s hi">
            <div className="v">{m?.fromAi ?? 0}<small>건</small></div>
            <div className="k">AI 보고 온 사람</div>
          </div>
          <div className="inq-s">
            <div className="v">{m?.enrolled ?? 0}<small>명</small></div>
            <div className="k">등록</div>
          </div>
        </div>

        <div className="why">
          <b>왜 이걸 손으로 적는가.</b> AI 답변을 보고 온 사람은 서버 기록에 안 남습니다.
          챗 화면에서 이름만 보고 나중에 네이버로 검색해 오면 「네이버에서 온 사람」으로 찍힙니다.
          그래서 <b>직접 묻는 것 말고는 방법이 없습니다.</b>
          원시적이지만 조작이 불가능하고, 대행사가 아니라 우리가 가진 데이터라 리포트보다 셉니다.
        </div>

        {unresolved.length > 0 && (
          <div className="pending">
            <b>완료되지 않은 상담 {unresolved.length}건</b><br />
            등록했는지 확인하기 전까지 매출 검증은 끝나지 않습니다. 아래 목록에서 결과를 누르면 이 업무가 닫힙니다.
          </div>
        )}

        <h2>새 문의</h2>
        <form className="inq-f" action={addInquiry}>
          <label>어떻게 알고 오셨나</label>
          <div className="pick">
            {SOURCES.map((s, i) => (
              <span key={s}>
                <input type="radio" id={`s-${s}`} name="source" value={s} defaultChecked={i === 0} required />
                <label htmlFor={`s-${s}`}>{s}</label>
              </span>
            ))}
          </div>

          <label htmlFor="said">그분이 한 말 (그대로)</label>
          <textarea id="said" name="said"
                    placeholder="AI한테 물어봤더니 여기가 나왔어요" />

          <div className="row">
            <div>
              <label>연락 경로</label>
              <div className="pick cool">
                {["전화", "카카오", "방문"].map((c, i) => (
                  <span key={c}>
                    <input type="radio" id={`c-${c}`} name="channel" value={c} defaultChecked={i === 0} />
                    <label htmlFor={`c-${c}`}>{c}</label>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="grade">아이 학년</label>
              <input id="grade" type="text" name="grade" placeholder="초5" />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="day">날짜</label>
              <input id="day" type="date" name="day" defaultValue={today} />
            </div>
            <div>
              <label>등록 여부</label>
              <div className="pick cool">
                {[["", "아직"], ["yes", "등록"], ["no", "안 함"]].map(([v, t], i) => (
                  <span key={t}>
                    <input type="radio" id={`e-${t}`} name="enrolled" value={v} defaultChecked={i === 0} />
                    <label htmlFor={`e-${t}`}>{t}</label>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button type="submit">기록하기</button>
        </form>

        <h2>지금까지</h2>
        <div className="inq-tw">
          {rows.length === 0 ? (
            <div className="empty">
              아직 기록이 없습니다.<br />
              다음 상담부터 한 줄씩 남기시면 됩니다.
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>날짜</th><th>경로</th><th>한 말</th><th>학년</th><th>등록</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="m">{fmt(r.day)}</td>
                    <td>
                      <span className={`tag ${r.source === "AI" ? "ai" : SEARCHY.has(r.source) ? "se" : ""}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="said">{r.said || "—"}</td>
                    <td className="m">{r.grade || "—"}</td>
                    <td className="m">
                      {r.enrolled === null ? (
                        <div className="outcome">
                          <form action={resolveInquiry}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="result" value="yes" />
                            <button className="y" type="submit">등록</button>
                          </form>
                          <form action={resolveInquiry}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="result" value="no" />
                            <button type="submit">안 함</button>
                          </form>
                        </div>
                      ) : r.enrolled ? "등록" : "안 함"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
