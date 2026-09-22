import Link from "next/link";
import type { ReactNode } from "react";

import type { Client } from "@/lib/ops";
import { addDays, delta, type Delta, type Growth as G } from "@/lib/growth";
import CoverageChart, { type CovSeries } from "./CoverageChart";

/**
 * 현황판 맨 위 「성장 — 늘고 있나」.
 *
 * 지표마다 지금 값 · 같은 조건 이전 값 대비 변화 · 추세선 · 뜻 / 좋아지려면.
 * 증감률(%)은 쓰지 않는다 — 작은 수에서 +300% 같은 소리가 나온다. 절대 차와 이전 값만.
 * 변화 색은 상태색(--ok/--crit/--mut)이고 기호와 글자가 같이 간다. 색만으로 뜻을 싣지 않는다.
 */

/** 계열색. 검증된 셋만, 순서 고정 — 넷째를 만들지 않는다 (validate_palette: 밝은·어두운 판 모두 통과) */
const SERIES_COLOR: Record<string, string> = { google: "#1F9E90", naver: "#7C8AF2", microsoft: "#C27A14" };
const RIVAL_NAME: Record<string, string> = { naver_all: "네이버 통합", naver: "네이버 웹문서", bing: "빙" };

const CSS = `
.gr{margin-top:6px}
.gr h2{margin-top:34px}
.gr .sub{word-break:keep-all}
.gr-verdict{background:var(--sunk);border:1px solid var(--line);border-radius:12px;padding:12px 16px;
  font-size:14px;color:var(--ink2);word-break:keep-all;line-height:1.6}
.gr-verdict b{color:var(--ink);font-weight:800}
.gr-verdict .n{font-weight:800;color:var(--ink);margin-left:3px}
.gr-verdict small{color:var(--mut);font-size:12px;margin-left:4px}
.gr-verdict .sep{color:var(--faint);margin:0 8px}
.gr-eb{font-size:11.5px;letter-spacing:.06em;color:var(--mut);font-weight:700;margin:20px 0 8px;word-break:keep-all}
.gr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px}
.gr-cell .gr-eb{margin-top:0}
.gr-grid.more{margin-top:20px}
@media(min-width:900px){.gr-tile.wide{grid-column:span 2}}
.gr-pairs .gr-line{font-size:12px;color:var(--ink2)}
.gr-pairs .gr-line b{font-weight:700;color:var(--ink)}
.gr-tile{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 17px;
  display:flex;flex-direction:column;gap:7px;min-width:0;word-break:keep-all;height:100%;box-sizing:border-box}
.gr-name{font-size:13px;font-weight:700;color:var(--ink2);display:flex;gap:7px;align-items:baseline;flex-wrap:wrap}
.gr-tag{font-size:10.5px;font-weight:600;color:var(--mut);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.gr-val{font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--ink);line-height:1.15}
.gr-val small{font-size:13px;font-weight:600;color:var(--mut);margin-left:5px;letter-spacing:0}
.gr-val.none{font-size:18px;color:var(--mut);font-weight:700}
.gr-ch{font-size:12.5px;font-weight:600;line-height:1.45}
.gr-ch.ok{color:var(--ok)} .gr-ch.crit{color:var(--crit)} .gr-ch.mut{color:var(--mut)}
.gr-ch em{font-style:normal;font-weight:500;color:var(--mut);margin-left:6px;font-size:11.5px}
.gr-line{font-size:12.5px;color:var(--ink2);line-height:1.5}
.gr-line.gr-any{overflow-wrap:anywhere}
.gr-line a{color:var(--acc);text-decoration:none;font-weight:700}
.gr-key{display:inline-block;width:12px;height:2px;border-radius:1px;vertical-align:middle;margin-right:5px}
.gr-mean,.gr-do{font-size:12px;color:var(--mut);line-height:1.5}
.gr-mean b,.gr-do b{color:var(--ink2);font-weight:700;margin-right:5px}
.gr-do a{color:var(--acc);text-decoration:none;font-weight:700}
.gr-foot{font-size:11.5px;color:var(--faint);line-height:1.5;border-top:1px solid var(--soft);padding-top:7px}
.gr-pairs{display:flex;flex-direction:column;gap:4px}
.gr-spark{position:relative;height:32px}
.gr-spark svg{display:block;width:100%;height:32px;overflow:visible}
.gr-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:var(--acc);
  box-shadow:0 0 0 2px var(--card);transform:translate(-50%,-50%)}
.gr-nospark{font-size:11.5px;color:var(--faint);height:32px;display:flex;align-items:center}
.gr-bars{position:relative;height:32px;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--line)}
.gr-bars i{display:block;flex:0 1 24px;max-width:24px;background:var(--faint);border-radius:4px 4px 0 0}
.gr-bars i.part{opacity:.45}
.gr-bars i.now{background:var(--acc)}
.gr-goal{position:absolute;left:0;right:0;border-top:1px solid var(--mut);pointer-events:none}
.gr-card{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-top:20px}
.gr-card h3{font-size:14.5px;font-weight:800;margin:0;letter-spacing:-.02em}
.gr-card .d{font-size:12.5px;color:var(--mut);margin:4px 0 10px;word-break:keep-all}
.gr-chart{position:relative}
.gr-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--ink2);margin-bottom:6px}
.gr-legend i{display:inline-block;width:14px;height:2px;border-radius:1px;vertical-align:middle;margin-right:6px}
.gr-plot{position:relative;outline:none;border-radius:6px}
.gr-plot:focus-visible{box-shadow:0 0 0 2px var(--acc)}
.gr-plot svg{display:block}
.gr-ax{fill:var(--mut);font-size:11px;font-variant-numeric:tabular-nums}
.gr-end{fill:var(--ink);font-size:12px;font-weight:700}
.gr-tip{position:absolute;top:6px;background:var(--sunk);border:1px solid var(--line);border-radius:9px;
  padding:8px 11px;font-size:12.5px;pointer-events:none;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.gr-tip-d{font-size:11px;color:var(--mut);margin-bottom:4px}
.gr-tip-r{display:flex;align-items:center;gap:7px;line-height:1.6}
.gr-tip-r i{display:inline-block;width:12px;height:2px;border-radius:1px}
.gr-tip-r b{color:var(--ink);font-weight:800}
.gr-tip-r span{color:var(--mut)}
.gr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.gr-empty{font-size:13px;color:var(--mut);margin:8px 0}
.gr details{margin-top:14px;background:transparent;border:1px solid var(--line);border-radius:13px;box-shadow:none}
.gr details[open]{border-color:var(--line);box-shadow:none}
.gr summary{padding:13px 18px;font-size:13.5px;color:var(--ink2);font-weight:700}
.gr summary::after{color:var(--mut);font-size:18px}
.gr summary:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}
.gr-tv{padding:0 16px 16px}
.gr details h3{font-size:13.5px;margin:12px 0 0;color:var(--ink2)}
.gr details h3 + .ops-tw{margin-top:8px}
.gr td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
.gr .err{margin-top:14px}
`;

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const n = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => (v > 0 ? `+${n(v)}` : v < 0 ? `−${n(-v)}` : "0");

type Verdict = "better" | "worse" | "same" | "none" | "neutral";
function verdict(d: Delta | null): Verdict {
  if (!d || d.dir === "none") return "none";
  if (d.good === "neutral") return "neutral";
  if (d.dir === "flat") return "same";
  return d.dir === d.good ? "better" : "worse";
}
const VERDICT_WORD: Record<Verdict, string> = { better: "좋아짐", worse: "나빠짐", same: "그대로", none: "", neutral: "중립" };

/** 변화 줄 — 기호 + 절대 차 + 이전 값. 없으면 없다고 적는다 */
function Change({ d, unit, prevLabel, noneText = "비교할 이전 값 없음", what = "", text }: {
  d: Delta | null; unit: string; prevLabel: string; noneText?: string; what?: string;
  /** 차·이전 값 대신 쓸 글 (AI: 「공통 11문항: 언급 3→3 · 인용 0→0」) */
  text?: string;
}) {
  if (!d) return <div className="gr-ch mut">확인 못함</div>;
  const v = verdict(d);
  if (v === "none") return <div className="gr-ch mut">{noneText}</div>;
  const diff = (d.now ?? 0) - (d.prev ?? 0);   // none 이면 위에서 끝났다 — 여기 오면 둘 다 있다
  const sym = v === "neutral" ? "–" : d.dir === "up" ? "▲" : d.dir === "down" ? "▼" : "–";
  const cls = v === "better" ? "ok" : v === "worse" ? "crit" : "mut";
  const body = d.dir === "flat" ? "그대로" : `${what}${signed(diff)}${unit}`;
  return (
    <div className={`gr-ch ${cls}`}>
      {sym} {text ?? `${body} · ${prevLabel} ${n(d.prev ?? 0)}${unit}`}
      <em>{VERDICT_WORD[v]}</em>
    </div>
  );
}

/** 추세선 — 선은 --faint, 마지막 점만 --acc. null 은 끊는다(0 으로 메우지 않는다) */
function Spark({ values, days, unit }: { values: (number | null)[]; days: string[]; unit: string }) {
  const got = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (got.length === 0) return <div className="gr-nospark">기록 없음</div>;
  if (got.length < 2) return <div className="gr-nospark">추세를 그리기엔 기록이 1회</div>;
  const max = Math.max(1, ...got.map((p) => p.v));
  const X = (i: number) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const Y = (v: number) => 28 - (v / max) * 24;
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${X(i).toFixed(2)},${Y(v).toFixed(2)}`;
    pen = true;
  });
  const a = got[0], z = got[got.length - 1];
  return (
    <div className="gr-spark" role="img"
         aria-label={`${md(days[a.i])} ${n(a.v)}${unit} → ${md(days[z.i])} ${n(z.v)}${unit}`}>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <path d={d} fill="none" stroke="var(--faint)" strokeWidth={2} vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="gr-dot" style={{ left: `${X(z.i)}%`, top: Y(z.v) }} />
    </div>
  );
}

function Tile({ name, tag, wide, children }: { name: string; tag?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`gr-tile${wide ? " wide" : ""}`}>
      <div className="gr-name">{name}{tag && <span className="gr-tag">{tag}</span>}</div>
      {children}
    </div>
  );
}
const Mean = ({ children }: { children: ReactNode }) => <div className="gr-mean"><b>뜻</b>{children}</div>;
const Do = ({ children }: { children: ReactNode }) => <div className="gr-do"><b>좋아지려면</b>{children}</div>;
const NoVal = ({ text = "확인 못함" }: { text?: string }) => <div className="gr-val none">{text}</div>;

const pairName = (engine: string, method: string) => (engine === method ? engine : `${engine} · ${method}`);

export default function Growth({ g, err, client }: { g: G | null; err?: string; client: Client | null }) {
  if (!g) {
    return (
      <div className="gr">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h2>성장 — 늘고 있나</h2>
        <div className="err">성장 지표를 못 읽었습니다 — {err ?? "이유 모름"}</div>
      </div>
    );
  }
  const T = g.today;
  const weekAgo = addDays(T, -7);

  /* AI — 가장 최근 쌍 */
  const aiTop = g.ai?.[0] ?? null;
  const aiLast = aiTop ? aiTop.rounds[aiTop.rounds.length - 1] : null;
  const aiDelta: Delta | null = g.ai === null ? null
    : aiTop?.compare ? delta(aiTop.compare.mentioned[1], aiTop.compare.mentioned[0], "up")
    : delta(null, null, "up");

  /* 커버리지 — 셋 중 가장 낮은 곳 */
  const cov = g.coverage;
  const covNow = cov?.series.map((s) => ({ s, now: s.points[s.points.length - 1]?.pages ?? 0 })) ?? [];
  const low = covNow.length && cov && cov.total > 0
    ? covNow.reduce((m, x) => (x.now < m.now ? x : m))
    : null;
  const lowPrev = low ? low.s.points.find((p) => p.day === weekAgo)?.pages ?? null : null;
  const covDelta: Delta | null = cov === null ? null : low ? delta(low.now, lowPrev, "up") : delta(null, null, "up");
  const lowSpark = low ? g.days.map((d) => low.s.points.find((p) => p.day === d)?.pages ?? null) : [];

  /* 경쟁 검색어 */
  const rv = g.rival;
  const rivalDelta: Delta | null = rv === null ? null
    : delta(rv.latest ? rv.latest.won : null, rv.latest && rv.prev ? rv.prev.won : null, "up");

  /* 크롤러 — 중립 */
  const cr = g.crawl;
  const crawlDelta: Delta | null = cr && cr.search.now !== null && cr.ai.now !== null
    ? delta(cr.search.now + cr.ai.now, (cr.search.prev ?? 0) + (cr.ai.prev ?? 0), "neutral") : null;

  /* 발행 */
  const ps = g.posts;
  const postsEver = ps ? ps.weekly.reduce((s, w) => s + w.n, 0) : 0;
  const postsDelta: Delta | null = ps === null ? null : postsEver ? ps.last7 : delta(null, null, "up");

  /* 문의 */
  const iq = g.inquiries;
  const inqDelta: Delta | null = iq === null ? null : iq.ever ? iq.last30 : delta(null, null, "up");

  const judged: { name: string; d: Delta | null }[] = [
    { name: "AI 답변", d: aiDelta },
    { name: "커버리지", d: covDelta },
    { name: "경쟁 검색어", d: rivalDelta },
    { name: "학원 문의", d: inqDelta },
    { name: "발행", d: postsDelta },
    { name: "사이티드 리드", d: g.sales?.leads30 ?? null },
    { name: "에이전트 실패", d: g.agents?.fail7 ?? null },
  ];
  const bucket = (v: Verdict) => judged.filter((j) => verdict(j.d) === v).map((j) => j.name);
  const verdicts: [string, string[]][] = [
    ["좋아진 것", bucket("better")], ["그대로", bucket("same")],
    ["나빠진 것", bucket("worse")], ["비교 못 함", bucket("none")],
  ];

  const chartSeries: CovSeries[] = cov
    ? cov.series.map((s) => ({ vendor: s.vendor, label: s.label, color: SERIES_COLOR[s.vendor], points: s.points }))
    : [];
  const covDays = cov?.series[0]?.points.map((p) => p.day) ?? [];
  const covAt = (day: string) => {
    if (!cov || !covDays.length || day < covDays[0]) return null;
    const d = day > T ? T : day;
    return cov.series.map((s) => s.points.find((p) => p.day === d)?.pages ?? null);
  };

  const weekLabel = (week: string, partialDays: number | null) => {
    if (partialDays === null) return `${md(week)} 주`;
    return addDays(week, 6) >= T ? `${md(week)} 주 (${partialDays}일째)` : `${md(week)} 주 (착수 뒤 ${partialDays}일)`;
  };
  const postWeek = new Map(ps?.weekly.map((w) => [w.week, w]) ?? []);

  return (
    <div className="gr">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h2>성장 — 늘고 있나</h2>
      <p className="sub">최근 7일을 그 전 7일과 비교합니다(문의·리드는 30일). 오늘 {T} KST</p>

      <div className="gr-verdict">
        <b>최근 7일</b> —{" "}
        {verdicts.map(([label, names], i) => (
          <span key={label}>
            {i > 0 && <span className="sep">·</span>}
            {label}<span className="n">{names.length}</span>
            {names.length > 0 && <small>({names.join("·")})</small>}
          </span>
        ))}
      </div>

      <div className="gr-eb">① 레퍼런스 증거</div>
      <div className="gr-grid">
        {/* AI 답변 */}
        <Tile name="AI 답변" wide>
          {g.ai === null ? <NoVal /> : !aiTop || !aiLast ? <NoVal text="기록 없음" /> : (
            <div className="gr-val">
              언급 {aiLast.mentioned}/{aiLast.prompts}<small>· 인용 {aiLast.cited}/{aiLast.prompts}</small>
            </div>
          )}
          {aiTop && !aiTop.compare ? (
            <div className="gr-ch mut">
              {aiTop.rounds.length < 2 ? "이 방법으로는 1회차 — 비교할 이전 회차 없음" : "비교 불가 — 두 회차 공통 문항 없음"}
            </div>
          ) : aiTop?.compare ? (
            <Change d={aiDelta} unit="" prevLabel=""
                    text={`${md(aiTop.compare.prevDay)}→${md(aiLast!.day)} 공통 ${aiTop.compare.common}문항: 언급 ${aiTop.compare.mentioned[0]}→${aiTop.compare.mentioned[1]} · 인용 ${aiTop.compare.cited[0]}→${aiTop.compare.cited[1]}`} />
          ) : <Change d={aiDelta} unit="" prevLabel="" />}
          {aiTop && <Spark values={aiTop.rounds.map((r) => r.mentioned)} days={aiTop.rounds.map((r) => r.day)} unit="건 언급" />}
          {g.ai && g.ai.length > 0 && (
            <div className="gr-pairs">
              {g.ai.map((p) => {
                const r = p.rounds[p.rounds.length - 1];
                return (
                  <div className="gr-line gr-any" key={p.engine + p.method}>
                    <b>{pairName(p.engine, p.method)}</b> · {md(r.day)} · 언급 {r.mentioned}/{r.prompts} · 인용 {r.cited}/{r.prompts}
                    {" — "}
                    {p.compare
                      ? `공통 ${p.compare.common}문항: 언급 ${p.compare.mentioned[0]}→${p.compare.mentioned[1]} · 인용 ${p.compare.cited[0]}→${p.compare.cited[1]}`
                      : p.rounds.length < 2 ? "이 방법으로는 1회차 — 비교할 이전 회차 없음" : "비교 불가 — 공통 문항 없음"}
                  </div>
                );
              })}
            </div>
          )}
          <Mean>AI 가 학원 이름을 부르는가. 엔진·방법이 다르면 합치지 않는다</Mean>
          <Do>같은 엔진·방법으로 다시 잰다. 인용은 그 엔진이 찾는 검색 색인에 들어가야 생긴다</Do>
        </Tile>

        {/* ★ 답변 색인 커버리지 */}
        <Tile name="★ 답변 색인 커버리지">
          {cov === null ? <NoVal /> : cov.total === 0 ? <NoVal text="쪽 목록 없음" /> : low && (
            <div className="gr-val">{low.s.label} {low.now}<small>/ {cov.total}쪽</small></div>
          )}
          <Change d={covDelta} unit="쪽" prevLabel="7일 전" />
          {low && <Spark values={lowSpark} days={g.days} unit="쪽" />}
          {cov && cov.total > 0 && (
            <div className="gr-line">
              {covNow.map((x, i) => (
                <span key={x.s.vendor}>
                  {i > 0 && " · "}
                  <i className="gr-key" style={{ background: SERIES_COLOR[x.s.vendor] }} />{x.s.label} {x.now}
                </span>
              ))}
              {` — 지금 ${cov.total}쪽 기준`}
            </div>
          )}
          <Mean>AI 가 답할 때 찾는 검색 색인에 우리 쪽이 몇 쪽 들어갔나</Mean>
          <Do>제일 낮은 곳을 민다. 빙이면 빙 제출·IndexNow — ChatGPT 검색과 Copilot 이 빙을 쓴다</Do>
          <div className="gr-foot">Brave(→Claude)는 로봇이 이름을 안 밝혀 여기서 못 센다. AI 답변 칸의 claude-code-web 인용으로 본다</div>
        </Tile>

        {/* 경쟁 검색어 */}
        <Tile name="경쟁 검색어">
          {rv === null ? <NoVal /> : !rv.latest ? <NoVal text="기록 없음" /> : (
            <div className="gr-val">{rv.latest.won}/{rv.latest.total}<small>{md(rv.latest.day)}</small></div>
          )}
          <Change d={rivalDelta} unit="개" prevLabel={rv?.prev ? md(rv.prev.day) : ""} />
          {rv && rv.latest && <Spark values={rv.daily.map((x) => x.won)} days={rv.daily.map((x) => x.day)} unit="개" />}
          {rv?.latest && (
            <div className="gr-line">
              {rv.latest.byEngine.map((e) =>
                `${RIVAL_NAME[e.engine] ?? e.engine} ${e.hit}${e.best !== null && e.hit > 0 ? `(최고 ${e.best}위)` : ""}`).join(" · ")}
            </div>
          )}
          {rv && rv.partialDays.length > 0 && (
            <div className="gr-line">{rv.partialDays.map(md).join("·")} 은 일부 엔진만 잼 — 뺐다</div>
          )}
          <Mean>학원 이름 없이 지역·업종으로 찾을 때 나오는가</Mean>
          <Do>그 검색어에 답하는 글을 쓰고 색인을 민다</Do>
        </Tile>

        {/* 크롤러 방문 — 중립 */}
        <Tile name="크롤러 방문" tag="중립">
          {cr === null ? <NoVal /> : (
            <div className="gr-val">{n((cr.search.now ?? 0) + (cr.ai.now ?? 0))}<small>회 · 최근 7일</small></div>
          )}
          <Change d={crawlDelta} unit="회" prevLabel="그 전 7일" />
          {cr && <Spark values={cr.daily.map((x) => x.search + x.ai)} days={cr.daily.map((x) => x.day)} unit="회" />}
          {cr && (
            <div className="gr-line">
              검색 색인 {n(cr.search.now ?? 0)} · 그 전 {n(cr.search.prev ?? 0)} / AI {n(cr.ai.now ?? 0)} · 그 전 {n(cr.ai.prev ?? 0)}
            </div>
          )}
          <Mean>로봇이 다녀간 횟수. 한 번 다 읽고 나면 줄어든다</Mean>
          <Do>횟수보다 커버리지를 본다. 새 글을 내면 다시 온다</Do>
        </Tile>

        {/* 학원 문의 */}
        <Tile name="학원 문의">
          {iq === null ? <NoVal /> : !iq.ever ? <NoVal text="기록 없음" /> : (
            <div className="gr-val">{n(iq.last30.now ?? 0)}<small>건 · 30일</small></div>
          )}
          <Change d={inqDelta} unit="건" prevLabel="그 전 30일" />
          {iq && (iq.last30.now ?? 0) > 0 && (
            <div className="gr-line">{iq.bySource.map((s) => `${s.source} ${s.n}`).join(" · ")}</div>
          )}
          {iq && iq.ever > 0 && (iq.last30.now ?? 0) === 0 && (
            <div className="gr-line">0건 — 노출이 문의로 이어지는지 아직 못 잰다</div>
          )}
          {iq && !iq.ever && <div className="gr-line">상담 기록이 아직 없다 — 노출이 문의로 이어지는지 못 잰다</div>}
          {iq && iq.unresolved > 0 && (
            <div className="gr-line"><Link href="/admin/inquiry">결과 미입력 {iq.unresolved}건 →</Link></div>
          )}
          <Mean>노출이 실제 문의로 이어졌나. 상담에서 “어떻게 알고 오셨어요”로만 잰다</Mean>
          <Do>상담마다 30초 기록</Do>
        </Tile>
      </div>

      <div className="gr-grid more">
        <div className="gr-cell">
          <div className="gr-eb">② 꾸준한 발행</div>
          <Tile name="발행">
            {ps === null ? <NoVal /> : !postsEver ? <NoVal text="기록 없음" /> : (
              <div className="gr-val">{ps.last7.now}<small>편 · 최근 7일</small></div>
            )}
            <Change d={postsDelta} unit="편" prevLabel="그 전 7일" />
            {ps && postsEver > 0 && (() => {
              const top = Math.max(2, ...ps.weekly.map((w) => w.n));
              return (
                <div className="gr-bars" role="img"
                     aria-label={ps.weekly.map((w) => `${md(w.week)} 주 ${w.n}편`).join(", ")}>
                  <span className="gr-goal" style={{ bottom: `${(1 / top) * 100}%` }} />
                  {ps.weekly.map((w, i) => (
                    <i key={w.week}
                       className={`${w.partialDays !== null ? "part" : ""} ${i === ps.weekly.length - 1 ? "now" : ""}`}
                       style={{ height: `${(w.n / top) * 100}%` }}
                       title={`${md(w.week)} 주${w.partialDays !== null ? ` · ${w.partialDays}일째` : ""} · ${w.n}편`} />
                  ))}
                </div>
              );
            })()}
            {ps && postsEver > 0 && (
              <div className="gr-line">
                마지막 {ps.sinceDays === 0 ? "오늘" : `${ps.sinceDays ?? "?"}일 전`} · 연속 {ps.streakWeeks}주 · 가는 선이 주 1편
              </div>
            )}
            {ps && !postsEver && <div className="gr-line">이 고객사 글은 이 DB 에 없다</div>}
            <Mean>주 1편이 끊기면 크롤러가 뜸해지고 레퍼런스가 늙는다</Mean>
            <Do>이번 주 0편이면 초안 검토 → 발행</Do>
          </Tile>
        </div>

        <div className="gr-cell">
          <div className="gr-eb">③ 첫 고객</div>
          <Tile name="사이티드 리드·진단" tag="사이티드 전체">
            {g.sales === null ? <NoVal /> : (
              <div className="gr-val">{n(g.sales.leads30.now ?? 0)}<small>건 · 리드 30일</small></div>
            )}
            <Change d={g.sales?.leads30 ?? null} unit="건" prevLabel="그 전 30일" />
            {g.sales && (
              <div className="gr-line">무료 진단 {n(g.sales.scans30.now ?? 0)}회 · 사내 재진단 제외</div>
            )}
            <Mean>첫 고객 후보가 들어오고 있나</Mean>
            <Do>영업판의 통화 대상부터 <Link href="/admin/outreach">영업판 →</Link></Do>
          </Tile>
        </div>

        <div className="gr-cell">
          <div className="gr-eb">운영</div>
          <Tile name="막힌 곳">
            {g.agents === null ? <NoVal /> : (
              <div className="gr-val">{n(g.agents.waitingHuman)}<small>건 · 사람 대기</small></div>
            )}
            <Change d={g.agents?.fail7 ?? null} unit="건" what="실패 " prevLabel="그 전 7일" />
            {g.agents && (
              <div className="gr-line">
                실패 7일 {n(g.agents.fail7.now ?? 0)} / 활동 {n(g.agents.total7)} · 그 전 7일 실패 {n(g.agents.fail7.prev ?? 0)}
              </div>
            )}
            <Mean>에이전트가 멈춘 자리</Mean>
            <Do>사람 대기부터 푼다 — 아래 에이전트 판</Do>
          </Tile>
        </div>
      </div>

      <div className="gr-card">
        <h3>★ 답변 색인 커버리지 — 착수부터 누적</h3>
        {cov === null ? <p className="gr-empty">확인 못함</p> : <>
          <p className="d">지금 있는 {cov.total}쪽 중 한 번이라도 읽어 간 쪽. 과거에는 없던 쪽도 분모에 들어 있다</p>
          <CoverageChart total={cov.total} series={chartSeries} />
        </>}
      </div>

      <details>
        <summary>표로 보기</summary>
        <div className="gr-tv">

        <h3>★ 답변 색인 커버리지 — 날짜별 (지금 {cov?.total ?? "?"}쪽 기준 누적)</h3>
        <div className="ops-tw">
          <table>
            <thead><tr><th>날짜</th><th>구글</th><th>네이버</th><th>빙</th></tr></thead>
            <tbody>
              {cov && covDays.map((day, i) => (
                <tr key={day}>
                  <td>{md(day)}</td>
                  {cov.series.map((s) => <td className="n" key={s.vendor}>{s.points[i].pages}</td>)}
                </tr>
              ))}
              {(!cov || !covDays.length) && <tr><td colSpan={4}>{cov ? "기록 없음" : "확인 못함"}</td></tr>}
            </tbody>
          </table>
        </div>

        <h3>주별 요약 (월요일 시작 KST · 착수 {client ? md(client.startedOn) : "?"} 주부터)</h3>
        <div className="ops-tw">
          <table>
            <thead>
              <tr>
                <th>주</th><th>발행</th><th>크롤러 검색/AI</th><th>★커버리지 구/네/빙</th>
                <th>경쟁 검색어</th><th>AI 측정 회차</th><th>문의</th>
              </tr>
            </thead>
            <tbody>
              {(g.weeks ?? []).map((w) => {
                const end = addDays(w.week, 6) > T ? T : addDays(w.week, 6);
                const c = covAt(end);
                const rounds = (g.ai ?? []).flatMap((p) =>
                  p.rounds.filter((r) => r.day >= w.week && r.day <= end).map((r) => `${p.engine} ${md(r.day)}`));
                const pw = postWeek.get(w.week);
                return (
                  <tr key={w.week}>
                    <td>{weekLabel(w.week, w.partialDays)}</td>
                    <td className="n">{pw ? `${pw.n}편` : "확인 못함"}</td>
                    <td className="n">{w.search ?? "?"} / {w.ai ?? "?"}</td>
                    <td className="n">{c ? c.map((v) => v ?? "—").join(" / ") : "—"}</td>
                    <td className="n">{w.rival ? `${w.rival.won}/${w.rival.total} (${md(w.rival.day)})` : "기록 없음"}</td>
                    <td>{rounds.length ? rounds.join(" · ") : "—"}</td>
                    <td className="n">{w.inquiries === null ? "확인 못함" : `${w.inquiries}건`}</td>
                  </tr>
                );
              })}
              {!g.weeks && <tr><td colSpan={7}>확인 못함</td></tr>}
            </tbody>
          </table>
        </div>
        </div>
      </details>
    </div>
  );
}
