import { redirect } from "next/navigation";
import Link from "next/link";

import { isAdmin } from "@/lib/admin-auth";
import { inqPool } from "@/lib/inquiries";
import { CODE_SLUGS, 체크리스트, 요약, 오류말 } from "@/lib/client-core.mjs";
import AdminNav from "../AdminNav";
import ClientForm from "./ClientForm";
import "./clients.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 등록 서버 동작이 저장 뒤 고객 사이트를 연다(한 주소 8초·전체 20초). 서버 동작 시간 한도는 이 페이지의 maxDuration 이다(next docs maxDuration「Server Actions」)
export const maxDuration = 60;

/**
 * 고객사 — 목록과 등록(Step 38). 고객사를 만드는 곳은 여기 하나다. 파일럿은 고객 상세에서 시작한다.
 * 코드로 설정한 3곳(학원·아이로그·문서딱)은 academy/clients.mjs 에 있어 화면에서 안 고친다.
 */

type Row = { id: number; slug: string; name: string; domain: string | null; relation: string | null; status: string; config: unknown; derived: unknown; pilot: { id: string; status: string; approved: boolean } | null };

async function 목록(): Promise<Row[] | null> {
  try {
    const { rows } = await inqPool().query(
      `select c.id, c.slug, c.name, c.domain, c.relation, c.status, to_jsonb(c)->'config' as config, to_jsonb(c)->'derived' as derived,
              (select json_build_object('id', p.id, 'status', p.status, 'approved', p.questions_approved_at is not null)
                 from geo.pilots p where p.client_id = c.id and p.status <> '리허설' and p.cancelled_on is null order by p.id limit 1) as pilot
         from geo.clients c where c.status <> 'ended' order by c.id`);
    return rows;
  } catch (e) {
    console.error("고객사 목록", e);
    return null;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ key?: string; err?: string; deleted?: string }> }) {
  const { key, err, deleted } = await searchParams;
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent("/admin/clients"));
  if (!(await isAdmin(key))) redirect("/admin/login?to=/admin/clients");
  const rows = await 목록();
  const 말 = err === "pilot-client" ? "파일럿을 붙일 고객을 못 찾았습니다" : err ? 오류말[err] ?? null : null;

  return (
    <main className="adm">
      <div className="w">
        <div className="adm-top">
          <h1>고객사</h1>
          <AdminNav here="/admin/clients" />
        </div>
        {deleted && <p className="cl-note" role="status">시험 고객을 지웠습니다. 붙어 있던 행도 전부 지웠습니다.</p>}
        {말 && <p className="cl-err" role="alert">{말}</p>}

        <section aria-labelledby="cl-h">
          <h2 id="cl-h">고객사{rows && <span className="n"> {rows.length}곳</span>}</h2>
          {!rows ? <p className="adm-empty">고객사 목록을 못 읽었습니다</p> : (
            <div className="cl-list">
              {rows.map((r) => {
                const 코드 = CODE_SLUGS.includes(r.slug);
                const n = 코드 ? null : 요약(체크리스트(r, r.derived, { pilot: r.pilot }));
                const 머리 = (
                  <>
                    <div className="h">{r.name}{r.status === "test" && <span className="cl-tag">시험</span>}</div>
                    <div className="d">{r.domain ?? "도메인 없음"} · {r.relation ?? "외부"}{코드 ? " · 코드 설정 — 화면에서 안 고침" : ""}</div>
                    {n && <div className="d">{n.사람 || n.기다림 ? `사람 ${n.사람} · 기다림 ${n.기다림}` : "세팅 끝"}</div>}
                  </>
                );
                return 코드
                  ? <div className="adm-card" key={r.id}>{머리}</div>
                  : <Link className="adm-card cl-item" href={`/admin/clients/${r.slug}`} key={r.id}>{머리}</Link>;
              })}
            </div>
          )}
        </section>

        <section className="cl-new" aria-labelledby="cl-new-h">
          <h2 id="cl-new-h">새 고객사 등록</h2>
          <p className="sub">저장하면 IndexNow 키를 만들고, 사이트를 바로 열어 robots·사이트맵·llms.txt·JSON-LD·키 파일을 봅니다. 빈 칸은 고객 상세 맨 위 체크리스트가 말합니다.</p>
          <ClientForm mode="new" 값={{ relation: "외부", want_gsc: "on" }} />
        </section>
      </div>
    </main>
  );
}
