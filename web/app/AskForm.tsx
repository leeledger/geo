"use client";

import { useState } from "react";

/**
 * 상담 신청.
 *
 * 전에는 「상담 신청」 버튼이 mailto:hello@cited.kr 로 갔다. 그 도메인은 아직 안 샀다.
 * 누르면 메일이 허공으로 가는 버튼이 요금표 아래 두 개나 있었다.
 * 리드 API 는 이미 있으니 그리로 보낸다. /admin 리드 큐에 쌓인다.
 */
export default function AskForm({ wants, compact }: { wants: string; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // 허니팟 — 사람에겐 안 보인다
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company, phone, website, wants }),
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
      <p className="leaddone">
        <b>받았습니다.</b> 적어 주신 메일로 답장드립니다.
        홈페이지 주소를 적으셨으면 먼저 진단해 보고 연락드립니다.
      </p>
    );
  }

  return (
    <form className="askrow" onSubmit={submit}>
      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일" aria-label="이메일" required disabled={busy}
      />
      {!compact && (
        <input
          type="text" value={company} onChange={(e) => setCompany(e.target.value)}
          placeholder="회사명 또는 홈페이지" aria-label="회사명" disabled={busy}
        />
      )}
      <input
        type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="전화 (선택)" aria-label="전화" disabled={busy}
      />
      <input
        type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
      />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "보내는 중" : `${wants} 상담`}
      </button>
      {error && <div className="err" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}
