import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { inqPool } from "@/lib/inquiries";
import { CODE_SLUGS, 체크리스트, 폼값, 바깥글폼값, 오류말, 파일럿상태, 갈래, 자동단계, 자동단계말, type Derived } from "@/lib/client-core.mjs";
import { 다음단계, 멈춘단계, 자동요약, 임대초, type Auto } from "@/lib/auto-setup-core.mjs";
import { createPilot } from "@/lib/pilot-actions";
import { recheckClient, markGscGranted, deleteTestClient } from "@/lib/client-actions";
import { NEEDS_BUILD, NEEDS_BUILD_LABEL } from "@/lib/pilot-plan";
import { getOnboard } from "@/lib/onboard";
import { 할일순서 } from "@/lib/onboard-core.mjs";
import AdminNav from "../../AdminNav";
import SubmitButton from "../../SubmitButton";
import CopyButton from "../../ops/CopyButton";
import ClientForm from "../ClientForm";
import AutoSetupPanel, { type 판줄 } from "./AutoSetupPanel";
import MarketingForm from "../MarketingForm";
import TodoOrder from "../TodoOrder";
import "../clients.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 「다시 점검」·고치기(도메인 바뀜)·자동 세팅 한 단계(≤30초) 서버 동작이 바깥을 연다. 서버 동작 시간 한도 = 이 페이지 maxDuration(next docs)
export const maxDuration = 60;

/**
 * 고객 한 곳(Step 38 → 57). 맨 위 할 일 순서(외부 고객, D256) → 자동 세팅 판(두 칸 등록 고객) → 자세히 접힘: 체크리스트(됨·기다림·사람·해당없음) →
 * 점검 근거 → 자세히(고치기) → 계약 칸(외부·파일럿 없음) → 지우기(시험만).
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

/** 자동 세팅 판 줄 — 시각은 KST, 도는중이면 몇 분 전 */
function 판줄들(auto: Auto, now: number): 판줄[] {
  return 자동단계.map((k) => {
    const s = auto.단계?.[k] ?? { 상태: "대기" as const };
    const t = Date.parse(s.at ?? "");
    return {
      k, 이름: 자동단계말[k], 상태: s.상태, 말: s.말 ?? "", 시각: s.at ? kst(s.at) : "", 시도: s.시도 ?? 0, ...(s.오류 ? { 오류: s.오류 } : {}),
      몇분전: s.상태 === "도는중" && Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : null,
    };
  });
}
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
  // 할 일 순서 — 계약 뒤 순서와 같은 입력(getOnboard)을 읽는다. 코드·자사 고객은 없음
  const 순서 = 코드 ? null : await getOnboard(slug).then((x) => (x ? 할일순서(x) : null));
  const 원장몫 = 줄.filter((x) => x.상태 === "사람").length;
  const 말 = errText(err, f);
  const 값 = 폼값(row);
  const 폼 = Object.fromEntries(Object.entries(값).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "on" : "") : v]));
  const auto = (row.config?.auto ?? null) as Auto | null;
  const 지금 = Date.now();
  const 요약 = auto?.단계 ? 자동요약(auto) : null;
  // 도는중이고 임대(90초) 안 — 다른 곳이 정말 돌리는 중일 때만 판이 5초마다 다시 본다(Step 56)
  const 살아있음 = 자동단계.some((k) => {
    const s = auto?.단계?.[k];
    const t = Date.parse(s?.at ?? "");
    return s?.상태 === "도는중" && Number.isFinite(t) && 지금 - t < 임대초 * 1000;
  });
  const 사이트있음 = !["없음", "플랫폼"].includes(갈래(row));
  // 파일럿 시작 폼 기본값 — 자동 세팅이 읽은 업종·지역·사이트 상태(원장이 고칠 수 있다, 55f)
  const 기본: Record<string, string> = { district: auto?.사실?.지역?.값 ?? "", category: auto?.사실?.업종?.값 ?? "" };
  const [리허설] = row.relation === "외부" && !pilot
    ? await q(`select id from geo.pilots where client_id = $1 and status = '리허설' and paid_on is null`, [row.id]).catch(() => [])
    : [];

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
        <p className="sub">{row.domain ?? "홈페이지 없음"} · {row.relation ?? "외부"} · <Link href="/admin/clients">고객사 목록</Link>{!코드 && <> · <Link href={here + "/onboard"}>계약 뒤 순서</Link></>}</p>
        {saved && <p className="cl-note" role="status">저장했습니다.</p>}
        {checked && <p className="cl-note" role="status">사이트를 다시 열어 봤습니다.</p>}
        {말 && <p className="cl-err" role="alert">{말}</p>}

        {코드 ? (
          <p className="adm-empty">코드로 설정한 고객입니다(academy/clients.mjs). 화면에서 고치지 않습니다.</p>
        ) : (
          <>
            {순서 && <TodoOrder r={순서} />}
            {auto?.단계 && 요약 && (
              <AutoSetupPanel slug={slug} 줄={판줄들(auto, 지금)} 다음={다음단계(auto, new Date(지금), { 실패도: false }) ?? 멈춘단계(auto, new Date(지금))} 끝={요약.끝} 된={요약.된} 살아있음={살아있음}
                사실={{ 업종: auto.사실?.업종?.값 ?? "", 지역: auto.사실?.지역?.값 ?? "" }}
                출처={{ 업종: auto.사실?.업종?.출처 ?? "아직 안 읽음", 지역: auto.사실?.지역?.출처 ?? "아직 안 읽음" }} />
            )}
            <details className="adm-more" id="checks" open={순서 ? undefined : true}>
              <summary>자세히 — 칸별 점검{원장몫 ? ` (원장님 몫 ${원장몫})` : ""}</summary>
              <section className="in" aria-labelledby="ck-h">
              <h2 id="ck-h">세팅 체크리스트</h2>
              <p className="sub">마지막 점검 {kst(d.checkedAt)} · 매시 회사 루프가 24시간 지난 고객을 다시 엽니다</p>
              <ul className="cl-checks" data-testid="checklist">
                {줄.map((x) => (
                  <li key={x.id} className={`cl-row${x.상태 === "사람" ? " human" : ""}`} data-check={x.id} data-state={x.상태}>
                    <span className="k">{x.칸}</span>
                    <span className={`s ${상태반[x.상태]}`}>{x.상태 === "사람" ? "원장님 몫" : x.상태}</span>
                    <span className="m">{x.사람말}</span>
                    {/* 고객에게 가는 글은 보낼글만 복사 칸으로(D232). 할일·고칠것은 원장·Claude 세션이 읽는 글 */}
                    {x.상태 === "사람" && (x.할일 || x.보낼글) && (
                      <div className="todo">
                        {x.보낼글 && (
                          <>
                            <textarea readOnly defaultValue={x.보낼글} aria-label="고객 담당에게 보낼 글" />
                            <div><CopyButton text={x.보낼글} label="보낼 글 복사" /></div>
                          </>
                        )}
                        {x.할일 && <span className="todo-t">{x.할일}</span>}
                        {x.id === "gsc" && (
                          <form action={markGscGranted}>
                            <input type="hidden" name="slug" value={slug} />
                            <SubmitButton className="adm-btn">권한 받음</SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                    {x.고칠것 && (
                      <details className="fix">
                        <summary>고칠 것 — 원장·Claude 세션만 봅니다(고객에게 보내지 않음)</summary>
                        <pre>{x.고칠것}</pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
              <div className="cl-acts">
                {사이트있음 && (
                  <form action={recheckClient}>
                    <input type="hidden" name="slug" value={slug} />
                    <SubmitButton className="adm-btn alt" pendingText="사이트를 여는 중… (20초까지)">다시 점검</SubmitButton>
                  </form>
                )}
                {pilot && <Link href={`/admin/pilots/${pilot.id}`}>파일럿 화면 열기</Link>}
              </div>
              </section>
            </details>

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

            <details className="adm-more" id="detail">
              <summary>자세히 — 이름·판별 말·검색어·도메인 고치기</summary>
              <div className="in">
                <p className="sub">여기서 저장한 판별 말·브랜드·경쟁 검색어는 「원장」 값이 됩니다. 자동 세팅이 다시 돌아도 덮어쓰지 않습니다.</p>
                <ClientForm 값={폼} slug={slug} />
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
                <summary>계약 칸 — 계약하면 입금 받은 날을 넣습니다</summary>
                <div className="in">
                  <p className="sub">입금을 확인한 뒤 넣습니다. 착수·기준선·30일 업무가 생깁니다. 이름·도메인·답에서 찾을 이름은 이 고객 정보에서 씁니다.
                    {리허설 ? " 자동 세팅이 만든 리허설 파일럿을 계약으로 올립니다 — 이미 만든 질문 20개는 그대로 둡니다." : " 질문 20개가 만들어집니다."}</p>
                  <form className="cl-form" action={createPilot}>
                    <input type="hidden" name="client_id" value={row.id} />
                    {PILOT_FIELDS.map(([n, l]) => <label key={n}>{l}<input name={n} required defaultValue={기본[n] ?? ""} /></label>)}
                    {/* 구축 없음이면 30일이 이날부터다(신청서 8행) */}
                    <label>입금 확인일<input type="date" name="paid_on" defaultValue={kstToday()} required /></label>
                    <label>환불 절 서면 전달일<input type="date" name="refund_terms_sent_on" required /></label>
                    <label>필요한 준비
                      <select name="needs_build" defaultValue={auto?.사이트상태 ?? "none"}>
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
