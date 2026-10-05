import { GROWTH_FOOT, kstDay, type GscRow } from "@/lib/growth-core.mjs";
import type { GrowthReports, GrowthWeek } from "@/lib/growth-reports";
import CoverageChart, { type CovSeries } from "./CoverageChart";

/**
 * 「문서딱 주간 성장 (문서딱 저장소 리포트)」 카드 (Step 36). 기존 Growth.tsx(우리 측정)와 다른 카드다.
 * 숫자는 문서딱 저장소 리포트 그대로 — 주 단위, 기간 날짜와 출처를 같이 적는다. 「방문자」라는 말을 쓰지 않는다.
 * 그래프는 주 2개 이상일 때만, Visits.tsx 와 같은 CoverageChart.
 */

const CSS = `
.gp-h3{font-size:17px;font-weight:800;margin:20px 0 8px;color:var(--ink)}
.gp-opp{font-size:16px;color:var(--ink2);margin:14px 0 0;word-break:keep-all}
.gp-opp a{color:var(--cool);font-weight:700}
.gp-note{font-size:15px;color:var(--ink2);margin:8px 0 0;white-space:pre-line;word-break:keep-all}
.gp-foot{font-size:14px;color:var(--ink2);margin:12px 0 0;word-break:keep-all;line-height:1.55}
`;

const n = (v: number) => v.toLocaleString("ko-KR");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pos = (v: number | null) => (v ? v.toFixed(1) : "-");
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default function GrowthReport({ data, name }: { data: GrowthReports; name: string }) {
  return (
    <section className="gr gr-card" aria-labelledby="gp-h">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h2 id="gp-h">{name} 주간 성장 ({name} 저장소 리포트)</h2>
      {!data.ok ? <p className="gr-empty">확인 못함 — {data.err}</p>
        : !data.weeks.length ? <p className="gr-empty">첫 리포트 전 — {name} 저장소가 매주 월 09:23 에 냅니다</p>
        : <Body data={data} name={name} />}
    </section>
  );
}

function Body({ data, name }: { data: Extract<GrowthReports, { ok: true }>; name: string }) {
  const latest = data.weeks[data.weeks.length - 1];
  // 서치콘솔 숫자가 있는 주만 점으로 — 빠진 주를 0 으로 그리지 않는다
  const withGsc = data.weeks.filter((w): w is GrowthWeek & { gsc: NonNullable<GrowthWeek["gsc"]> } => !!w.gsc);
  const series: CovSeries[] = [
    { vendor: "impr", label: "노출", color: "#7C8AF2", unit: "회", points: withGsc.map((w) => ({ day: w.gsc.range7.endDate, pages: w.gsc.last7.impressions })) },
    { vendor: "clicks", label: "클릭", color: "#1F9E90", unit: "회", points: withGsc.map((w) => ({ day: w.gsc.range7.endDate, pages: w.gsc.last7.clicks })) },
  ];
  const max = Math.max(0, ...withGsc.map((w) => w.gsc.last7.impressions));
  const o = data.opportunity;
  // GitHub 시각은 UTC — KST 날짜로
  const 갱신 = kstDay(o?.updatedAt);

  return <>
    <p className="d">{name} 저장소가 매주 월요일 내는 성장 리포트를 그대로 옮겼습니다. 서치콘솔은 구글 검색, Cloudflare 는 서버 통계입니다.</p>
    {data.stalled && <p className="err">리포트 멈춤 — 마지막 {latest.week}</p>}
    {latest.notes && <p className="gp-note">리포트 메모: {latest.notes}</p>}

    <div className="ops-tw">
      <table>
        <thead><tr><th>주</th><th>서치콘솔 7일</th><th>클릭</th><th>노출</th><th>CTR</th><th>평균 순위</th><th>Cloudflare 7일</th><th>요청</th><th>페이지뷰</th><th>일별 순방문자 합</th></tr></thead>
        <tbody>
          {[...data.weeks].reverse().map((w) => (
            <tr key={w.week}>
              <td className="m"><a href={w.sourceUrl} target="_blank" rel="noopener" style={{ color: "var(--cool)" }}>{w.week}</a></td>
              {w.gsc ? <>
                <td className="m">{md(w.gsc.range7.startDate)}~{md(w.gsc.range7.endDate)}</td>
                <td className="m">{n(w.gsc.last7.clicks)}</td>
                <td className="m">{n(w.gsc.last7.impressions)}</td>
                <td className="m">{pct(w.gsc.last7.ctr)}</td>
                <td className="m">{pos(w.gsc.last7.position)}</td>
              </> : <td colSpan={5}>리포트에 없음</td>}
              {w.cf ? <>
                <td className="m">~{md(w.cf.until)} · {w.cf.last7.days}일</td>
                <td className="m">{n(w.cf.last7.requests)}</td>
                <td className="m">{n(w.cf.last7.pageViews)}</td>
                <td className="m">{n(w.cf.last7.uniques)}</td>
              </> : <td colSpan={4}>리포트에 없음</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {withGsc.length >= 2 && max > 0 && <CoverageChart total={max} series={series} what="주별 서치콘솔 7일 노출과 클릭" table={false} />}

    <h3 className="gp-h3">많이 나온 검색어 — {latest.week} 리포트 28일, 상위 10</h3>
    <Rows rows={latest.queries28?.slice(0, 10) ?? null} keyName="검색어" />
    <h3 className="gp-h3">많이 나온 페이지 — {latest.week} 리포트 28일, 상위 5</h3>
    <Rows rows={latest.pages28?.slice(0, 5) ?? null} keyName="페이지" />

    <p className="gp-opp">
      {!o || o.none || o.count === 0 ? <>{name} 세션에 넘길 제안 0건(노출 기준 미달)</>
        : o.count == null ? <>{o.url ? <a href={o.url} target="_blank" rel="noopener">건수 못 읽음 — 이슈 열기</a> : "건수 못 읽음"}</>
        : <>{name} 세션에 넘길 제안 {o.count}건 → {o.url ? <a href={o.url} target="_blank" rel="noopener">이슈 열기</a> : "이슈 주소 없음"}
          {갱신 && <> · 갱신 {md(갱신)}</>}</>}
    </p>

    {GROWTH_FOOT.map((l) => <p key={l} className="gp-foot">{l}</p>)}
  </>;
}

function Rows({ rows, keyName }: { rows: GscRow[] | null; keyName: string }) {
  if (!rows) return <p className="gr-empty">리포트 표 모양이 바뀌어 못 읽었습니다 — 합계는 위 표에 있습니다</p>;
  return (
    <div className="ops-tw">
      <table>
        <thead><tr><th>{keyName}</th><th>클릭</th><th>노출</th><th>CTR</th><th>평균 순위</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.key}-${i}`}>
              <td style={{ overflowWrap: "anywhere" }}>{r.key}</td>
              <td className="m">{n(r.clicks)}</td>
              <td className="m">{n(r.impressions)}</td>
              <td className="m">{pct(r.ctr)}</td>
              <td className="m">{pos(r.position)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5}>리포트에 없음</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
