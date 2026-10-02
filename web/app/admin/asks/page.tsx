import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/admin-auth";
import { listClients } from "@/lib/ops";
import { readAskDays, readAsks, readAskGrid, readProbeGrid, readWeekRates, mainMethod, RESULT_TEXT, type AskResult, type AskDay } from "@/lib/asks";
import AdminNav from "../AdminNav";

/**
 * AI 에게 물어본 기록 — 날짜를 고르면 그날 어떤 질문을, 어느 AI 에, 몇 시에 물었고 무엇이 나왔는지.
 * 기록은 측정이 매일 쌓는 academy.ai_measurements 를 그대로 읽는다. 여기서 만들거나 고치지 않는다.
 * 물어본 곳이 다르면 숫자를 합치지 않는다 — 요약도 곳마다 한 줄.
 */

const HERE = "/admin/asks";
const CHIPS = 14;   // 날짜 칩은 최근 2주만 펼치고 나머지는 접는다

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const mdShort = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dow = (d: string) => DOW[new Date(`${d}T00:00:00Z`).getUTCDay()];
const span = (a: string | null, b: string | null) => (a ? (b && b !== a ? `${a} ~ ${b}` : a) : null);

const MARK: Record<AskResult, string> = { both: "●", cited: "●", named: "◐", none: "·" };

const CSS = `
.ak-days{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.ak-days a{border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:14px;color:var(--ink2);text-decoration:none;background:var(--sunk);line-height:1.35}
.ak-days a b{display:block;color:var(--ink);font-size:15px}
.ak-days a.on{border-color:var(--acc);background:rgba(245,166,35,.08)}
.ak-old{margin-top:8px;border:0;border-radius:0;background:none;overflow:visible;box-shadow:none}
.ak-old>summary{cursor:pointer;font-size:14px;font-weight:inherit;color:var(--ink2);display:list-item;padding:0}
.ak-old>summary::after{content:none;display:none}
.ak-sum{margin-top:16px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.ak-sum h2{margin:0 0 6px;font-size:19px}
.ak-sum ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ak-sum li{font-size:16px}
.ak-sum li b{color:var(--acc)}
.ak-sum li span{display:block;font-size:14px;color:var(--ink2)}
.ak-list{list-style:none;margin:12px 0 0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ak-list>li{border-bottom:1px solid var(--soft)}
.ak-list>li:last-child{border-bottom:0}
.ak-list>li::marker{content:""}
/* 랜딩 globals.css 의 details·summary 규칙을 끊는다 (::after 의 「−」가 칸 사이에 떠 있었다) */
.ak-list details{border:0;border-radius:0;background:none;overflow:visible;box-shadow:none;margin:0}
.ak-list summary{cursor:pointer;list-style:none;display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:baseline;padding:11px 16px;font-size:inherit;font-weight:inherit}
.ak-list summary::-webkit-details-marker{display:none}
.ak-list summary::marker{content:""}
.ak-list summary::after,.ak-list details[open] summary::after{content:none;display:none}
.ak-t{font-variant-numeric:tabular-nums;color:var(--ink2);font-size:14px}
.ak-q{min-width:0}
.ak-q small{display:block;color:var(--ink2);font-size:13px;margin-top:2px}
.ak-r{font-size:14px;font-weight:700;white-space:nowrap;border-radius:999px;padding:2px 10px;border:1px solid var(--line);color:var(--ink2)}
.ak-r.both,.ak-r.cited{color:var(--ok);border-color:rgba(61,214,160,.4)}
.ak-r.named{color:var(--warn);border-color:rgba(224,169,60,.4)}
.ak-body{padding:0 16px 14px 80px;font-size:15px;color:var(--ink2)}
.ak-body h4{margin:10px 0 4px;font-size:14px;color:var(--ink)}
.ak-ans{white-space:pre-wrap;background:var(--sunk);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0;line-height:1.65}
.ak-src{margin:0;padding-left:18px}
.ak-src li.ours{color:var(--ok);font-weight:700}
.ak-src a{color:inherit}
.ak-grid{margin-top:10px;overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.ak-grid table{border-collapse:collapse;font-size:14px;width:100%}
.ak-grid th,.ak-grid td{padding:7px 8px;border-bottom:1px solid var(--soft);text-align:center;white-space:nowrap}
.ak-grid th:first-child,.ak-grid td:first-child{text-align:left;white-space:normal;min-width:260px}
.ak-grid thead th{color:var(--ink2);font-weight:600;background:var(--sunk)}
.ak-grid td.both,.ak-grid td.cited{color:var(--ok)}
.ak-grid td.named{color:var(--warn)}
.ak-grid td.none{color:var(--faint)}
.ak-grid td small{color:var(--ink2);font-size:12px}
.ak-note{font-size:13px;font-weight:400;color:var(--ink2);margin-left:8px}
.ak-key{font-size:14px;color:var(--ink2);margin:8px 0 0}
@media(max-width:640px){
  .ak-list summary{grid-template-columns:44px 1fr;row-gap:4px}
  .ak-r{grid-column:2;justify-self:start}
  .ak-body{padding-left:16px}
  .ak-grid th:first-child,.ak-grid td:first-child{min-width:200px}
}
`;

/** 날짜 칩 한 칸 — 한 곳이면 그 숫자(이름 질문 빼고), 여러 곳이면 몇 곳인지만 (합치지 않는다) */
function Chip({ x, on, href }: { x: AskDay; on: boolean; href: string }) {
  const p = x.places;
  return (
    <Link href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
      <b>{mdShort(x.day)} ({dow(x.day)})</b>
      {p.length === 1 ? `이름 ${p[0].named} · 링크 ${p[0].cited} / ${p[0].n}` : `${p.length}곳에 물음`}
    </Link>
  );
}

export default async function AsksPage({
  searchParams,
}: { searchParams: Promise<{ key?: string; c?: string; d?: string }> }) {
  const { key, c: want, d: wantDay } = await searchParams;
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(HERE));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const clients = await listClients();
  const client = clients.find((x) => x.slug === want) ?? clients[0] ?? null;
  const q = (extra: string) => `${HERE}?${client ? `c=${client.slug}&` : ""}${extra}`;

  let err: string | null = null;
  let days: AskDay[] = [];
  let rows: Awaited<ReturnType<typeof readAsks>> = [];
  let grid: Awaited<ReturnType<typeof readAskGrid>> | null = null;
  let probe: Awaited<ReturnType<typeof readProbeGrid>> = null;
  let week: Awaited<ReturnType<typeof readWeekRates>> | null = null;
  let day: string | null = null;
  if (client) {
    try {
      days = await readAskDays(client);
      day = days.find((x) => x.day === wantDay)?.day ?? days[0]?.day ?? null;
      const main = mainMethod(days);
      [rows, grid, probe, week] = await Promise.all([
        day ? readAsks(client, day) : Promise.resolve([]),
        main ? readAskGrid(client, main, 14) : Promise.resolve(null),
        readProbeGrid(client, 14),
        readWeekRates(client),
      ]);
    } catch (e) {
      console.error("asks", e);
      err = "기록을 못 읽었습니다";
    }
  }
  const sel = days.find((x) => x.day === day) ?? null;

  return (
    <div className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>AI 에게 물어본 기록</h1>
          <AdminNav here="/admin/asks" />
        </div>
        <p className="sub">
          사람들이 AI 에 물을 법한 질문을 매일 똑같이 물어보고, 답에 {client ? `${client.name} 이름` : "이름"}과 우리 사이트 링크가 나오는지 적습니다.
          머리 숫자는 이름 질문(질문에 이름이 든 것)을 뺀 질문만 셉니다 — 이름 질문은 답이 이름을 따라 말해 노출 성과가 아닙니다.
          기록은 지우지 않고 날짜별로 쌓입니다. 시각은 한국 시간입니다.
        </p>

        {clients.length > 1 && (
          <div className="ak-days" aria-label="고객사">
            {clients.map((x) => (
              <Link key={x.slug} href={`${HERE}?c=${x.slug}`} className={x.slug === client?.slug ? "on" : ""}>{x.name}</Link>
            ))}
          </div>
        )}

        {err && <p className="sub" style={{ color: "var(--crit)" }}>{err}</p>}
        {!err && !days.length && <p className="sub" style={{ marginTop: 16 }}>아직 물어본 기록이 없습니다.</p>}

        {week && week.places.length > 0 && (
          <div className="ak-sum">
            <h2>곳마다 잰 방법</h2>
            <ul>
              {week.places.map((p) => (
                <li key={p.method}>
                  {p.where} — 방법: {p.how}
                  <span>
                    기간 {mdShort(p.first)}~{mdShort(p.last)} (잰 날 {p.days}일) · 표본 {p.n}
                    {p.week.n > 0 && <> · 최근 7일 <b>{p.week.n}번 중 {p.week.k}번</b> 이름이나 링크가 나옴(이름 질문 빼고)</>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="ak-key">
              답 원문과 출처 목록은 질문마다 보관합니다 ({week.places.reduce((a, p) => a + p.n, 0)}건 중 {week.places.reduce((a, p) => a + p.kept, 0)}건).
              비율은 곳마다 따로 셉니다. 방법이 다르면 합치지 않습니다.
            </p>
          </div>
        )}

        {days.length > 0 && (
          <>
            <h2>날짜</h2>
            <nav className="ak-days" aria-label="측정한 날">
              {days.slice(0, CHIPS).map((x) => <Chip key={x.day} x={x} on={x.day === day} href={q(`d=${x.day}`)} />)}
            </nav>
            {days.length > CHIPS && (
              <details className="ak-old" open={!!day && days.findIndex((x) => x.day === day) >= CHIPS}>
                <summary>그 전 날짜 {days.length - CHIPS}일</summary>
                <nav className="ak-days" aria-label="그 전 측정한 날">
                  {days.slice(CHIPS).map((x) => <Chip key={x.day} x={x} on={x.day === day} href={q(`d=${x.day}`)} />)}
                </nav>
              </details>
            )}
          </>
        )}

        {sel && (
          <>
            <div className="ak-sum">
              <h2>{md(sel.day)}</h2>
              <ul>
                {sel.places.map((p) => (
                  <li key={p.method}>
                    {p.where} — 질문 {p.n}개 중 <b>{p.named}개</b> 답에 {client ? `${client.name} 이름` : "이름"}, <b>{p.cited}개</b> 답에 우리 사이트 링크
                    {p.brand.n > 0 && <> · 이름 질문 {p.brand.n}개 중 {p.brand.named}개 — AI 가 이 사이트를 제대로 아는지 확인용(노출 성과 아님)</>}
                    <span>{span(p.first, p.last) ? `물어본 시각 ${span(p.first, p.last)}` : "손으로 잰 기록이라 시각 없음"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <h2>이날 물어본 질문</h2>
            <p className="sub">줄을 누르면 AI 가 한 답과 참고한 사이트가 보입니다.</p>
            <ol className="ak-list">
              {rows.map((r) => (
                <li key={r.id}>
                  <details>
                    <summary>
                      <span className="ak-t">{r.time ?? "—"}</span>
                      <span className="ak-q">
                        {r.question}
                        <small>{r.where}</small>
                      </span>
                      <span className={`ak-r ${r.result}`}>{RESULT_TEXT[r.result]}</span>
                    </summary>
                    <div className="ak-body">
                      <h4>AI 의 답</h4>
                      {r.answer ? <p className="ak-ans">{r.answer}</p> : <p>답을 저장하지 않은 기록입니다.</p>}
                      <h4>참고한 사이트 {r.sources.length}곳</h4>
                      {r.sources.length ? (
                        <ul className="ak-src">
                          {r.sources.map((s, i) => (
                            <li key={i} className={s.ours ? "ours" : ""}>
                              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.domain}</a> : s.domain}
                              {s.title && <> · {s.domain}</>}
                              {s.ours && " ← 우리 사이트"}
                            </li>
                          ))}
                        </ul>
                      ) : <p>없음</p>}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </>
        )}

        {grid && grid.days.length > 0 && (
          <>
            <h2>질문별 최근 2주 — {grid.where}</h2>
            <p className="ak-key">● 우리 링크가 붙음 · ◐ 이름만 나옴 · · 안 나옴 · 빈칸 안 물어봄</p>
            <div className="ak-grid">
              <table>
                <thead>
                  <tr><th>질문</th>{grid.days.map((d) => <th key={d}>{mdShort(d)}</th>)}</tr>
                </thead>
                <tbody>
                  {grid.rows.map((r) => (
                    <tr key={r.promptId}>
                      <td>{r.question}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className={c ?? ""} title={c ? RESULT_TEXT[c] : "안 물어봄"}>{c ? MARK[c] : ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {week && week.rows.length > 0 && (
          <>
            <h2>질문별 최근 7일 — 몇 번 중 몇 번</h2>
            <p className="ak-key">한 번 나온 것을 적중으로 세지 않습니다. 곳마다 물어본 횟수 중 {client ? `${client.name} 이름` : "이름"}이나 우리 링크가 나온 횟수입니다. 맨 아래 합계는 이름 질문을 뺍니다.</p>
            <div className="ak-grid">
              <table>
                <thead>
                  <tr><th>질문</th>{week.places.filter((p) => p.week.n > 0).map((p) => <th key={p.method}>{p.where}</th>)}</tr>
                </thead>
                <tbody>
                  {week.rows.map((r) => (
                    <tr key={r.promptId}>
                      <td>{r.question}</td>
                      {r.cells.map((c, i) => <td key={i}>{c ? `${c.n}번 중 ${c.k}번` : "—"}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <td><b>곳별 합계</b> <small className="ak-note">이름 질문 빼고</small></td>
                    {week.places.filter((p) => p.week.n > 0).map((p) => <td key={p.method}><b>{p.week.n}번 중 {p.week.k}번</b></td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {probe && probe.rows.length > 0 && (
          <>
            <h2>넓혀 본 질문 <small className="ak-note">승인 20문항과 따로 셉니다</small></h2>
            <p className="sub">
              잘 나오는 동네 질문을 「송파」「서울」「동네 없이」로 한 칸씩 넓히거나, 검색창에 치는 짧은 말(「송파구 코딩학원 추천」)로 바꿔 물어봅니다.
              어디서부터 안 나오는지 보려는 것이라 위의 숫자·효과 판정에는 넣지 않습니다.
            </p>
            <p className="ak-key">● 우리 링크가 붙음 · ◐ 이름만 나옴 · · 안 나옴 · 빈칸 안 물어봄</p>
            <div className="ak-grid">
              <table>
                <thead>
                  <tr><th>질문</th><th>모양</th><th>반경</th>{probe.days.map((d) => <th key={d}>{mdShort(d)}</th>)}</tr>
                </thead>
                <tbody>
                  {probe.rows.map((r) => (
                    <tr key={`${r.promptId}-${r.where}`}>
                      <td>{r.question}<br /><small>{r.where}</small></td>
                      <td>{r.form === "keyword" ? "검색어" : "문장"}</td>
                      <td>{r.radius === "없음" ? "지역 없음" : r.radius}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className={c ?? ""} title={c ? RESULT_TEXT[c] : "안 물어봄"}>{c ? MARK[c] : ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
