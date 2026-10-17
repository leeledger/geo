"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { registerAuto, type 두칸State } from "@/lib/auto-setup-actions";

/**
 * 새 고객 — 두 칸(Step 55e). 이름과 홈페이지(비워도 됨)만 받는다. 나머지는 고객 화면의 자동 세팅 판이 근거가 있는 것만 채운다.
 * 오류가 나도 친 값은 남는다. 이름이 겹칠 때만 「그래도 등록」 체크가 나온다
 */
function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="adm-btn cl-save" disabled={pending}>
      {pending ? "등록하는 중…" : "등록하고 자동 세팅"}
    </button>
  );
}

export default function NewClientForm() {
  const [state, action] = useActionState<두칸State, FormData>(registerAuto, { 오류: [], 값: {}, n: 0 });
  const v = state.값;
  return (
    <form className="cl-form" action={action} key={state.n} data-testid="new-client">
      {state.오류.length > 0 && (
        <div className="cl-err w2" role="alert">
          {state.오류.map((x) => <p key={x}>{x}</p>)}
        </div>
      )}
      <label>이름<input name="name" defaultValue={v.name ?? ""} maxLength={40} required placeholder="미소치과 송파점" /></label>
      <label>
        홈페이지<small>없으면 비움 · 블로그·플레이스·인스타 주소도 됨</small>
        <input name="homepage" defaultValue={v.homepage ?? ""} maxLength={300} placeholder="miso-dental.co.kr" />
      </label>
      {state.겹침 && (
        <label className="cl-check w2">
          <input type="checkbox" name="allow_dup" defaultChecked={v.allow_dup === "on"} /> 그래도 등록 — 다른 지점이라 이름이 같습니다
        </label>
      )}
      <details className="w2">
        <summary>시험용</summary>
        <label className="cl-check">
          <input type="checkbox" name="test" defaultChecked={v.test === "on"} /> 시험 고객 — 매시 점검·할 일에 안 섞이고, 화면에서 지울 수 있습니다
        </label>
      </details>
      <Save />
    </form>
  );
}
