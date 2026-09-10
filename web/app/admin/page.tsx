import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { listLeads, dbEnabled } from "@/lib/leads";
/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(d: string) {
  const t = new Date(d);
  return `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} ` +
         `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const leads = await listLeads(200);

  return (
    <div className="wrap" style={{ paddingTop: 46, paddingBottom: 80 }}>
      <div className="lab">리드 큐</div>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>연락처를 남긴 사람</h1>
      <p className="formnote" style={{ marginBottom: 22 }}>
        {leads.length}건 · 저장소: {dbEnabled ? "Postgres" : "로컬 파일(.data) — 배포 시 유지되지 않습니다"}
        {" · "}사이트 점수가 낮을수록 후킹이 강합니다
      </p>

      {leads.length === 0 ? (
        <div className="result" style={{ padding: 26 }}>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            아직 리드가 없습니다. 랜딩에서 무료 진단을 실행하고 이메일을 남기면 여기 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="result" style={{ overflowX: "auto" }}>
          <table className="lead-table">
            <thead>
              <tr>
                <th>시각</th><th>이메일</th><th>회사</th><th>진단 도메인</th>
                <th style={{ textAlign: "right" }}>점수</th><th>등급</th><th>관심</th><th>상태</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr key={l.id}>
                  <td className="mono" style={{ color: "var(--faint)", whiteSpace: "nowrap" }}>{fmt(l.created_at)}</td>
                  <td><b>{l.email}</b></td>
                  <td>{l.company ?? "—"}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{l.origin?.replace(/^https?:\/\//, "") ?? "—"}</td>
                  <td className="mono" style={{ textAlign: "right",
                    color: l.site_score == null ? "var(--faint)"
                         : l.site_score < 40 ? "var(--crit)"
                         : l.site_score < 60 ? "var(--warn)" : "var(--good)" }}>
                    {l.site_score ?? "—"}
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{l.grade ?? "—"}</td>
                  <td style={{ fontSize: 12.5 }}>{l.wants ?? "—"}</td>
                  <td><span className="pill">{l.status ?? "new"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
