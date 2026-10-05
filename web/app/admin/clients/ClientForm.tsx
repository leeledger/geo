"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { registerClient, updateClient, type FormState } from "@/lib/client-actions";

/**
 * 고객사 등록·고치기 폼(Step 38). 오류가 나도 친 값은 그대로 남는다 — 서버 동작이 값을 돌려주고, n 이 바뀌면 칸을 그 값으로 다시 그린다.
 * 정규식은 받지 않는다. 말만 받아 서버(client-core.mjs answerPattern)가 글자 그대로 바꾼다.
 */
type Props = { mode: "new" | "edit"; 값: Record<string, string>; slug?: string };

function Save({ mode }: { mode: Props["mode"] }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="adm-btn cl-save" disabled={pending}>
      {pending ? (mode === "new" ? "저장하고 사이트를 여는 중… (20초까지)" : "저장 중…") : mode === "new" ? "등록하고 세팅 점검" : "고친 것 저장"}
    </button>
  );
}

export default function ClientForm({ mode, 값: 처음, slug }: Props) {
  const [state, action] = useActionState<FormState, FormData>(mode === "new" ? registerClient : updateClient, { 오류: [], 값: 처음, n: 0 });
  const v = state.값;
  const 글 = (name: string, label: string, opts: { hint?: string; area?: boolean; max?: number; wide?: boolean; ph?: string } = {}) => (
    <label className={opts.wide ? "w2" : undefined}>
      {label}{opts.hint && <small>{opts.hint}</small>}
      {opts.area
        ? <textarea name={name} defaultValue={v[name] ?? ""} rows={4} placeholder={opts.ph} />
        : <input name={name} defaultValue={v[name] ?? ""} maxLength={opts.max ?? 300} placeholder={opts.ph} />}
    </label>
  );
  return (
    <form className="cl-form" action={action} key={state.n}>
      {state.오류.length > 0 && (
        <div className="cl-err w2" role="alert">
          {state.오류.map((x) => <p key={x}>{x}</p>)}
        </div>
      )}
      {mode === "edit" && <input type="hidden" name="slug_fixed" value={slug} />}
      {글("name", "이름", { max: 40, ph: "미소치과" })}
      {mode === "new"
        ? 글("slug", "영문 관리명", { hint: "영문 소문자·숫자·- · 나중에 못 바꿉니다", max: 40, ph: "miso-dental" })
        : <label>영문 관리명<small>바꾸지 않습니다</small><input value={slug} readOnly /></label>}
      {글("domain", "홈페이지 도메인", { ph: "miso-dental.co.kr", max: 260 })}
      <label>
        자사·외부
        <select name="relation" defaultValue={v.relation ?? "외부"}>
          <option value="외부">외부 — 돈을 받는 고객</option>
          <option value="자사">자사 — 원장님 소유</option>
        </select>
      </label>
      {글("answer_terms", "AI 답에서 찾을 이름", { hint: "쉼표로 여러 개 · 흔한 이름이면 도메인·지점명도", wide: true, ph: "미소치과, miso-dental.co.kr" })}
      {글("answer_exclude", "세지 않을 앞말 (선택)", { hint: "남의 이름 안에 우리 이름이 들어 있을 때 · 쉼표로", wide: true, ph: "행복한" })}
      {글("compete", "경쟁 검색어 3~8개", { hint: "한 줄에 하나 · 이름 없이 손님이 검색창에 치는 말", area: true, wide: true, ph: "송파 치과 추천\n잠실 임플란트\n석촌역 치과" })}
      {글("brand", "브랜드 검색어 (선택)", { hint: "한 줄에 하나 · 비우면 이름 그대로", area: true, wide: true })}
      {글("address_part", "주소 일부 (선택)", { hint: "남의 페이지에 우리가 올라 있나 볼 때", max: 40, ph: "석촌동 274-8" })}
      {글("phone_last4", "전화 끝 4자리 (선택)", { max: 4, ph: "0525" })}
      <label className="cl-check w2">
        <input type="checkbox" name="want_gsc" defaultChecked={v.want_gsc === "on"} /> 구글 색인 요청을 씁니다 (구글 서치콘솔 권한을 받습니다)
      </label>
      {mode === "new" && (
        <label className="cl-check w2">
          <input type="checkbox" name="test" defaultChecked={v.test === "on"} /> 시험 고객 — 매시 점검·할 일에 안 섞이고, 화면에서 지울 수 있습니다
        </label>
      )}
      <Save mode={mode} />
    </form>
  );
}
