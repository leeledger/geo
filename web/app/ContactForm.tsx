"use client";

import { useState } from "react";

/**
 * 상담 신청 — 긴 폼.
 *
 * 요금표 안의 AskForm 은 이메일 한 칸이다. 여기서는 두 가지를 더 묻는다.
 *   어떻게 알고 오셨는지 — 매출 검증의 유일한 고리. AI 답을 보고 온 사람은 서버 기록에 안 남는다.
 *   무엇이 고민인지 — 첫 답장을 무엇으로 시작할지 정한다.
 * 경로는 고정 목록이다. 자유 입력만 두면 나중에 셀 수가 없다.
 */
const REFERRALS = [
  ["AI", "ChatGPT·Gemini 같은 AI 답변"],
  ["네이버검색", "네이버 검색"],
  ["구글검색", "구글 검색"],
  ["블로그", "블로그·글"],
  ["소개", "지인 소개"],
  ["기타", "기타"],
] as const;

const CONCERNS = [
  "AI 답변에 우리 이름이 안 나온다",
  "경쟁사만 추천된다",
  "홈페이지가 없고 블로그만 있다",
  "지금 상태를 숫자로 알고 싶다",
  "광고 말고 들어오는 문의를 늘리고 싶다",
  "기타",
];

export default function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", phone: "", site: "", competitor: "", referral: "" });
  const [concerns, setConcerns] = useState<string[]>([]);
  const [website, setWebsite] = useState(""); // 허니팟 — 사람에겐 안 보인다
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (c: string) =>
    setConcerns((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, company: f.site, concerns, website, wants: "상담" }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) { setError(data?.error ?? "저장에 실패했습니다."); return; }
      setDone(true);
    } catch {
      setError("네트워크 오류가 났습니다. 잠시 후 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="cdone">
        <b>받았습니다.</b> 적어 주신 메일로 답장드립니다.
        홈페이지 주소를 적으셨으면 먼저 진단해 보고, 그 결과를 들고 연락드립니다.
      </p>
    );
  }

  return (
    <form className="cform" onSubmit={submit}>
      <div className="fld">
        <label htmlFor="cf-name">성함 · 직함</label>
        <input id="cf-name" value={f.name} onChange={set("name")} placeholder="홍길동 · 원장" disabled={busy} autoComplete="name" />
      </div>
      <div className="fld">
        <label htmlFor="cf-email">이메일<i>*</i></label>
        <input id="cf-email" type="email" value={f.email} onChange={set("email")} placeholder="name@company.com" required disabled={busy} autoComplete="email" />
      </div>
      <div className="fld">
        <label htmlFor="cf-phone">연락처<small>선택</small></label>
        <input id="cf-phone" type="tel" value={f.phone} onChange={set("phone")} placeholder="010-0000-0000" disabled={busy} autoComplete="tel" />
      </div>
      <div className="fld">
        <label htmlFor="cf-site">홈페이지 주소<small>없으면 비워 두세요</small></label>
        <input id="cf-site" value={f.site} onChange={set("site")} placeholder="example.com" disabled={busy} />
      </div>
      <div className="fld full">
        <label htmlFor="cf-rival">경쟁사 주소<small>선택</small></label>
        <input id="cf-rival" value={f.competitor} onChange={set("competitor")} placeholder="손님이 우리와 견주는 곳" disabled={busy} />
        <span className="fhint">적어 주시면 같은 질문으로 나란히 비교해 드립니다.</span>
      </div>
      <div className="fld full">
        <label htmlFor="cf-ref">어떻게 알고 오셨어요?<i>*</i></label>
        <select id="cf-ref" value={f.referral} onChange={set("referral")} required disabled={busy}>
          <option value="" disabled>골라 주세요</option>
          {REFERRALS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="fld full" role="group" aria-labelledby="cf-cc">
        <span className="fl" id="cf-cc">지금 가장 걸리는 것<small>여러 개 골라도 됩니다</small></span>
        <div className="checks">
          {CONCERNS.map((c) => (
            <label className="ck" key={c}>
              <input type="checkbox" checked={concerns.includes(c)} onChange={() => toggle(c)} disabled={busy} />
              {c}
            </label>
          ))}
        </div>
      </div>
      <input
        type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
      />
      {error && <div className="err">{error}</div>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "보내는 중" : "상담 신청"}
      </button>
    </form>
  );
}
