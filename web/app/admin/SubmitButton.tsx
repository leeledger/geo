"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/**
 * 관리 화면 폼의 제출 버튼. 누르는 순간 「처리 중…」으로 바뀌고 같은 폼의 버튼이 다 잠긴다.
 *
 * 원장(2026-09-24): 「버튼이 너무 느려 눌렸는지도 모르겠다」. 서버 동작은 끝날 때까지 화면에 아무 표시가 없었고,
 * 그사이 한 번 더 누르면 같은 일이 두 번 들어갔다.
 * 한 폼에 버튼이 여럿이면(name·value 로 가르는 네이버 확인) 누른 버튼에만 「처리 중」을 쓴다.
 */
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string };

export default function SubmitButton({ children, pendingText = "처리 중…", name, value, disabled, ...rest }: Props) {
  const { pending, data } = useFormStatus();
  // FormData 에는 누른 버튼의 name=value 가 들어 있다. 이름이 없는 버튼은 폼에 하나뿐이다
  const mine = pending && (!name || data?.get(name) === String(value));
  return (
    <button
      {...rest}
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={mine || undefined}
      data-busy={mine ? "" : undefined}
    >
      {mine ? <><span className="adm-spin" aria-hidden="true" />{pendingText}</> : children}
    </button>
  );
}
