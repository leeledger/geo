import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { inqPool } from "@/lib/inquiries";
import { CODE_SLUGS, 체크리스트, 폼값, 바깥글폼값, 오류말, 파일럿상태, type Derived } from "@/lib/client-core.mjs";
import { createPilot } from "@/lib/pilot-actions";
import { recheckClient, markGscGranted, deleteTestClient } from "@/lib/client-actions";
import { NEEDS_BUILD, NEEDS_BUILD_LABEL } from "@/lib/pilot-plan";
import AdminNav from "../../AdminNav";
import SubmitButton from "../../SubmitButton";
import CopyButton from "../../ops/CopyButton";
import ClientForm from "../ClientForm";
import MarketingForm from "../MarketingForm";
import "../clients.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 「다시 점검」·고치기(도메인 바뀜) 서버 동작이 고객 사이트를 연다(전체 20초). 서버 동작 시간 한도 = 이 페이지 maxDuration(next docs)
export const maxDuration = 60;

/**
 * 고객 한 곳(Step 38). 맨 위 체크리스트(됨·기다림·사람·해당없음) → 고치기 → 점검 근거 → 파일럿 시작(외부·파일럿 없음) → 지우기(시험만).
 * 점검 근거(고객 사이트 본문 앞 300자)는 이 화면에만 보인다.
 */

/** 파일럿 시작 폼 칸 — 옛 /admin/pilots 등록 폼 그대로(이름·도메인·slug·이름 판별 말은 고객 행에서 읽는다) */
const PILOT_FIELDS: [string, string][] = [
  ["district", "구"], ["neighborhood", "동네"],
  // 학원·교습소·공부방·교실·과외가 들어가면 학원 질문·교육청 점검이 붙는다(lib/pilot-intake.ts)
  ["category", "업종 (학원이면 「수학학원」처럼 학원까지 · 예: 치과)"], ["audience", "주 고객"], ["contact_name", "담당자"], ["contact_email", "담당자 이메일"],
  ["contact_phone", "담당자 전화"], ["receipt_type", "증빙 종류"], ["payment_ref", "입금 확인번호"], ["terms_evidence", "신청서·동의 증거 URL"],
  ["biz_type", "사업자 유형"],
];
const FIELD_LABEL: Record<string, string> = {
  ...Object.fromEntries(PILOT_FIELDS.map(([n, l]) => [n, l.replace(/\s*\(.*$/, "")])),
  paid_on: "입금 확인일", refund_terms_sent_on: "환불 절 서면 전달일",
};
/** ?err= → 사람 말 한 줄(Step 28 D23). 모르는 코드는 안 띄운다 */
function errText(err?: string, f?: string): string | null {
  if (err === "missing") {
    const names = String(f ?? "").split(",").map((k) => FIELD_LABEL[k]).filter(Boolean);
    return names.length ? `파일럿 시작 안 됨 — 빈 칸이 있습니다: ${names.join(", ")}` : "파일럿 시작 안 됨 — 빈 칸이 있습니다";
  }
  if (err === "terms") return "파일럿 시작 안 됨 — 이 고객에 「AI 답에서 찾을 이름」이 없습니다. 아래 고치기에서 넣어 주세요";
  if (err === "needs") return "파일럿 시작 안 됨 — 필요한 준비를 목록에서 골라 주세요";
  return err ? 오류말[err] ?? null : null;
}

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const kst = (iso?: string) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const 상태반 = { 됨: "done", 기다림: "wait", 사람: "human", 해당없음: "na" } as const;

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string; err?: string; f?: string; saved?: string; checked?: string }>;
}) {
  const { slug } = await params;
  const { key, err, f, saved, checked } = await searchParams;
  const here = `/admin/clients/${encodeURIComponent(slug)}`;
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(here));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(here));
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) notFound();

  const q = (s: string, p: unknown[] = []) => inqPool().query(s, p).then((r) => r.rows);
  const [row] = (await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [slug])).map((x) => x.r);
  if (!row) notFound();
  const 코드 = CODE_SLUGS.includes(slug);
  const pilot = await 파일럿상태(q, row.id);
  const d = (row.derived ?? {}) as Partial<Derived>;
  const 줄 = 체크리스트(row, d, { pilot });
  const 말 = errText(err, f);
  const 값 = 폼값(row);
  const 폼 = Object.fromEntries(Object.entries(값).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "on" : "") : v]));

  const 근거: [string, { status?: number | null; type?: string; head?: string; error?: string; url?: string } | undefined, string][] = [
    ["홈", d.home, Array.isArray(d.homeLdTypes) ? `JSON-LD: ${d.homeLdTypes.length ? d.homeLdTypes.join(", ") : "없음"}` : ""],
    ["robots.txt", d.robots, Array.isArray(d.robots?.blocked) ? `막힌 AI 로봇: ${d.robots.blocked.length ? d.robots.blocked.join(", ") : "없음"}` : ""],
    ["사이트맵", d.sitemap, d.sitemap?.pages !== undefined ? `${d.sitemap.url} · 주소 ${d.sitemap.pages}개` : d.sitemap?.url ?? ""],
    ["llms.txt", d.llmsTxt, d.llmsTxt?.ok !== undefined ? (d.llmsTxt.ok ? "글자 파일" : "글자 파일 아님") : ""],
    ["IndexNow 키 파일", d.indexnowFile, d.indexnowFile?.ok !== undefined ? (d.indexnowFile.ok ? "내용 맞음" : "없음·다름") : ""],
  ];

  return (
    <main className="adm">
      <div className="w">
        <div className="adm-top">
          <h1>{row.name}{row.status === "test" && <span className="cl-tag">시험</span>}</h1>
          <AdminNav here="/admin/clients" />
        </div>
        <p className="sub">{row.domain} · {row.relation ?? "외부"} · <Link href="/admin/clients">고객사 목록</Link></p>
        {saved && <p className="cl-note" role="status">저장했습니다.</p>}
        {checked && <p className="cl-note" role="status">사이트를 다시 열어 봤습니다.</p>}
        {말 && <p className="cl-err" role="alert">{말}</p>}

        {코드 ? (
          <p className="adm-empty">코드로 설정한 고객입니다(academy/clients.mjs). 화면에서 고치지 않습니다.</p>
        ) : (
          <>
            <section aria-labelledby="ck-h">
              <h2 id="ck-h">세팅 체크리스트</h2>
              <p className="sub">마지막 점검 {kst(d.checkedAt)} · 매시 회사 루프가 24시간 지난 고객을 다시 엽니다</p>
              <ul className="cl-checks" data-testid="checklist">
                {줄.map((x) => (
                  <li key={x.id} className={`cl-row${x.상태 === "사람" ? " human" : ""}`} data-check={x.id} data-state={x.상태}>
                    <span className="k">{x.칸}</span>
                    <span className={`s ${상태반[x.상태]}`}>{x.상태 === "사람" ? "원장님 몫" : x.상태}</span>
                    <span className="m">{x.사람말}</span>
                    {x.상태 === "사람" && x.할일 && (
                      <div className="todo">
                        {x.id === "send" ? (
                          <>
                            <textarea readOnly defaultValue={x.할일} aria-label="고객 담당에게 보낼 글" />
                            <div><CopyButton text={x.할일} label="보낼 글 복사" /></div>
                          </>
                        ) : <span>{x.할일}</span>}
                        {x.id === "gsc" && (
                          <form action={markGscGranted}>
                            <input type="hidden" name="slug" value={slug} />
                            <SubmitButton className="adm-btn">권한 받음</SubmitButton>
                          </form>
                        )}
                        {x.id === "measure" && <div><a className="adm-btn alt" href="#pilot">파일럿 시작 폼으로</a></div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="cl-acts">
                <form action={recheckClient}>
                  <input type="hidden" name="slug" value={slug} />
                  <SubmitButton className="adm-btn alt" pendingText="사이트를 여는 중… (20초까지)">다시 점검</SubmitButton>
                </form>
                {pilot && <Link href={`/admin/pilots/${pilot.id}`}>파일럿 화면 열기</Link>}
              </div>
            </section>

            <details className="adm-more">
              <summary>점검 근거 — 상태 코드·형식·본문 앞부분</summary>
              <div className="in">
                {!d.checkedAt ? <p className="sub">아직 점검 전입니다.</p> : (
                  <div className="adm-tw">
                    <table className="cl-ev">
                      <thead><tr><th>주소</th><th>코드</th><th>읽은 것</th><th>본문 앞부분</th></tr></thead>
                      <tbody>
                        {근거.map(([이름, x, 읽음]) => (
                          <tr key={이름}>
                            <td>{이름}</td>
                            <td>{x?.status ?? "—"}{x?.type ? ` · ${x.type}` : ""}</td>
                            <td>{x?.error ? `${x.error}${읽음 ? ` · ${읽음}` : ""}` : 읽음 || "—"}</td>
                            <td><pre>{x?.head ?? ""}</pre></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(d.errors?.length ?? 0) > 0 && <ul>{d.errors!.map((e) => <li key={e}>{e}</li>)}</ul>}
              </div>
            </details>

            <details className="adm-more">
              <summary>고치기</summary>
              <div className="in">
                <ClientForm mode="edit" 값={폼} slug={slug} />
              </div>
            </details>

            <details className="adm-more" id="offsite">
              <summary>바깥 글 — 지식iN·카페·블로그 초안에 쓰는 사실</summary>
              <div className="in">
                <MarketingForm 값={바깥글폼값(row)} slug={slug} />
              </div>
            </details>

            {row.relation === "외부" && !pilot && (
              <details className="adm-more" id="pilot" open={err && ["missing", "terms", "needs"].includes(err) ? true : undefined}>
                <summary>파일럿 시작 — 계약 칸</summary>
                <div className="in">
                  <p className="sub">입금을 확인한 뒤 넣습니다. 질문 20개와 착수·기준선·30일 업무가 생깁니다. 이름·도메인·답에서 찾을 이름은 이 고객 정보에서 씁니다.</p>
                  <form className="cl-form" action={createPilot}>
                    <input type="hidden" name="client_id" value={row.id} />
                    {PILOT_FIELDS.map(([n, l]) => <label key={n}>{l}<input name={n} required /></label>)}
                    {/* 구축 없음이면 30일이 이날부터다(신청서 8행) */}
                    <label>입금 확인일<input type="date" name="paid_on" defaultValue={kstToday()} required /></label>
                    <label>환불 절 서면 전달일<input type="date" name="refund_terms_sent_on" required /></label>
                    <label>필요한 준비
                      <select name="needs_build" defaultValue="none">
                        {NEEDS_BUILD.map((n) => <option key={n} value={n}>{NEEDS_BUILD_LABEL[n]}</option>)}
                      </select>
                    </label>
                    {/* 비워도 된다 — 보고서 경쟁사 절이 「경쟁사 미설정」이 된다 */}
                    <label>경쟁사 (쉼표로 3~5곳 · 선택)<input name="competitors" maxLength={220} /></label>
                    <SubmitButton className="adm-btn cl-save">30일 업무 생성</SubmitButton>
                  </form>
                </div>
              </details>
            )}

            {row.status === "test" && (
              <section className="cl-danger" aria-labelledby="del-h">
                <h2 id="del-h">시험 고객 지우기</h2>
                <p className="sub">이 고객 행과 붙은 행(파일럿·질문·일감·활동·측정)을 한 번에 지웁니다. 하나라도 남으면 전부 되돌립니다.</p>
                <form action={deleteTestClient}>
                  <input type="hidden" name="slug" value={slug} />
                  <SubmitButton className="adm-btn bad">지우기</SubmitButton>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
