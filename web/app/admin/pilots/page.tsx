import { redirect } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { listPilots } from "@/lib/pilots";
import { createPilot } from "@/lib/pilot-actions";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 30일 유료 파일럿 — 맨 위는 진행 고객, 결제 고객 등록 폼은 자세히.
 * 등록하면 질문 20개와 Day 0~30 업무 19개가 생긴다(createPilot). 동작은 그대로, 배치와 글자만 바꿨다.
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
`;

const FIELDS: [string, string][] = [
  ["name", "학원명"], ["slug", "영문 관리명"], ["domain", "홈페이지 도메인"], ["district", "구"], ["neighborhood", "동네"],
  ["category", "업종·과목"], ["audience", "주 고객"], ["contact_name", "담당자"], ["contact_email", "담당자 이메일"],
  ["contact_phone", "담당자 전화"], ["receipt_type", "증빙 종류"], ["payment_ref", "입금 확인번호"], ["terms_evidence", "신청서·동의 증거 URL"],
];

const day = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : String(x ?? "").slice(0, 10));

type Pilot = { id: string; name: string; started_on: unknown; ends_on: unknown; done: number; total: number; status: string };

export default async function Page({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent("/admin/pilots"));
  if (!(await isAdmin(key))) redirect("/admin/login?to=/admin/pilots");
  const ps = (await listPilots()) as Pilot[];

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

        <details className="adm-more">
          <summary>자세히 — 결제 고객 등록</summary>
          <div className="in">
            <p className="sub">입금 확인 후 등록합니다. 등록하면 질문 20개와 Day 0~30 업무 19개가 생깁니다.</p>
            <form className="pl-form" action={createPilot}>
              {FIELDS.map(([n, l]) => <label key={n}>{l}<input name={n} required /></label>)}
              <button className="adm-btn">30일 업무 생성</button>
            </form>
          </div>
        </details>
      </div>
    </main>
  );
}
