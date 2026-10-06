"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateMarketing, type FormState } from "@/lib/client-actions";

/**
 * 「바깥 글」 폼(Step 39a). 지식iN·카페·블로그 초안이 쓰는 고객 고유 말. 오류가 나도 친 값은 남는다(ClientForm 과 같은 길).
 * 정규식은 받지 않는다 — 말만 받아 academy/clients.mjs 고객설정이 글자 그대로 바꾼다.
 */
type Props = { 값: Record<string, string>; slug: string };

function Save() {
  const { pending } = useFormStatus();
  return <button type="submit" className="adm-btn cl-save" disabled={pending}>{pending ? "저장 중…" : "바깥 글 저장"}</button>;
}

export default function MarketingForm({ 값: 처음, slug }: Props) {
  const [state, action] = useActionState<FormState, FormData>(updateMarketing, { 오류: [], 값: 처음, n: 0 });
  const v = state.값;
  const 글 = (name: string, label: string, opts: { hint?: string; area?: boolean; max?: number; ph?: string; rows?: number } = {}) => (
    <label className="w2">
      {label}{opts.hint && <small>{opts.hint}</small>}
      {opts.area
        ? <textarea name={name} defaultValue={v[name] ?? ""} rows={opts.rows ?? 4} placeholder={opts.ph} />
        : <input name={name} defaultValue={v[name] ?? ""} maxLength={opts.max ?? 300} placeholder={opts.ph} />}
    </label>
  );
  return (
    <form className="cl-form" action={action} key={state.n} data-testid="marketing-form">
      <p className="sub w2"><b>여기 적은 사실만 글에 들어갑니다. 원장님이 확인한 것만 적어 주세요</b></p>
      {state.오류.length > 0 && (
        <div className="cl-err w2" role="alert">
          {state.오류.map((x) => <p key={x}>{x}</p>)}
        </div>
      )}
      <input type="hidden" name="slug_fixed" value={slug} />
      <label className="cl-check w2">
        <input type="checkbox" name="enabled" defaultChecked={v.enabled === "on"} /> 바깥 글 초안을 씁니다
      </label>
      {글("disclosure", "공개 문장", { hint: "본문 맨 끝에 그대로 붙습니다 · 소속·대가를 밝히는 한 줄", ph: "제가 운영하는 곳의 안내입니다." })}
      {글("facts", "확인한 사실 (한 줄에 하나 · 10줄까지)", { hint: "새 줄에는 저장한 날이 붙습니다 · 비우면 글을 안 씁니다", area: true, rows: 5 })}
      {글("pages", "페이지 (한 줄에 하나)", { hint: "「말1,말2 + 말3 | 안내 경로 | 도구 경로」 · 쉼표는 또는, + 는 그리고 · 검색어에 맞는 줄의 페이지를 근거로 읽습니다", area: true, ph: "pdf + 합치,병합 | /guide/pdf-merge/ | /pdf-merge/" })}
      {글("guide_prefix", "안내 경로 앞부분 (선택)", { hint: "사이트맵에서 안내 글 수를 셉니다 · 비우면 안 셉니다", max: 40, ph: "/guide/" })}
      {글("alternatives", "대안 이름 (선택)", { hint: "쉼표로 · 원문 페이지에 나올 때만 「다른 방법」 후보가 됩니다", ph: "정부24, 한컴" })}
      {글("banned", "금지 말 (선택)", { hint: "쉼표로 · 글에 나오면 떨어뜨립니다(비공개 기능 이름 등)" })}
      {글("persona", "소속 소개 (선택)", { hint: "비우면 「너는 이 고객 쪽 사람이다. 소속을 숨기지 않고 밝힌다」만 씁니다 · 사실 주장은 넣지 않습니다", area: true, rows: 2 })}
      <Save />
    </form>
  );
}
