import { readOps } from "@/lib/ops";
import Live from "./Live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 운영 대시보드 — AI 직원이 무슨 일을 하고 있는지 한눈에 본다.
 *
 * 숫자는 전부 DB 에서 읽는다. 못 읽으면 "확인 못함"으로 적는다.
 * 사이티드는 이 숫자를 파는 회사라, 여기에 지어낸 값이 들어가면 사업이 무너진다.
 */

/** 하루 시간표. 예약 실행(cron)과 GitHub Actions 를 갈라서 적는다. */
const SLOTS = [
  { at: "02:13", name: "심야 점검", team: "운영", need: "세션" },
  { at: "03:23", name: "스냅샷 · 색인 알림", team: "운영", need: "무관" },
  { at: "07:41", name: "노출 측정 · 리포트 갱신", team: "측정", need: "무관" },
  { at: "08:47", name: "아침 브리핑", team: "측정", need: "세션" },
  { at: "10:23", name: "주간 정리", team: "운영", need: "세션", dow: 1 },
  { at: "11:41", name: "색인 밀기", team: "유통", need: "세션" },
  { at: "14:23", name: "글 작업", team: "콘텐츠", need: "세션" },
  { at: "18:53", name: "저녁 정리", team: "유통", need: "세션" },
  { at: "21:37", name: "하루 마감", team: "운영", need: "세션" },
];

const TEAMS = [
  {
    key: "측정",
    what: "지금 어디까지 왔는지 잰다",
    jobs: ["검색 노출 (Bing·네이버)", "크롤러 방문·커버리지", "플레이스 순위", "사이트 진단 점수"],
    tools: ["check-index.mjs", "naver-place-check.mjs", "probe/src/scan.js"],
  },
  {
    key: "콘텐츠",
    what: "인용될 문장을 만든다",
    jobs: ["주제 선정 (topics.json)", "집필", "도해 SVG → PNG", "AI 티 검사"],
    tools: ["seed-post-*.mjs", "svg-to-png.mjs", "slop-check.mjs"],
  },
  {
    key: "유통",
    what: "만든 것을 밖으로 내보낸다",
    jobs: ["네이버 블로그 이관", "구글 색인 요청", "IndexNow 알림", "서식·태그"],
    tools: ["naver-blog-post.mjs", "submit-gsc.mjs", "indexnow.mjs"],
  },
  {
    key: "운영",
    what: "끊기지 않게 지킨다",
    jobs: ["상태 점검 (6시간마다)", "브리핑", "케이스 리포트", "커밋·푸시"],
    tools: ["health.mjs", "briefing.mjs", "case-report.mjs"],
  },
];

const HUMAN = [
  { t: "로그인", d: "구글 서치콘솔 · 네이버. 창은 열어 주지만 로그인은 사람이" },
  { t: "촬영과 목소리", d: "영상은 대본·도해·모션까지만. 찍는 건 사람이" },
  { t: "상담 기록", d: "“어떻게 알고 오셨어요” — 매출 검증의 유일한 고리" },
  { t: "발행 전 확인", d: "지어낸 사실이 없는지. 이건 사람이 봐야 한다" },
];

const CSS = `
.ops{--bg:#0C1016;--card:#141A22;--sunk:#10151C;--line:#232C38;--soft:#1A222C;
  --ink:#E8EDF3;--ink2:#A7B2C0;--mut:#7B8696;--faint:#5A6474;
  --acc:#F5A623;--cool:#3DD6C4;--ok:#3DD6A0;--warn:#E0A93C;--crit:#D2705F;
  background:var(--bg);color:var(--ink);min-height:100vh;
  font-family:"Noto Sans KR",system-ui,sans-serif;padding:38px 0 90px}
.ops .w{max-width:1180px;margin:0 auto;padding:0 26px}
.ops .mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
.ops h1{font-size:26px;font-weight:900;letter-spacing:-.035em;margin:0}
.ops .eb{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--acc);margin-bottom:8px}
.ops h2{font-size:17px;font-weight:800;letter-spacing:-.025em;margin:46px 0 4px}
.ops .sub{font-size:13.5px;color:var(--mut);margin:0 0 16px}

.ops-top{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;
  flex-wrap:wrap;padding-bottom:22px;border-bottom:1px solid var(--line)}
.ops-live{text-align:right}
.ops-clock{font-size:34px;font-weight:500;letter-spacing:-.02em;line-height:1;
  font-variant-numeric:tabular-nums;color:var(--ink)}
.ops-next{font-size:13px;color:var(--mut);margin-top:7px}
.ops-next b{color:var(--acc)}
.ops-gap{margin-left:9px;padding:2px 8px;border-radius:5px;background:var(--soft);
  color:var(--faint);font-size:11.5px}

.ops-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:11px;margin-top:20px}
.ops-kpi{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 17px;
  position:relative;overflow:hidden}
.ops-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--faint)}
.ops-kpi.ok::before{background:var(--ok)} .ops-kpi.warn::before{background:var(--warn)}
.ops-kpi.crit::before{background:var(--crit)}
.ops-kpi .v{font-family:"IBM Plex Mono",monospace;font-size:27px;font-weight:500;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ops-kpi .v small{font-size:13px;color:var(--mut);margin-left:4px}
.ops-kpi .k{font-size:12.5px;color:var(--mut);margin-top:5px}

.ops-tl{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:14px}
.ops-slot{display:grid;grid-template-columns:76px 108px 1fr 92px;align-items:center;
  padding:12px 18px;border-bottom:1px solid var(--soft);font-size:14px}
.ops-slot:last-child{border-bottom:0}
.ops-slot .t{font-family:"IBM Plex Mono",monospace;font-size:13.5px;color:var(--ink2);
  font-variant-numeric:tabular-nums}
.ops-slot .n{font-weight:600}
.ops-slot .badge{justify-self:start;font-family:"IBM Plex Mono",monospace;font-size:10.5px;
  letter-spacing:.08em;padding:3px 8px;border-radius:5px;background:var(--soft);color:var(--mut)}
.ops-slot .need{justify-self:end;font-size:11.5px;color:var(--faint)}
.ops-slot .need.auto{color:var(--ok)}

.ops-org{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:12px;margin-top:14px}
.ops-team{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.ops-team h3{font-size:15.5px;font-weight:800;margin:0 0 3px;letter-spacing:-.02em}
.ops-team .what{font-size:12.5px;color:var(--mut);margin-bottom:14px}
.ops-team ul{margin:0;padding-left:15px;list-style:none}
.ops-team li{position:relative;font-size:13.3px;color:var(--ink2);margin-bottom:6px;padding-left:11px}
.ops-team li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;
  border-radius:50%;background:var(--acc);opacity:.8}
.ops-team .tools{margin-top:13px;padding-top:11px;border-top:1px solid var(--soft);
  font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--faint);line-height:1.85}

.ops-human{background:var(--sunk);border:1px solid var(--line);border-left:3px solid var(--cool);
  border-radius:0 14px 14px 0;padding:18px 22px;margin-top:14px}
.ops-human .row{display:flex;gap:14px;padding:9px 0;border-bottom:1px solid var(--soft);font-size:13.5px}
.ops-human .row:last-child{border-bottom:0}
.ops-human b{color:var(--cool);min-width:104px;font-weight:700}
.ops-human span{color:var(--ink2)}

.ops-tw{overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:var(--card);margin-top:14px}
.ops table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:460px}
.ops th,.ops td{text-align:left;padding:11px 16px;border-bottom:1px solid var(--soft)}
.ops thead th{background:var(--sunk);font-size:11px;letter-spacing:.08em;color:var(--mut);font-weight:600}
.ops tbody tr:last-child td{border-bottom:0}
.ops td.m{font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--mut);
  white-space:nowrap;font-variant-numeric:tabular-nums}
.ops td b{color:var(--ink)}
.ops .bar{display:inline-block;width:74px;height:5px;border-radius:3px;background:var(--soft);
  overflow:hidden;vertical-align:middle;margin-right:9px}
.ops .bar i{display:block;height:100%;background:var(--cool)}
.ops .err{background:#1E1416;border:1px solid #3D2A2C;border-radius:12px;padding:16px 20px;
  color:#D2705F;font-size:13.5px;margin-top:14px}
@media(max-width:640px){
  .ops-slot{grid-template-columns:70px 1fr;row-gap:5px}
  .ops-slot .badge,.ops-slot .need{justify-self:start}
}
`;

const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "—";

export default async function OpsPage({
  searchParams,
}: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const token = process.env.ADMIN_TOKEN;
  if (token && key !== token) {
    return (
      <div className="wrap" style={{ paddingTop: 80, maxWidth: 520 }}>
        <h1 style={{ fontSize: 24 }}>접근 권한이 없습니다</h1>
        <p className="formnote">/admin/ops?key=... 형식으로 토큰을 붙여 주세요.</p>
      </div>
    );
  }

  const d = await readOps();
  const covLead = d.crawl.vendors[0];

  return (
    <div className="ops">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="ops-top">
          <div>
            <div className="eb">Cited · 운영 현황</div>
            <h1>AI 직원이 하고 있는 일</h1>
          </div>
          <Live slots={SLOTS} />
        </div>

        {!d.ok && <div className="err">데이터를 못 읽었습니다 — {d.err}</div>}

        {/* 요약 먼저. 자세한 건 아래에 */}
        <div className="ops-kpis">
          <div className={`ops-kpi ${d.posts.sinceDays === null ? "" : d.posts.sinceDays <= 7 ? "ok" : "warn"}`}>
            <div className="v">{d.posts.published}<small>편</small></div>
            <div className="k">발행 · 마지막 {d.posts.sinceDays ?? "?"}일 전</div>
          </div>
          <div className={`ops-kpi ${d.crawl.last24h > 0 ? "ok" : "crit"}`}>
            <div className="v">{d.crawl.last24h}<small>회</small></div>
            <div className="k">24시간 크롤러</div>
          </div>
          <div className={`ops-kpi ${covLead && covLead.pct >= 80 ? "ok" : "warn"}`}>
            <div className="v">{covLead ? covLead.pct.toFixed(0) : "—"}<small>%</small></div>
            <div className="k">최고 커버리지 · {covLead?.vendor ?? "—"}</div>
          </div>
          <div className={`ops-kpi ${d.serp.hits.length > 0 ? "ok" : "warn"}`}>
            <div className="v">{d.serp.hits.length}<small> / {d.serp.total}</small></div>
            <div className="k">검색 노출 · {fmtDay(d.serp.day)} 측정</div>
          </div>
          <div className={`ops-kpi ${d.place.length ? "ok" : ""}`}>
            <div className="v">{d.place.length ? `${d.place[0].rank}위` : "—"}</div>
            <div className="k">플레이스 최고 · {d.place[0]?.query ?? "미측정"}</div>
          </div>
        </div>

        <h2>하루 시간표</h2>
        <p className="sub">
          「세션」은 클로드가 켜져 있어야 도는 일, 「자동」은 GitHub 이 돌려서 그것과 상관없는 일입니다.
        </p>
        <div className="ops-tl">
          {SLOTS.map((s) => (
            <div className="ops-slot" key={s.at + s.name}>
              <span className="t">{s.at}</span>
              <span className="badge">{s.team}</span>
              <span className="n">
                {s.name}
                {s.dow !== undefined && <span className="ops-gap">월요일만</span>}
              </span>
              <span className={`need ${s.need === "무관" ? "auto" : ""}`}>
                {s.need === "무관" ? "자동" : "세션 필요"}
              </span>
            </div>
          ))}
        </div>

        <h2>조직도</h2>
        <p className="sub">한 사람이 하는 일을 네 자리로 나눠 두었습니다. 자리마다 도구가 다릅니다.</p>
        <div className="ops-org">
          {TEAMS.map((t) => (
            <div className="ops-team" key={t.key}>
              <h3>{t.key}</h3>
              <div className="what">{t.what}</div>
              <ul>{t.jobs.map((j) => <li key={j}>{j}</li>)}</ul>
              <div className="tools">{t.tools.join("\n")}</div>
            </div>
          ))}
        </div>

        <h2>사람만 할 수 있는 일</h2>
        <p className="sub">이건 자동화하지 않습니다. 자동화하면 안 되는 것도 있습니다.</p>
        <div className="ops-human">
          {HUMAN.map((h) => (
            <div className="row" key={h.t}><b>{h.t}</b><span>{h.d}</span></div>
          ))}
        </div>

        <h2>크롤러 커버리지</h2>
        <p className="sub">전체 {d.crawl.totalPages}쪽 중 몇 쪽을 읽어 갔는가.</p>
        <div className="ops-tw">
          <table>
            <thead><tr><th>크롤러</th><th>방문</th><th>읽은 쪽</th><th>커버리지</th></tr></thead>
            <tbody>
              {d.crawl.vendors.map((v) => (
                <tr key={v.vendor}>
                  <td><b>{v.vendor}</b></td>
                  <td className="m">{v.hits}</td>
                  <td className="m">{v.pages}</td>
                  <td className="m">
                    <span className="bar"><i style={{ width: `${Math.min(100, v.pct)}%` }} /></span>
                    {v.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {!d.crawl.vendors.length && <tr><td colSpan={4}>기록 없음</td></tr>}
            </tbody>
          </table>
        </div>

        <h2>검색에 처음 나온 날</h2>
        <p className="sub">영업에서 쓰는 날짜입니다. 기억으로 말하면 안 됩니다.</p>
        <div className="ops-tw">
          <table>
            <thead><tr><th>날짜</th><th>어디</th><th>검색어</th></tr></thead>
            <tbody>
              {d.firstSeen.map((f) => (
                <tr key={f.engine + f.query}>
                  <td className="m">{fmtDay(f.day)}</td>
                  <td className="m">{f.engine === "naver" ? "네이버" : "Bing"}</td>
                  <td><b>{f.query}</b></td>
                </tr>
              ))}
              {!d.firstSeen.length && <tr><td colSpan={3}>아직 없음</td></tr>}
            </tbody>
          </table>
        </div>

        <h2>최근 발행</h2>
        <div className="ops-tw">
          <table>
            <thead><tr><th>날짜</th><th>제목</th></tr></thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.slug}>
                  <td className="m">{fmtDay(r.at)}</td>
                  <td>
                    <a href={`https://robotncoding.com/blog/${r.slug}`}
                       target="_blank" rel="noopener" style={{ color: "var(--cool)" }}>
                      {r.title}
                    </a>
                  </td>
                </tr>
              ))}
              {!d.recent.length && <tr><td colSpan={2}>없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
