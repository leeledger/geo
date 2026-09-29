import { redirect } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { listPilots } from "@/lib/pilots";
import { createPilot } from "@/lib/pilot-actions";
import { NEEDS_BUILD, NEEDS_BUILD_LABEL } from "@/lib/pilot-plan";
import { listClients } from "@/lib/ops";
import { listHours, hourSums, hm } from "@/lib/hours";
import { addHours } from "@/lib/hours-actions";
import AdminNav from "../AdminNav";
import SubmitButton from "../SubmitButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 30일 유료 파일럿 — 맨 위는 진행 고객, 결제 고객 등록 폼은 자세히.
 * 등록하면 질문 20개와 신청서 「제공」·SOP 회차 업무 13개(구축·세팅이면 14개)가 생긴다(createPilot, lib/pilot-plan.ts).
 */

const CSS = `
.pl-list{display:grid;gap:8px}
.pl-item{display:block;text-decoration:none}
.adm .pl-item{color:var(--ink)}
.pl-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.pl-form label{font-size:14px;color:var(--ink2);display:grid;gap:4px}
.pl-form input{width:100%}
.pl-form .adm-btn{grid-column:1/-1;padding:12px;font-size:16px}
@media(max-width:640px){.pl-form{grid-template-columns:1fr}}
.hr-clients{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.hr-clients a{border:1px solid var(--line);border-radius:999px;padding:5px 14px;font-size:14px;font-weight:700;color:var(--ink2);text-decoration:none;background:var(--sunk);word-break:keep-all}
.hr-clients a[aria-current="page"]{border-color:var(--cool);color:var(--ink)}
.hr-f{display:grid;grid-template-columns:150px 110px 1fr auto;gap:10px;align-items:end;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.hr-f label{font-size:14px;color:var(--ink2);display:grid;gap:4px}
.hr-f input{width:100%}
.hr-f .adm-btn{padding:10px 18px;font-size:15px}
.hr-list{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px}
.hr-list li{font-size:15px;color:var(--ink2);word-break:keep-all}
.hr-list b{color:var(--ink)}
@media(max-width:640px){.hr-f{grid-template-columns:1fr 1fr}.hr-f .w2{grid-column:1/-1}}
`;
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

const FIELDS: [string, string][] = [
  ["name", "상호"], ["slug", "영문 관리명"], ["domain", "홈페이지 도메인"],
  // AI 답에서 이 고객을 찾는 말. 정규식은 받지 않는다(web/lib/answer-pattern.ts). 흔한 이름이면 도메인·지점명을 넣는다
  ["answer_terms", "답에서 찾을 이름 (쉼표로 여러 개 · 예: ○○수학학원, example.kr)"],
  ["district", "구"], ["neighborhood", "동네"],
  // 학원·교습소·공부방·교실·과외가 들어가면 학원 질문·교육청 점검이 붙는다(lib/pilot-intake.ts)
  ["category", "업종 (학원이면 「수학학원」처럼 학원까지 · 예: 치과)"], ["audience", "주 고객"], ["contact_name", "담당자"], ["contact_email", "담당자 이메일"],
  ["contact_phone", "담당자 전화"], ["receipt_type", "증빙 종류"], ["payment_ref", "입금 확인번호"], ["terms_evidence", "신청서·동의 증거 URL"],
  ["biz_type", "사업자 유형"],
];

const day = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : String(x ?? "").slice(0, 10));

type Pilot = { id: string; name: string; started_on: unknown; ends_on: unknown; done: number; total: number; status: string };

export default async function Page({ searchParams }: { searchParams: Promise<{ key?: string; c?: string }> }) {
  const { key, c } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent("/admin/pilots"));
  if (!(await isAdmin(key))) redirect("/admin/login?to=/admin/pilots");
  const ps = (await listPilots()) as Pilot[];
  const clients = await listClients();
  const client = clients.find((x) => x.slug === c) ?? clients[0] ?? null;
  let hours: Awaited<ReturnType<typeof listHours>> = [];
  let sums: Awaited<ReturnType<typeof hourSums>> = [];
  let hoursErr = false;
  try {
    [hours, sums] = await Promise.all([client ? listHours(client.id) : Promise.resolve([]), hourSums()]);
  } catch (e) {
    console.error("client_hours", e);
    hoursErr = true;
  }

  return (
    <main className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>30일 유료 파일럿</h1>
          <AdminNav here="/admin/pilots" />
        </div>

        <section className="adm-todo" aria-labelledby="pl-h">
          <h2 id="pl-h">진행 고객{ps.length > 0 && <span className="n"> {ps.length}곳</span>}</h2>
          {ps.length === 0 ? <p className="none">없음 — 아직 결제한 고객이 없습니다. 입금을 확인하면 아래 자세히에서 등록합니다</p> : (
            <div className="pl-list">
              {ps.map((x) => (
                <Link className="adm-card pl-item" href={`/admin/pilots/${x.id}`} key={x.id}>
                  <div className="h">{x.name}</div>
                  <div className="d">{day(x.started_on)} → {day(x.ends_on)} · 업무 {x.done}/{x.total} 완료 · {x.status}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <h2>투입 시간</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          고객마다 오늘 한 일과 걸린 분을 한 줄 남깁니다. 원가를 알아야 가격과 받을 수 있는 고객 수를 정합니다.
        </p>
        {clients.length > 1 && (
          <nav className="hr-clients" aria-label="고객사">
            {clients.map((x) => (
              <Link key={x.id} href={`/admin/pilots?c=${x.slug}`} aria-current={x.id === client?.id ? "page" : undefined}>{x.name}</Link>
            ))}
          </nav>
        )}
        {client && (
          <form className="hr-f" action={addHours}>
            <input type="hidden" name="client_id" value={client.id} />
            <label>날짜<input type="date" name="day" defaultValue={kstToday()} /></label>
            <label>분<input type="number" name="minutes" min={1} max={1440} step={1} required inputMode="numeric" placeholder="40" /></label>
            <label className="w2">한 일<input type="text" name="what" required maxLength={200} placeholder="기준선 보고서 정리" /></label>
            <SubmitButton className="adm-btn">적기</SubmitButton>
          </form>
        )}
        {hoursErr ? <p className="sub" style={{ color: "var(--crit)" }}>투입 시간을 못 읽었습니다</p> : (
          <ul className="hr-list">
            {clients.map((x) => {
              const s = sums.find((y) => y.clientId === x.id);
              return (
                <li key={x.id}>
                  <b>{x.name}</b> 누적 {s ? `${hm(s.minutes)} · ${s.days}일 (${md(s.first!)}~${md(s.last!)})` : "기록 없음"}
                </li>
              );
            })}
            {client && hours.length > 0 && <li style={{ marginTop: 6 }}><b>{client.name} 최근 기록</b></li>}
            {hours.slice(0, 10).map((h) => (
              <li key={h.id}>{md(h.day)} · {hm(h.minutes)} · {h.what}</li>
            ))}
          </ul>
        )}

        <details className="adm-more">
          <summary>자세히 — 결제 고객 등록</summary>
          <div className="in">
            <p className="sub">입금 확인 후 등록합니다. 등록하면 질문 20개와 착수·기준선·30일 업무가 생깁니다.</p>
            <form className="pl-form" action={createPilot}>
              {FIELDS.map(([n, l]) => <label key={n}>{l}<input name={n} required /></label>)}
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
              <SubmitButton className="adm-btn">30일 업무 생성</SubmitButton>
            </form>
          </div>
        </details>
      </div>
    </main>
  );
}
