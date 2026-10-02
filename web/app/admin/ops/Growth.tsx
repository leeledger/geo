import Link from "next/link";
import type { ReactNode } from "react";

import type { Client, Ops } from "@/lib/ops";
import { addDays, delta, type Delta, type Growth as G } from "@/lib/growth";
import { engineName } from "@/lib/agents";
import CoverageChart, { type CovSeries } from "./CoverageChart";

/**
 * ③ 크고 있나 — 카드 4장, ④ 답변 색인 차트 하나. 「그 밖의 숫자」와 표는 GrowthMore(자세히 안).
 *
 * 카드 = 머리문장(숫자 굵게) / 비교 줄(이전 값 + 변화 단어) / 선택 하나(추세선 또는 링크). 3줄 이내.
 * 증감률(%)은 쓰지 않는다 — 작은 수에서 +300% 같은 소리가 나온다. 이전 값을 그대로 적는다.
 * 변화는 기호+단어+색이 같이 간다. 색만으로 뜻을 싣지 않는다.
 * 비교 로직은 growth.ts 그대로 — 여기서 새로 짜지 않는다.
 */

/** 계열색. 검증된 셋만, 순서 고정 — 넷째를 만들지 않는다 (validate_palette: 밝은·어두운 판 모두 통과) */
const SERIES_COLOR: Record<string, string> = { google: "#1F9E90", naver: "#7C8AF2", microsoft: "#C27A14" };
const RIVAL_NAME: Record<string, string> = { naver_all: "네이버 통합", naver: "네이버 웹문서", bing: "빙" };
/** 「구글이·네이버가·빙이」 — 받침에 따라 */
const SUBJECT: Record<string, string> = { google: "구글이", naver: "네이버가", microsoft: "빙이" };

const CSS = `
.gr .sub{word-break:keep-all}
.gr-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:14px}
@media(min-width:760px){.gr-grid{grid-template-columns:1fr 1fr}}
.gc{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:16px 18px;
  display:flex;flex-direction:column;gap:6px;min-width:0;word-break:keep-all}
.gc-h{font-size:21px;font-weight:700;line-height:1.45;letter-spacing:-.02em;margin:0;color:var(--ink)}
.gc-h b{font-weight:900;color:var(--ink)}
.gc-h .gc-s{font-size:16px;font-weight:600;color:var(--ink2);letter-spacing:0}
.gc-h.none{color:var(--ink2)}
.gc-c{font-size:16px;color:var(--ink2);line-height:1.55;margin:0}
.gc-d{color:var(--mut);font-size:14px}
.gc-x a{color:var(--acc);text-decoration:none;font-weight:700;font-size:16px}
.gw{font-weight:700;white-space:nowrap}
.gw.ok{color:var(--ok)} .gw.crit{color:var(--crit)} .gw.mut{color:var(--ink2)}
.gr-spark{position:relative;height:40px}
.gr-spark svg{display:block;width:100%;height:40px;overflow:visible}
.gr-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:var(--acc);
  box-shadow:0 0 0 2px var(--card);transform:translate(-50%,-50%)}
.gr-card{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-top:14px}
.gr-card h2{margin:0 0 4px}
.gr-card .d{font-size:16px;color:var(--ink2);margin:0 0 12px;word-break:keep-all;line-height:1.55}
.gr-chart{position:relative}
.gr-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:14px;color:var(--ink2);margin-bottom:6px}
.gr-legend i{display:inline-block;width:14px;height:2px;border-radius:1px;vertical-align:middle;margin-right:6px}
.gr-plot{position:relative;outline:none;border-radius:6px}
.gr-plot:focus-visible{box-shadow:0 0 0 2px var(--acc)}
.gr-plot svg{display:block}
.gr-ax{fill:var(--ink2);font-size:14px;font-variant-numeric:tabular-nums}
.gr-end{fill:var(--ink);font-size:14px;font-weight:700}
.gr-tip{position:absolute;top:6px;background:var(--sunk);border:1px solid var(--line);border-radius:9px;
  padding:8px 11px;font-size:14px;pointer-events:none;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.gr-tip-d{font-size:14px;color:var(--ink2);margin-bottom:4px}
.gr-tip-r{display:flex;align-items:center;gap:7px;line-height:1.6}
.gr-tip-r i{display:inline-block;width:12px;height:2px;border-radius:1px}
.gr-tip-r b{color:var(--ink);font-weight:800}
.gr-tip-r span{color:var(--ink2)}
.gr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.gr-empty{font-size:16px;color:var(--ink2);margin:8px 0}
.gm h3{font-size:17px;font-weight:800;margin:26px 0 8px;color:var(--ink)}
.gm h3:first-child{margin-top:4px}
.gm dl{margin:0;display:grid;gap:10px}
.gm dt{font-weight:800;font-size:16px}
.gm dd{margin:2px 0 0;font-size:16px;color:var(--ink2);line-height:1.55;word-break:keep-all}
.gm dd b{color:var(--ink);font-weight:700;margin-right:6px}
.gm td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
`;

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const n = (v: number) => v.toLocaleString("ko-KR");

/** 변화 단어 — 기호+단어+색. 좋은 방향이면 --ok, 나쁜 방향이면 --crit. 사람 방문 카드(Visits.tsx)도 쓴다 */
export function Word({ d }: { d: Delta | null }) {
  if (!d) return <span className="gw mut">확인 못함</span>;
  if (d.dir === "none") return <span className="gw mut">아직 비교 전</span>;
  if (d.dir === "flat") return <span className="gw mut">그대로</span>;
  if (d.good === "neutral") return null;
  const good = d.dir === d.good;
  return <span className={`gw ${good ? "ok" : "crit"}`}>{d.dir === "up" ? "▲ 늘었음" : "▼ 줄었음"}</span>;
}

function Card({ head, none, cmp, note, extra }: { head: ReactNode; none?: boolean; cmp?: ReactNode; note?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="gc">
      <p className={`gc-h${none ? " none" : ""}`}>{head}</p>
      {cmp && <p className="gc-c">{cmp}</p>}
      {note && <p className="gc-c gc-d">{note}</p>}
      {extra && <div className="gc-x">{extra}</div>}
    </div>
  );
}

/** 추세선 — 선은 --faint, 마지막 점만 --acc. null 은 끊는다(0 으로 메우지 않는다) */
function Spark({ values, days, unit }: { values: (number | null)[]; days: string[]; unit: string }) {
  const got = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (got.length < 2) return null;
  const max = Math.max(1, ...got.map((p) => p.v));
  const X = (i: number) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const Y = (v: number) => 36 - (v / max) * 32;
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${X(i).toFixed(2)},${Y(v).toFixed(2)}`;
    pen = true;
  });
  const a = got[0], z = got[got.length - 1];
  return (
    <div className="gr-spark" role="img" aria-label={`${md(days[a.i])} ${n(a.v)}${unit} → ${md(days[z.i])} ${n(z.v)}${unit}`}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <path d={d} fill="none" stroke="var(--faint)" strokeWidth={2} vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="gr-dot" style={{ left: `${X(z.i)}%`, top: Y(z.v) }} />
    </div>
  );
}

/** 커버리지 — 셋 중 가장 낮은 곳과 그 비교(어제 대 7일 전). 카드와 자세히가 같이 쓴다 */
function lowest(g: G) {
  const cov = g.coverage;
  const Yd = addDays(g.today, -1);
  const weekAgo = addDays(Yd, -7);
  const covNow = cov?.series.map((s) => ({ s, now: s.points[s.points.length - 1]?.pages ?? 0 })) ?? [];
  const low = covNow.length && cov && cov.total > 0 ? covNow.reduce((m, x) => (x.now < m.now ? x : m)) : null;
  // 값은 지금(오늘까지 누적), 비교는 어제 대 그 7일 전 — 오늘은 진행 중이라 비교에 안 넣는다
  const lowAt = (day: string) => (low ? low.s.points.find((p) => p.day === day)?.pages ?? null : null);
  const covDelta: Delta | null = cov === null ? null : low ? delta(lowAt(Yd), lowAt(weekAgo), "up") : delta(null, null, "up");
  return { cov, low, covDelta };
}

/** name — 고른 고객 이름. 없으면 「이름」만 (Step 34 D50: 문서딱 탭에 「학원 이름」이 뜨던 것) */
export default function Growth({ g, err, name }: { g: G | null; err?: string; name?: string | null }) {
  if (!g) {
    return (
      <section className="gr">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h2>성과</h2>
        <div className="err">성장 숫자를 못 읽었습니다 — {err ?? "이유 모름"}</div>
      </section>
    );
  }

  /* 1 AI 답변 — 가장 최근 엔진·방법 쌍. 같은 쌍의 두 회차 공통 질문으로만 비교 */
  const aiTop = g.ai?.[0] ?? null;
  const aiLast = aiTop ? aiTop.rounds[aiTop.rounds.length - 1] : null;

  /* 2 답변 색인 */
  const { cov, low, covDelta } = lowest(g);

  /* 3 글 · 4 문의 */
  const ps = g.posts;
  const postsEver = ps ? ps.weekly.reduce((s, w) => s + w.n, 0) : 0;
  const iq = g.inquiries;

  const chartSeries: CovSeries[] = cov
    ? cov.series.map((s) => ({ vendor: s.vendor, label: s.label, color: SERIES_COLOR[s.vendor], points: s.points }))
    : [];

  return (
    <>
      <section className="gr" aria-labelledby="gr-h">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h2 id="gr-h">성과</h2>
        <p className="sub">최근 7일을 그 전 7일과 비교합니다. 문의만 30일 기준입니다.</p>
        <div className="gr-grid">
          {/* 1 AI 답변 */}
          {g.ai === null ? <Card none head="AI 답변 — 확인 못함" />
            : !aiTop || !aiLast ? <Card none head="AI 답변 측정 기록이 아직 없습니다" />
            : (
              <Card
                head={<>
                  {engineName(aiTop.engine)}에게 물은 질문 {aiLast.prompts}개 중 <b>{aiLast.mentioned}개</b> 답에 {name ? `${name} 이름` : "이름"}이 나왔습니다
                  <span className="gc-s"> · 우리 사이트 링크 {aiLast.cited}개 · 이름 질문 빼고</span>
                </>}
                note={aiTop.brand ? <>
                  이름 질문 {aiTop.brand.prompts}개 중 {aiTop.brand.mentioned}개{aiTop.brand.day !== aiLast.day && ` (${md(aiTop.brand.day)})`} — AI 가 이 사이트를 제대로 아는지 확인용(노출 성과 아님)
                </> : undefined}
                cmp={aiTop.compare ? <>
                  {aiTop.compare.common !== aiLast.prompts && `두 번 다 물은 질문 ${aiTop.compare.common}개 기준 · `}
                  지난번({md(aiTop.compare.prevDay)}) {aiTop.compare.mentioned[0]}개 → 이번({md(aiLast.day)}) {aiTop.compare.mentioned[1]}개{" "}
                  <Word d={delta(aiTop.compare.mentioned[1], aiTop.compare.mentioned[0], "up")} />
                </> : <>
                  <span className="gw mut">아직 비교 전</span> — 같은 방법으로 한 번 더 재면 비교됩니다
                  <span className="gc-d"> · {md(aiLast.day)} 측정</span>
                </>}
                extra={aiTop.rounds.length >= 3
                  ? <Spark values={aiTop.rounds.map((r) => r.mentioned)} days={aiTop.rounds.map((r) => r.day)} unit="번" />
                  : undefined}
              />
            )}

          {/* 2 답변 색인 — 셋 중 가장 낮은 곳 */}
          {cov === null ? <Card none head="답변 색인 — 확인 못함" />
            : cov.total === 0 || !low ? <Card none head="사이트 쪽 목록이 없습니다" />
            : (
              <Card
                head={<>{SUBJECT[low.s.vendor] ?? low.s.label} 우리 {cov.total}쪽 중 <b>{low.now}쪽</b>을 읽었습니다</>}
                cmp={covDelta && covDelta.dir !== "none"
                  ? <>7일 전 {covDelta.prev}쪽 <Word d={covDelta} /></>
                  : <Word d={covDelta} />}
              />
            )}

          {/* 3 글 */}
          {ps === null ? <Card none head="글 — 확인 못함" /> : (
            <Card
              head={<>최근 7일 글 <b>{ps.last7.now ?? 0}편</b> · 목표 주 1편</>}
              cmp={postsEver ? <>
                그 전 7일 {ps.last7.prev ?? 0}편
                {ps.sinceDays !== null && ` · 마지막 글 ${ps.sinceDays === 0 ? "오늘" : `${ps.sinceDays}일 전`}`}{" "}
                <Word d={ps.last7} />
              </> : "착수 뒤 글이 아직 없습니다"}
              extra={(ps.last7.now ?? 0) === 0 ? <Link href="/admin/drafts">초안 보러 가기 →</Link> : undefined}
            />
          )}

          {/* 4 문의 */}
          {iq === null ? <Card none head={`${name ? `${name} ` : ""}문의 — 확인 못함`} />
            : !iq.ever ? (
              <Card none head="상담 기록이 아직 없습니다"
                    extra={<Link href="/admin/inquiry">기록하러 가기 →</Link>} />
            ) : (
              <Card
                head={<>최근 30일 {name ? `${name} ` : ""}문의 <b>{n(iq.last30.now ?? 0)}건</b></>}
                cmp={<>그 전 30일 {n(iq.last30.prev ?? 0)}건 <Word d={iq.last30} /></>}
                extra={iq.unresolved > 0 ? <Link href="/admin/inquiry">결과 미입력 {iq.unresolved}건 →</Link> : undefined}
              />
            )}
        </div>
      </section>

      {/* ④ 차트 하나 */}
      <section className="gr gr-card" aria-labelledby="cov-h">
        <h2 id="cov-h">검색 엔진이 읽어 간 우리 글</h2>
        {cov === null ? <p className="gr-empty">확인 못함</p> : <>
          <p className="d">우리 사이트 {cov.total}쪽 가운데 검색 엔진이 한 번이라도 읽어 간 쪽 수입니다. ChatGPT 검색은 빙이 읽은 것을, 구글 AI 답변은 구글이 읽은 것을 씁니다.</p>
          <CoverageChart total={cov.total} series={chartSeries} />
        </>}
      </section>
    </>
  );
}

/**
 * ⑤ 자세히 안 — 숫자 읽는 법 · 그 밖의 숫자 · 날짜별·주별 표.
 * 엔진은 사람 이름으로만, 방법 이름은 쓰지 않는다.
 */
export function GrowthMore({ g, client, place }: { g: G | null; client: Client | null; place: Ops["place"] }) {
  const T = g?.today ?? "";
  const rv = g?.rival ?? null;
  const rivalDelta: Delta | null = rv === null ? null
    : delta(rv.latest ? rv.latest.won : null, rv.latest && rv.prev ? rv.prev.won : null, "up");
  const cr = g?.crawl ?? null;
  const cov = g?.coverage ?? null;
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
  const postWeek = new Map(g?.posts?.weekly.map((w) => [w.week, w]) ?? []);

  return (
    // CSS 는 같은 화면의 Growth 가 넣는다 (못 읽어도 넣는다)
    <div className="gm">
      <h3>숫자 읽는 법</h3>
      <dl>
        <div><dt>AI 답변</dt>
          <dd><b>뜻</b>AI 에게 물었을 때 {client ? `${client.name} 이름` : "이름"}이 나오는가. 이름 질문은 빼고 셉니다. 재는 방법이 다르면 합치지 않습니다.</dd>
          <dd><b>좋아지려면</b>같은 방법으로 다시 잽니다. 사이트 인용은 그 AI 가 찾는 검색 색인에 들어가야 생깁니다.</dd></div>
        <div><dt>답변 색인</dt>
          <dd><b>뜻</b>AI 가 답할 때 찾는 검색 색인에 우리 쪽이 몇 쪽 들어갔나. 구글·네이버·빙 중 제일 적은 곳을 카드에 씁니다.</dd>
          <dd><b>좋아지려면</b>제일 낮은 곳을 밉니다. 빙이면 빙 제출과 색인 알림 — ChatGPT 검색과 Copilot 이 빙을 씁니다.
            Claude 가 찾는 Brave 는 로봇이 이름을 안 밝혀 여기서 못 셉니다. AI 답변 측정의 인용으로 봅니다.</dd></div>
        <div><dt>글</dt>
          <dd><b>뜻</b>주 1편이 끊기면 크롤러가 뜸해지고 레퍼런스가 늙습니다.</dd>
          <dd><b>좋아지려면</b>이번 주 0편이면 초안 검토 → 발행.</dd></div>
        <div><dt>{client ? `${client.name} 문의` : "문의"}</dt>
          <dd><b>뜻</b>노출이 실제 문의로 이어졌나. 상담에서 “어떻게 알고 오셨어요”로만 잽니다.</dd>
          <dd><b>좋아지려면</b>상담마다 30초 기록.</dd></div>
        <div><dt>비교 규칙</dt>
          <dd>어제로 끝나는 완전한 날끼리 비교합니다. 오늘은 진행 중이라 뺍니다. 비교할 이전 값이 없으면 「아직 비교 전」.</dd></div>
      </dl>

      <h3>그 밖의 숫자</h3>
      {!g ? <p className="gr-empty">확인 못함</p> : (
        <dl>
          <div><dt>지역·업종 검색 (이름 없이)</dt>
            <dd>{rv === null ? "확인 못함" : !rv.latest ? "기록 없음" : <>
              {md(rv.latest.day)} — {rv.latest.total}개 중 <b>{rv.latest.won}개</b>에서 나옴
              {" "}({rv.latest.byEngine.map((e) => `${RIVAL_NAME[e.engine] ?? "기타"} ${e.hit}${e.best !== null && e.hit > 0 ? `·최고 ${e.best}위` : ""}`).join(" · ")})
              {rv.prev ? <> · {md(rv.prev.day)} {rv.prev.won}개 </> : " "}<Word d={rivalDelta} />
            </>}</dd></div>
          <div><dt>로봇 방문 — 어제까지 7일</dt>
            <dd>{!cr ? "확인 못함" : <>
              검색 색인 {n(cr.search.now ?? 0)}회 · 그 전 {n(cr.search.prev ?? 0)}회 / AI 학습 {n(cr.ai.now ?? 0)}회 · 그 전 {n(cr.ai.prev ?? 0)}회
              {(cr.other.now ?? 0) + (cr.other.prev ?? 0) > 0 && ` / 기타 ${n(cr.other.now ?? 0)}회 · 그 전 ${n(cr.other.prev ?? 0)}회`}
            </>}</dd></div>
          <div><dt>플레이스 최고 순위</dt>
            <dd>{place.length ? <><b>{place[0].rank}위</b>{place[0].query}</> : "안 쟀습니다"}</dd></div>
          <div><dt>사이티드 리드·무료 진단 — 어제까지 30일 (사이티드 전체)</dt>
            <dd>{!g.sales ? "확인 못함" : <>
              리드 {n(g.sales.leads30.now ?? 0)}건 · 그 전 {n(g.sales.leads30.prev ?? 0)}건 <Word d={g.sales.leads30} />
              {" "}· 무료 진단 {n(g.sales.scans30.now ?? 0)}회 · 그 전 {n(g.sales.scans30.prev ?? 0)}회
            </>}</dd></div>
          <div><dt>에이전트 실패 — 어제까지 7일</dt>
            <dd>{!g.agents ? "확인 못함" : <>
              {n(g.agents.fail7.now ?? 0)}건 · 그 전 {n(g.agents.fail7.prev ?? 0)}건 <Word d={g.agents.fail7} />
              {" "}· 전체 활동 {n(g.agents.total7)}건
            </>}</dd></div>
        </dl>
      )}

      <h3>답변 색인 — 날짜별 (지금 {cov?.total ?? "?"}쪽 기준 누적)</h3>
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

      <h3>주별 요약 (월요일 시작 · 착수 {client ? md(client.startedOn) : "?"} 주부터)</h3>
      <div className="ops-tw">
        <table>
          <thead>
            <tr>
              <th>주</th><th>글</th><th>로봇 방문 검색/AI/기타</th><th>답변 색인 구/네/빙</th>
              <th>지역·업종 검색</th><th>AI 측정</th><th>문의</th>
            </tr>
          </thead>
          <tbody>
            {(g?.weeks ?? []).map((w) => {
              const end = addDays(w.week, 6) > T ? T : addDays(w.week, 6);
              const c = covAt(end);
              const rounds = (g?.ai ?? []).flatMap((p) =>
                p.rounds.filter((r) => r.day >= w.week && r.day <= end).map((r) => `${engineName(p.engine)} ${md(r.day)}`));
              const pw = postWeek.get(w.week);
              return (
                <tr key={w.week}>
                  <td>{weekLabel(w.week, w.partialDays)}</td>
                  <td className="n">{pw ? `${pw.n}편` : "확인 못함"}</td>
                  <td className="n">{w.search ?? "?"} / {w.ai ?? "?"} / {w.other ?? "?"}</td>
                  <td className="n">{c ? c.map((v) => v ?? "—").join(" / ") : "—"}</td>
                  <td className="n">{w.rival ? `${w.rival.won}/${w.rival.total} (${md(w.rival.day)})` : "기록 없음"}</td>
                  <td>{rounds.length ? rounds.join(" · ") : "—"}</td>
                  <td className="n">{w.inquiries === null ? "확인 못함" : `${w.inquiries}건`}</td>
                </tr>
              );
            })}
            {!g?.weeks && <tr><td colSpan={7}>확인 못함</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
