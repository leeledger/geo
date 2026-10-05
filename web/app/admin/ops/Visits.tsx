import { addDays, delta } from "@/lib/growth";
import type { RefKind } from "@/lib/visit";
import type { Visits as V } from "@/lib/visits";
import CoverageChart, { type CovSeries } from "./CoverageChart";
import { Word } from "./Growth";

/**
 * 고객사 사이트 사람 방문 (Step 29 D32). 숫자는 geo.site_visits 에서만 — 기록 전 날짜는 그리지 않는다.
 * 차트는 답변 색인 차트(CoverageChart)를 그대로, 색은 Growth.tsx 계열색 앞의 둘.
 * 카드 문구 틀(머리문장·비교 줄·Word)은 Growth.tsx 를 따른다.
 */

const KIND_NAME: Record<Exclude<RefKind, "internal">, string> = {
  ai: "AI 답변", search: "검색", sns: "SNS·블로그·카페", direct: "바로 (출처 없음)", other: "기타 사이트",
};
/** lib/visit.ts AI 표의 대표 주소 → 사람 이름. 표에 없는 주소는 주소 그대로 */
const AI_NAME: Record<string, string> = {
  "chatgpt.com": "ChatGPT", "perplexity.ai": "Perplexity", "gemini.google.com": "Gemini", "claude.ai": "Claude",
  "copilot.microsoft.com": "Copilot", "chat.deepseek.com": "DeepSeek", "grok.com": "Grok", "wrtn.ai": "뤼튼",
  "clova-x.naver.com": "클로바X",
};

/**
 * 사이트 안 기록 장치를 일부러 달지 않는 고객(academy/clients.mjs siteLog — Step 32 D44). 기록이 없을 때 이 말로 적는다.
 * 문서딱은 정적 사이트이고 추적·제3자 스크립트를 넣지 않기로 했다. 서버 숫자는 문서딱 저장소의 주간 성장 리포트(Step 36, 아래 카드)에서 본다
 */
const NO_SITE_LOG: Record<string, string> = {
  docttak: "문서딱은 사이트에 방문 기록 장치를 달지 않습니다(정적 사이트·추적 스크립트 없음). Cloudflare 주간 합계는 아래 「문서딱 주간 성장」 카드에 있습니다 — 봇이 섞인 서버 숫자입니다.",
};

const CSS = `
.vs-h3{font-size:17px;font-weight:800;margin:22px 0 8px;color:var(--ink)}
.vs-now{font-size:21px;font-weight:700;line-height:1.45;letter-spacing:-.02em;margin:0 0 4px;color:var(--ink);word-break:keep-all}
.vs-now b{font-weight:900}
.vs-now .vs-s{font-size:16px;font-weight:600;color:var(--ink2);letter-spacing:0}
.vs-cmp{font-size:16px;color:var(--ink2);margin:0 0 14px;word-break:keep-all}
.vs-bars{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.vs-bars li{display:grid;grid-template-columns:minmax(0,150px) 1fr 48px;gap:10px;align-items:center;font-size:15px;color:var(--ink2)}
.vs-bars .t{height:8px;border-radius:4px;background:var(--soft);overflow:hidden}
.vs-bars .t i{display:block;height:100%;background:var(--cool)}
.vs-bars b{color:var(--ink);font-weight:800;text-align:right;font-variant-numeric:tabular-nums}
.vs-ai{font-size:16px;color:var(--ink2);margin:10px 0 0;word-break:keep-all}
.vs-ai b{color:var(--ink);font-weight:800}
`;

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const n = (v: number) => v.toLocaleString("ko-KR");
/** 한글 주소는 %ED%95… 로 저장된다 — 읽을 수 있게 푼다 */
const readable = (p: string) => {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
};

export default function Visits({ v, err, name, slug }: { v: V | null; err?: string; name: string; slug?: string }) {
  const noLog = slug ? NO_SITE_LOG[slug] : undefined;
  return (
    <section className="gr gr-card" aria-labelledby="vis-h">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h2 id="vis-h">사람 방문 — {name}</h2>
      {!v ? <p className="gr-empty">확인 못함 — {err ?? "이유 모름"}</p>
        : !v.since ? (
          <p className="d">아직 기록이 없습니다. 사이트에 방문 기록이 붙은 날부터 셉니다 — 그 전 숫자는 없습니다.</p>
        ) : <Body v={v} since={v.since} />}
    </section>
  );
}

function Body({ v, since }: { v: V; since: string }) {
  const w = v.week;
  const todayRow = v.days.find((d) => d.day === v.today);
  const max = Math.max(0, ...v.days.map((d) => d.views));
  const series: CovSeries[] = [
    { vendor: "visitors", label: "방문자", color: "#1F9E90", unit: "명", points: v.days.map((d) => ({ day: d.day, pages: d.visitors })) },
    { vendor: "views", label: "페이지뷰", color: "#7C8AF2", unit: "회", points: v.days.map((d) => ({ day: d.day, pages: d.views })) },
  ];
  const kindMax = Math.max(0, ...v.kinds.map((k) => k.n));
  const aiTotal = v.ai.reduce((a, x) => a + x.n, 0);

  return <>
    <p className="d">
      {md(since)} 부터 셈 — 그 전은 없음. 사람이 페이지를 연 횟수만 셉니다(로봇·미리 가져오기 뺌).
      사이트 안에서 링크로 옮겨 다닌 것은 대부분 안 잡힙니다. 방문자는 그날 안에서만 같은 사람으로 묶어,
      7일 방문자는 날마다 센 수의 합입니다.
    </p>

    {w.visitors === null || w.views === null ? (
      <p className="vs-now">오늘 지금까지 방문자 <b>{n(todayRow?.visitors ?? 0)}명</b> · 페이지뷰 {n(todayRow?.views ?? 0)}회</p>
    ) : <>
      <p className="vs-now">
        어제까지 7일 방문자 <b>{n(w.visitors)}명</b> · 페이지뷰 {n(w.views)}회
        {w.partialDays !== null && <span className="vs-s"> · 기록 {w.partialDays}일치</span>}
      </p>
      <p className="vs-cmp">
        {w.prevVisitors === null || w.prevViews === null
          ? <><span className="gw mut">아직 비교 전</span> — {md(addDays(since, 13))} 이 지나면 그 전 7일과 비교됩니다</>
          : <>그 전 7일 {n(w.prevVisitors)}명 · {n(w.prevViews)}회 <Word d={delta(w.visitors, w.prevVisitors, "up")} /></>}
        {" · "}오늘 지금까지 {n(todayRow?.visitors ?? 0)}명
      </p>
    </>}

    {max === 0
      ? <p className="gr-empty">최근 {v.days.length}일 방문 0</p>
      : <CoverageChart total={max} series={series} what="날짜별 사람 방문자와 페이지뷰" table={false} />}

    <h3 className="vs-h3">어디서 왔나 — 최근 30일 (사이트 안 이동 뺌)</h3>
    <ul className="vs-bars">
      {v.kinds.map((k) => (
        <li key={k.kind}>
          <span>{KIND_NAME[k.kind as Exclude<RefKind, "internal">]}</span>
          <span className="t"><i style={{ width: kindMax ? `${(k.n / kindMax) * 100}%` : 0 }} /></span>
          <b>{n(k.n)}</b>
        </li>
      ))}
    </ul>
    <p className="vs-ai">
      {aiTotal === 0 ? "AI 답변에서 들어온 기록 0"
        : <>AI 답변에서 들어온 곳 — {v.ai.map((x, i) => (
          <span key={x.host}>{i ? " · " : ""}{AI_NAME[x.host] ?? x.host} <b>{n(x.n)}</b></span>
        ))}</>}
    </p>

    <h3 className="vs-h3">많이 본 페이지 — 최근 30일</h3>
    <div className="ops-tw">
      <table>
        <thead><tr><th>주소</th><th>페이지뷰</th></tr></thead>
        <tbody>
          {v.pages.map((p) => (
            <tr key={p.path}><td style={{ overflowWrap: "anywhere" }}>{readable(p.path)}</td><td className="m">{n(p.n)}</td></tr>
          ))}
          {!v.pages.length && <tr><td colSpan={2}>0</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
