import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { CODE_SLUGS } from "@/lib/client-core.mjs";
import { markGscGranted } from "@/lib/client-actions";
import { getOnboard } from "@/lib/onboard";
import { saveOnboard } from "@/lib/onboard-actions";
import { 착수순서, type 줄상태 } from "@/lib/onboard-core.mjs";
import AdminNav from "../../../AdminNav";
import SubmitButton from "../../../SubmitButton";
import CopyButton from "../../../ops/CopyButton";
import "../../clients.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 계약 뒤 순서(Step 54d). 계약한 고객 한 곳을 「계약 → 받을 것 → 사이트 → 질문 승인·착수 → 첫 7일 기준선 → 30일 → 30일 판정」 한 줄로.
 * 줄마다 누가 · 지금 상태(DB 근거) · 어디서. 읽기와 「상황 바꾸기」 저장만 — 활동·일감·로그에 쓰지 않는다(D215).
 * 고치기·파일럿 시작·파일럿 계약 칸은 복제하지 않고 링크만(D216).
 */

const 상태반: Record<줄상태, string> = { 됨: "done", "도는 중": "run", "원장님 몫": "human", "고객 기다림": "cust", 아직: "wait", 해당없음: "na", "못 읽음": "bad" };
/** 렌더하는 링크는 http(s) 와 /admin 경로만 */
const 링크됨 = (s?: string | null): s is string => !!s && (/^\/admin(\/|$|#|\?)/.test(s) || /^https?:\/\/[^\s]+$/i.test(s));

const 고름: [string, string, string[]][] = [
  ["dns", "도메인·호스팅을 누가 만지나", ["고객", "우리", "모름"]],
  ["naverSa", "네이버 서치어드바이저", ["아직", "확인파일보냄", "끝", "안씀"]],
  ["bing", "빙 웹마스터", ["아직", "끝", "안씀"]],
  ["blog", "네이버 블로그 계정", ["없음", "안맡김", "받음"]],
  ["migrateState", "블로그 글 이관 상태", ["아직", "진행", "끝"]],
];
const 보기말: Record<string, string> = { 확인파일보냄: "확인 파일 보냄", 안맡김: "있지만 안 맡김", 받음: "받음(우리가 올림)", 우리: "우리(관리 권한 받음)", 고객: "고객 쪽 담당" };

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string; err?: string; saved?: string }>;
}) {
  const { slug } = await params;
  const { key, err, saved } = await searchParams;
  const here = `/admin/clients/${encodeURIComponent(slug)}/onboard`;
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(here));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(here));
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) notFound();

  const 입력 = await getOnboard(slug);
  if (!입력) notFound();
  const row = 입력.row;
  const 코드 = CODE_SLUGS.includes(slug);
  const r = 코드 ? null : 착수순서(입력);
  const ob = (row.config?.onboard ?? {}) as Record<string, any>;
  const ch = (ob.channels ?? {}) as Record<string, string | null>;

  return (
    <main className="adm">
      <div className="w">
        <div className="adm-top">
          <h1>{row.name} · 계약 뒤 순서{row.status === "test" && <span className="cl-tag">시험</span>}</h1>
          <AdminNav here="/admin/clients" />
        </div>
        <p className="sub">
          <Link href={`/admin/clients/${slug}`}>고객 화면</Link>
          {입력.pilot?.id && <> · <Link href={`/admin/pilots/${입력.pilot.id}`}>파일럿 화면</Link></>}
          {" · "}<Link href="/admin/clients">고객사 목록</Link>
        </p>
        {saved && <p className="cl-note" role="status">저장했습니다.</p>}
        {err === "onboard" && <p className="cl-err" role="alert">저장 안 됨 — 고를 수 없는 값이나 틀린 주소·날짜가 있습니다</p>}

        {!r ? (
          <p className="adm-empty">코드로 설정한 고객입니다. 계약 순서가 없습니다</p>
        ) : (
          <>
            {r.띠.length > 0 && (
              <div className="ob-band" data-testid="band">
                {r.띠.map((x) => <p key={x}>{x}</p>)}
              </div>
            )}
            <p className="ob-sum" data-testid="summary">
              원장님 몫 {r.요약.원장} · 고객 기다림 {r.요약.고객}{r.요약.고객최장일 ? `(가장 오래 ${r.요약.고객최장일}일)` : ""} · 자동 {r.요약.자동}
              {r.다음고비 && <> · 다음 고비 <b>{r.다음고비}</b></>}
            </p>

            {r.단계.map((s, i) => (
              <section className="ob-stage" data-stage={s.id} key={s.id} aria-labelledby={`ob-${s.id}`}>
                <h2 id={`ob-${s.id}`}><span className="ob-n">{i + 1}</span>{s.이름}</h2>
                <ul className="ob-rows">
                  {s.줄.map((x) => (
                    <li key={x.id} className={`ob-row ${상태반[x.상태]}`} data-row={x.id} data-state={x.상태} data-who={x.누가}>
                      <span className="ob-k">{x.칸}</span>
                      <span className="ob-who">{x.누가}</span>
                      <span className={`ob-s ${상태반[x.상태]}`}>{x.상태}</span>
                      <span className="ob-m">
                        {x.사람말}
                        {x.근거 && !x.사람말.includes(x.근거) && <small className="ob-ev">{x.근거}</small>}
                        {링크됨(x.링크) && <> <a href={x.링크}>{x.링크.startsWith("/admin") ? "열기" : "보기"}</a></>}
                      </span>
                      {(x.상태 === "원장님 몫" || x.상태 === "고객 기다림") && x.보낼글 && (
                        <div className="ob-todo">
                          <textarea readOnly defaultValue={x.보낼글} aria-label={`${x.칸} — 보낼 글`} />
                          <div><CopyButton text={x.보낼글} label="보낼 글 복사" /></div>
                        </div>
                      )}
                      {x.id === "gsc" && x.상태 === "원장님 몫" && (
                        <div className="ob-todo">
                          <form action={markGscGranted}>
                            <input type="hidden" name="slug" value={slug} />
                            <SubmitButton className="adm-btn">권한 받음</SubmitButton>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <details className="adm-more" id="situation" open={err === "onboard" ? true : undefined}>
              <summary>상황 바꾸기 — 도메인 담당·서치어드바이저·빙·블로그·기존 채널·이관</summary>
              <div className="in">
                <p className="sub">
                  고객 정보는 <Link href={`/admin/clients/${slug}`}>고객 화면 고치기</Link>, 입금·환불·사이트 연 날은{" "}
                  {입력.pilot?.id ? <Link href={`/admin/pilots/${입력.pilot.id}`}>파일럿 화면 계약 칸</Link> : <Link href={`/admin/clients/${slug}#pilot`}>파일럿 시작 폼</Link>}에서 고칩니다.
                </p>
                <form className="cl-form" action={saveOnboard}>
                  <input type="hidden" name="slug" value={slug} />
                  {고름.map(([n, l, 값들]) => (
                    <label key={n}>{l}
                      <select name={n} defaultValue={ob[n] ?? ""}>
                        <option value="">고르지 않음</option>
                        {값들.map((v) => <option key={v} value={v}>{보기말[v] ?? v}</option>)}
                      </select>
                    </label>
                  ))}
                  <label>블로그 로그인 저장한 날<input type="date" name="blogSavedOn" defaultValue={ob.blogSavedOn ?? ""} /></label>
                  <label>시안 보인 날(구축)<input type="date" name="draftShownOn" defaultValue={ob.draftShownOn ?? ""} /></label>
                  <label>세팅 작업 보고 보인 날(세팅)<input type="date" name="setupReportOn" defaultValue={ob.setupReportOn ?? ""} /></label>
                  <label className="w2">블로그 주소<input name="ch_blog" type="url" maxLength={200} defaultValue={ch.blog ?? ""} placeholder="https://blog.naver.com/…" /></label>
                  <label className="w2">플레이스 주소<input name="ch_place" type="url" maxLength={200} defaultValue={ch.place ?? ""} /></label>
                  <label className="w2">SNS 주소<input name="ch_sns" type="url" maxLength={200} defaultValue={ch.sns ?? ""} /></label>
                  <label className="cl-check w2"><input type="checkbox" name="noChannels" defaultChecked={ob.noChannels === true} /> 운영 중인 블로그·플레이스·SNS 가 없습니다</label>
                  <label className="cl-check w2"><input type="checkbox" name="migrate" defaultChecked={ob.migrate === true} /> 블로그 글 이관 계약이 있습니다</label>
                  <SubmitButton className="adm-btn cl-save">상황 저장</SubmitButton>
                </form>
              </div>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
