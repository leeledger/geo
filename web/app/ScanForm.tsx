"use client";

import { useState } from "react";
import type { ScanResult } from "@/lib/scan";
import { CAP_LABEL, PUBLISH_LABEL } from "@/lib/platform";

type Result = ScanResult & { scanId?: string | null };

const PRIO: Record<number, { cls: string; label: string }> = {
  1: { cls: "p1", label: "치명" },
  2: { cls: "p2", label: "중요" },
  3: { cls: "p3", label: "권장" },
};

export default function ScanForm({ id, placeholder }: { id: string; placeholder?: string }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // 결과를 본 뒤 연락처 남기기
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState(""); // 허니팟
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setResult(null); setLeadDone(false); setLeadError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) { setError(data?.error ?? "진단에 실패했습니다."); return; }
      setResult(data as Result);
    } catch {
      setError("네트워크 오류로 진단하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (leadBusy) return;
    setLeadBusy(true); setLeadError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email, company, website, scanId: result?.scanId ?? null,
          site: result?.origin ?? domain, referral: "무료진단", wants: "30일 실행안",
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) { setLeadError(data?.error ?? "저장에 실패했습니다."); return; }
      setLeadDone(true);
    } catch {
      setLeadError("네트워크 오류가 발생했습니다.");
    } finally {
      setLeadBusy(false);
    }
  }

  return (
    <div>
      <form className="form" onSubmit={run}>
        <input
          id={id}
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={placeholder ?? "회사 홈페이지 주소 (예: example.co.kr)"}
          aria-label="홈페이지 주소"
          disabled={busy}
          required
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "진단 중…" : "무료 진단 받기"}
        </button>
      </form>

      {busy && (
        <p className="formnote loading">
          robots.txt, llms.txt, sitemap, 본문 페이지를 받아 7가지를 보고 있습니다. 10~30초 걸립니다.
        </p>
      )}
      {!busy && !result && !error && (
        <p className="formnote">7가지를 자동으로 봅니다. 가입도 결제도 없이 바로 결과가 나옵니다.</p>
      )}
      {error && <p className="err">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-hd">
            <span className="score">{result.total}</span>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>/ 100</span>
            <span className="grade">{result.grade}</span>
            <span className="dom">{result.origin.replace(/^https?:\/\//, "")}</span>
          </div>

          {result.platform && (
            <div className="plat">
              <div className="plat-hd">
                <span className="plat-kind">{result.platform.kind}</span>
                <b>{result.platform.name}</b>
                <span className="plat-ev">{result.platform.evidence}</span>
              </div>
              <div className="plat-caps">
                <span>루트 파일(robots·llms.txt) <b>{CAP_LABEL[result.platform.rootFile]}</b></span>
                <span>구조화 데이터 <b>{CAP_LABEL[result.platform.schema]}</b></span>
                <span>콘텐츠 발행 <b>{PUBLISH_LABEL[result.platform.publish]}</b></span>
                <span>작업 주체 <b>{result.platform.owner}</b></span>
              </div>
            </div>
          )}

          <div className="rows">
            {result.weights.map((w) => (
              <div className="rrow" key={w.key}>
                <span className="l">{w.label}</span>
                <span className="rtrack">
                  <span className="rfill" style={{ width: `${Math.max(1, w.score)}%` }} />
                </span>
                <span className="s">{w.score}</span>
              </div>
            ))}
          </div>

          {result.notes.length > 0 && (
            <div className="fixes">
              <h4>먼저 고칠 것</h4>
              {result.notes.slice(0, 5).map((n, i) => (
                <div className="fix" key={i}>
                  <span className={`p ${PRIO[n.pri].cls}`}>{PRIO[n.pri].label}</span>
                  <span>{n.msg}</span>
                </div>
              ))}
            </div>
          )}

          <div className="result-ft">
            전부 코드로 확인되는 것만 셉니다. 브랜드 인지도 같은 눈으로 판단하는 항목은 점수에 넣지 않았습니다.
            <br />
            <b style={{ color: "var(--ink)" }}>다만 이건 사이트 상태 점수일 뿐, 실제로 AI가 불러주는지와는 다릅니다.</b>{" "}
            저희가 재본 바로는 사이트 점수가 차지하는 몫이 20% 정도였습니다.
            정말 불리는지는 AI에 직접 물어봐야 압니다.
          </div>

          {/* 결과를 본 직후 = 관심이 가장 높은 지점 */}
          <div className="lead">
            {leadDone ? (
              <p className="leaddone">
                접수됐습니다. <b>{email}</b> 로 이 진단에서 먼저 할 3가지를 정리해 드립니다.
                <br />
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  진단한 주소와 점수가 함께 저장돼 다시 설명할 필요가 없습니다.
                </span>
              </p>
            ) : (
              <form onSubmit={submitLead}>
                <h4>이 점수에서 먼저 고칠 3가지만 받으세요</h4>
                <p className="leadsub">
                  진단 주소와 결과가 함께 접수됩니다. 다시 설명할 필요 없이
                  <b>30일 안에 할 일과 확인할 수치</b>를 이메일 한 번으로 정리해 드립니다.
                </p>
                <div className="leadrow">
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="업무용 이메일" aria-label="이메일" required disabled={leadBusy}
                  />
                  <input
                    type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                    placeholder="회사명 (선택)" aria-label="회사명" disabled={leadBusy}
                  />
                  <button className="btn" type="submit" disabled={leadBusy}>
                    {leadBusy ? "접수 중…" : "3가지 실행안 받기"}
                  </button>
                </div>
                {/* 허니팟 — 사람에게는 보이지 않는다 */}
                <input
                  type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
                  name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
                />
                {leadError && <p className="err">{leadError}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
