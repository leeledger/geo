"use client";

import { useState } from "react";
import type { ScanResult } from "@/lib/scan";
import type { PlatformResult, BotVerdict } from "@/lib/platform-check";
import { CAP_LABEL, PUBLISH_LABEL } from "@/lib/platform";
import { askQuestions, clean, josa, NO_SITE_MAX } from "@/lib/no-site";

type SiteResult = ScanResult & { kind: "site"; scanId?: string | null };
type Result = SiteResult | PlatformResult;

const PRIO: Record<number, { cls: string; label: string }> = {
  1: { cls: "p1", label: "먼저" },
  2: { cls: "p2", label: "다음" },
  3: { cls: "p3", label: "여유 있을 때" },
};

const SAY = (v: boolean | null) => (v === true ? "들어옴" : v === false ? "막힘" : "확인 못 함");

/** 확인 시각 — 서버 시각은 UTC 라 서울 시각으로 바꿔 찍는다 */
function checkedLabel(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day} ${p.hour}:${p.minute} 확인`;
}

/** 봇 한 줄의 판정. 호스트 둘(PC·모바일)이 다르면 둘 다 적는다 */
function botSay(r: PlatformResult, id: string) {
  const per = r.hosts.map((h) => [h.label, h.bots.find((b) => b.id === id)] as const);
  const first = per[0]?.[1] as BotVerdict | undefined;
  if (first?.self) return `${r.platform.name} 자체 검색 — 이 규칙으로 판단 못 함`;
  const vals = per.map(([, b]) => b?.allowed ?? null);
  if (vals.every((v) => v === vals[0])) return SAY(vals[0]);
  return per.map(([label, b]) => `${(label ?? "").replace(" 주소", "")} ${SAY(b?.allowed ?? null)}`).join(" · ");
}

export default function ScanForm({ id }: { id: string }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // 결과를 본 뒤 연락처 남기기
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // 허니팟
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // 주소가 없을 때 — 질문 세 개는 이 화면에서 만든다(네트워크 없음)
  const [noSite, setNoSite] = useState(false);
  const [nsName, setNsName] = useState("");
  const [nsArea, setNsArea] = useState("");
  const [nsIndustry, setNsIndustry] = useState("");
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const shopName = clean(nsName, NO_SITE_MAX.name);

  const resetLead = () => { setLeadDone(false); setLeadError(null); };

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setResult(null); setNoSite(false); resetLead();
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
      setError("네트워크 오류로 진단하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function sendLead(payload: Record<string, unknown>) {
    if (leadBusy) return;
    setLeadBusy(true); setLeadError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website, referral: "무료진단", ...payload }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) { setLeadError(data?.error ?? "저장에 실패했습니다."); return; }
      setLeadDone(true);
    } catch {
      setLeadError("네트워크 오류가 났습니다. 다시 눌러 주세요.");
    } finally {
      setLeadBusy(false);
    }
  }

  function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (result?.kind === "platform") {
      sendLead({ company, source: "platform_check", site: result.url });
    } else {
      sendLead({ company, scanId: result?.scanId ?? null, site: result?.origin ?? domain, wants: "30일 실행안" });
    }
  }

  function submitNoSite(e: React.FormEvent) {
    e.preventDefault();
    sendLead({ source: "no_site", company: nsName, area: nsArea, industry: nsIndustry, phone });
  }

  function makeQuestions(e: React.FormEvent) {
    e.preventDefault();
    setQuestions(askQuestions(nsName, nsArea, nsIndustry));
    setCopied(null); resetLead();
  }

  /** 세 칸 중 하나라도 바뀌면 만든 질문·접수 상태를 지운다 */
  const nsField = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value); setQuestions(null); setCopied(null); resetLead();
  };

  async function copy(i: number, el: HTMLElement | null) {
    try {
      await navigator.clipboard.writeText(questions![i]);
      setCopied(i);
    } catch {
      // 복사가 막힌 브라우저 — 글자를 골라 둬서 길게 눌러 복사하게 한다
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
    }
  }

  const honeypot = (
    <input
      type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
      name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
    />
  );

  const contactForm = (title: string, sub: React.ReactNode, button: string) => (
    <form onSubmit={submitLead}>
      <h4>{title}</h4>
      <p className="leadsub">{sub}</p>
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
          {leadBusy ? "접수 중…" : button}
        </button>
      </div>
      {/* 허니팟 — 사람에게는 보이지 않는다 */}
      {honeypot}
      {leadError && <p className="err">{leadError}</p>}
    </form>
  );

  return (
    <div>
      <form className="form" onSubmit={run}>
        <input
          id={id}
          type="text"
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setError(null); setResult(null); resetLead(); }}
          placeholder="홈페이지·블로그·인스타그램 주소"
          aria-label="주소"
          disabled={busy}
          required
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "진단 중…" : "무료 진단 받기"}
        </button>
      </form>

      {busy && (
        <p className="formnote loading">
          주소를 읽어 보고 있습니다. 창을 닫지 말고 기다려 주세요.
        </p>
      )}
      {!busy && !result && !noSite && (
        <p className="formnote">
          블로그·인스타그램·플레이스 주소도 됩니다. 가입·결제 없음.
          <button type="button" className="linkbtn" onClick={() => { setNoSite(true); setError(null); resetLead(); }}>
            주소가 없어요
          </button>
        </p>
      )}
      {error && <p className="err">{error}</p>}

      {/* 길 C — 주소가 없을 때 */}
      {noSite && !busy && !result && (
        <div className="result ns">
          <form className="ns-make" onSubmit={makeQuestions}>
            <div className="leadrow">
              <input type="text" value={nsName} onChange={nsField(setNsName)} placeholder="상호" aria-label="상호" maxLength={40} required />
              <input type="text" value={nsArea} onChange={nsField(setNsArea)} placeholder="지역 (예: 송파구)" aria-label="지역" maxLength={20} required />
              <input type="text" value={nsIndustry} onChange={nsField(setNsIndustry)} placeholder="업종 (예: 코딩학원)" aria-label="업종" maxLength={20} required />
              <button className="btn" type="submit">질문 만들기</button>
            </div>
          </form>

          {questions && (
            <>
              <ol className="ns-q">
                {questions.map((q, i) => (
                  <li key={i}>
                    <span className="q" id={`${id}-q${i}`}>{q}</span>
                    <button type="button" className="ns-copy" onClick={() => copy(i, document.getElementById(`${id}-q${i}`))}>
                      {copied === i ? "복사됨" : "복사"}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="ns-how">
                ChatGPT 에 그대로 붙여 넣어 보세요. 1·2번 답에 {shopName}{josa(shopName, "이", "가")} 나오는지 보면 됩니다.
                3번은 AI 가 우리 가게를 아는지 보는 질문입니다.
              </p>
              <div className="lead">
                {leadDone ? (
                  <p className="leaddone">접수됐습니다. <b>{email}</b> 로 보내 드립니다.</p>
                ) : (
                  <form onSubmit={submitNoSite}>
                    <h4>사이티드가 물어봐 드릴까요?</h4>
                    <p className="leadsub">같은 질문을 ChatGPT·Perplexity·Gemini·Claude 에 물어 답 원문을 메일로 보내 드립니다.</p>
                    <div className="leadrow">
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="이메일" aria-label="이메일" required disabled={leadBusy}
                      />
                      <input
                        type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="전화 (선택)" aria-label="전화" disabled={leadBusy}
                      />
                      <button className="btn" type="submit" disabled={leadBusy}>
                        {leadBusy ? "접수 중…" : "물어봐 주세요"}
                      </button>
                    </div>
                    {honeypot}
                    {leadError && <p className="err">{leadError}</p>}
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 길 B — 블로그·SNS·플레이스. 점수 없음 */}
      {result?.kind === "platform" && (
        <div className="result pres">
          <div className="result-hd">
            <b className="pname">{result.platform.name}</b>
            <span className="dom">{result.url.replace(/^https?:\/\//, "")}</span>
          </div>
          <div className="pres-lines">
            {result.lines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
          {result.hosts.length > 0 && (
            <div className="pbots">
              {result.hosts[0].bots.map((b) => (
                <div className="pbot" key={b.id}>
                  <span>{b.plain}</span>
                  <b>{botSay(result, b.id)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="result-ft">{checkedLabel(result.checkedAt)}</div>
          <div className="lead">
            {leadDone ? (
              <p className="leaddone">접수됐습니다. <b>{email}</b> 로 정리해 드립니다.</p>
            ) : contactForm(
              "블로그·SNS 만 있을 때 할 일을 받으세요",
              "진단한 주소가 함께 접수됩니다. 이메일 한 번으로 정리해 드립니다.",
              "할 일 받기",
            )}
          </div>
        </div>
      )}

      {/* 길 A — 홈페이지 */}
      {result?.kind === "site" && (
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
                <span>사이트에 파일 올리기 <b>{CAP_LABEL[result.platform.rootFile]}</b></span>
                <span>AI가 읽는 이름표 넣기 <b>{CAP_LABEL[result.platform.schema]}</b></span>
                <span>글 올리기 <b>{PUBLISH_LABEL[result.platform.publish]}</b></span>
                <span>손댈 사람 <b>{result.platform.owner}</b></span>
              </div>
            </div>
          )}

          <div className="rows">
            {/* 점수에 안 넣는 항목(가중치 0)은 화면에서 뺀다. 응답에는 남아 있다 */}
            {result.weights.filter((w) => w.weight > 0).map((w) => (
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
            저희가 잰 한 업계에서는 홈페이지 19점 회사가 80점 회사보다 AI 답에 더 자주 나왔습니다.
            불리는지는 AI 에 직접 물어봐야 압니다.
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
            ) : contactForm(
              "이 점수에서 먼저 고칠 3가지만 받으세요",
              <>진단 주소와 결과가 함께 접수됩니다. 다시 설명할 필요 없이 <b>30일 안에 할 일과 확인할 수치</b>를 이메일 한 번으로 정리해 드립니다.</>,
              "3가지 실행안 받기",
            )}
          </div>
        </div>
      )}
    </div>
  );
}
