import LoginForm from "./LoginForm";
import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "관리자", robots: { index: false, follow: false } };

export default async function Login({
  searchParams,
}: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  // 열린 리다이렉트를 막는다. 우리 관리 화면 안으로만 보낸다.
  const dest = to && /^\/admin(\/|$)/.test(to) && !to.startsWith("/admin/login")
    ? to : "/admin/ops";

  if (await isAdmin()) redirect(dest);

  return (
    <div className="adm lgwrap">
      <div className="lgcard">
        <div className="lglab">Cited 사이티드</div>
        <h1>관리자</h1>
        <p className="lgsub">운영 현황과 문의 기록을 보는 곳입니다.</p>
        <LoginForm to={dest} />
      </div>

      <style>{`
        .lgwrap{min-height:100dvh;display:grid;place-items:center;padding:28px}
        .lgcard{width:100%;max-width:360px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:30px 28px 26px}
        .lglab{font-size:14px;color:var(--ink2);margin-bottom:10px}
        .lgcard h1{margin:0 0 7px}
        .lgsub{font-size:14px;color:var(--ink2);margin:0 0 22px}
        .lgform{display:flex;flex-direction:column;gap:14px}
        .lgform label{display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--ink2)}
        .lgform input{width:100%}
        .lgbtn{margin-top:4px;padding:12px;font-size:16px}
        .lgerr{margin:12px 0 0;font-size:14px;color:var(--crit)}
      `}</style>
    </div>
  );
}
