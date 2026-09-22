"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/admin-actions";

/**
 * 로그인 폼.
 *
 * 아이디는 브라우저가 기억하게 두고 비밀번호는 안 남긴다.
 * autoComplete 를 정확히 줘야 비밀번호 관리자가 알아본다.
 */
export default function LoginForm({ to }: { to: string }) {
  const [err, act, busy] = useActionState(signIn, null);

  return (
    <form action={act} className="lgform">
      <input type="hidden" name="to" value={to} />
      <label>
        아이디
        <input name="id" autoComplete="username" autoFocus required />
      </label>
      <label>
        비밀번호
        <input name="pw" type="password" autoComplete="current-password" required />
      </label>
      <button className="adm-btn ok lgbtn" type="submit" disabled={busy}>
        {busy ? "확인하는 중…" : "들어가기"}
      </button>
      {err && <p className="lgerr">{err}</p>}
    </form>
  );
}
