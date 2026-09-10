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
    <div className="lgwrap">
      <div className="lgcard">
        <div className="lglab">Cited 사이티드</div>
        <h1>관리자</h1>
        <p className="lgsub">운영 현황과 문의 기록을 보는 곳입니다.</p>
        <LoginForm to={dest} />
      </div>

      <style>{`
        .lgwrap{min-height:100dvh;display:grid;place-items:center;padding:28px}
        .lgcard{width:100%;max-width:360px;background:var(--card,#14161a);
          border:1px solid var(--line,#262a31);border-radius:16px;padding:30px 28px 26px}
        .lglab{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;
          color:var(--mut,#8b94a3);margin-bottom:10px}
        .lgcard h1{font-size:25px;margin:0 0 7px;word-break:keep-all}
        .lgsub{font-size:13.5px;color:var(--mut,#8b94a3);margin:0 0 22px;word-break:keep-all}
        .lgform{display:flex;flex-direction:column;gap:14px}
        .lgform label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;
          color:var(--mut,#8b94a3)}
        .lgform input{background:var(--bg,#0e1013);border:1px solid var(--line,#262a31);
          border-radius:9px;padding:11px 13px;color:var(--fg,#e8ecf1);font-size:15px;width:100%}
        .lgform input:focus{outline:none;border-color:var(--cool,#3DD6C4)}
        .lgbtn{margin-top:4px;background:var(--cool,#3DD6C4);color:#08121a;border:0;
          border-radius:9px;padding:12px;font-size:15px;font-weight:700;cursor:pointer}
        .lgbtn:disabled{opacity:.55;cursor:default}
        .lgerr{margin:12px 0 0;font-size:13px;color:#D2705F;word-break:keep-all}
      `}</style>
    </div>
  );
}
