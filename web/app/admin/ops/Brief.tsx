import { readBrief, type BriefExtras } from "@/lib/brief";
import { clientLine, kstDay, kstTime, type BriefFacts } from "@/lib/brief-core.mjs";
import { setCutoff } from "@/lib/brief-actions";

/**
 * 오늘 한 일 — 마감 시각으로 자른 하루의 브리핑.
 *
 * 「오늘 뭐 했지」를 기억으로 말하지 않는다. DB·저장소·GitHub 에 남은 것만 적는다.
 * 남은 게 없으면 「없음」이라고 적는다 — 그것도 보고다.
 */

const md = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;

function left(end: Date) {
  const m = Math.max(0, Math.round((end.getTime() - Date.now()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

function Body({ day, facts, extras, extrasAt, live }: {
  day: string; facts: BriefFacts; extras: BriefExtras | null; extrasAt: string | null; live: boolean;
}) {
  // 창은 전날 마감 시각부터라 18:49 다음에 11:38 이 온다. 전날 것은 전날이라고 적는다.
  const when = (iso: string | null) => (iso ? `${kstDay(iso) === day ? "" : "전날 "}${kstTime(iso)}` : "—");
  const work = facts.clients.flatMap((c) => c.work.map((w) => ({ ...w, name: c.name })));
  const commits = extras?.commits ?? null;
  return (
    <>
      <div className="brf-grid">
        {facts.clients.map((c) => (
          <div className="brf-card" key={c.slug}>
            <div className="brf-name">{c.name}</div>
            <div className="brf-line">{clientLine(c)}</div>
            {c.published.length > 0 && (
              <ul className="brf-list">
                {c.published.map((p) => <li key={p.slug}>발행 · {p.title}</li>)}
              </ul>
            )}
            {c.firstHits.length > 0 && (
              <ul className="brf-list">
                {c.firstHits.slice(0, 4).map((h) => <li key={h}>처음 노출 · {h}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="brf-cols">
        <div className="brf-box">
          <div className="brf-h">손댄 일 · {work.length}건</div>
          {work.length ? (
            <ul className="brf-list">
              {work.map((w, i) => (
                <li key={i}><span className="mono">{when(w.at)}</span> [{w.name}] {w.what}</li>
              ))}
            </ul>
          ) : <p className="brf-none">기록된 작업이 없습니다. 했는데 안 적었다면 log-intervention.mjs 로 남기세요.</p>}
        </div>

        <div className="brf-box">
          <div className="brf-h">코드·문서 변경 · {commits ? `${commits.length}건` : "—"}</div>
          {commits === null ? (
            <p className="brf-none">GitHub 이 3시간마다 채웁니다. 아직 이 창의 기록이 없습니다.</p>
          ) : commits.length ? (
            <ul className="brf-list">
              {commits.slice(0, 12).map((c) => (
                <li key={c.hash}><span className="mono">{when(c.at)}</span> {c.subject}</li>
              ))}
              {commits.length > 12 && <li className="brf-more">외 {commits.length - 12}건</li>}
            </ul>
          ) : <p className="brf-none">커밋 없음</p>}
          {live && extrasAt && <div className="brf-at">GitHub 기록 {ago(extrasAt)} 갱신</div>}
        </div>
      </div>

      <div className="brf-cols">
        <div className="brf-box">
          <div className="brf-h">바깥에서 온 것</div>
          <div className="brf-kv"><span>상담 신청·리드</span><b>{facts.leads.length}건</b></div>
          <div className="brf-kv"><span>상담 기록(어떻게 알고 오셨나)</span><b>{facts.inquiries}건</b></div>
          <div className="brf-kv"><span>랜딩 무료 진단</span><b>{facts.publicScans}건</b></div>
          {facts.leads.slice(0, 4).map((l, i) => (
            <div className="brf-sub" key={i}>
              {l.at ? kstTime(l.at) : ""} · {l.company ?? "회사 미기재"} · 경로 {l.referral ?? "—"}
            </div>
          ))}
        </div>
        <div className="brf-box">
          <div className="brf-h">자동 작업 · 정찰</div>
          {extras?.runs ? (
            extras.runs.length ? extras.runs.map((r) => (
              <div className="brf-kv" key={r.name}>
                <span>{r.name}</span>
                <b className={r.fail ? "bad" : ""}>{r.ok}회 성공{r.fail ? ` · ${r.fail}회 실패` : ""}</b>
              </div>
            )) : <p className="brf-none">실행 없음</p>
          ) : <p className="brf-none">GitHub 기록 대기</p>}
          {extras?.issues && (
            <div className="brf-sub">
              정찰 이슈 새로 {extras.issues.opened.length}건 · 닫힘 {extras.issues.closed.length}건
              {extras.issues.opened.slice(0, 3).map((x) => <div key={x.number}>#{x.number} {x.title}</div>)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default async function Brief() {
  const b = await readBrief();

  return (
    <section className="brf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="brf-top">
        <div>
          <h2 className="brf-title">오늘 한 일 · {md(b.open.day)} 마감분</h2>
          <p className="brf-range">
            {md(b.closed.day)} {b.cutoff} ~ {md(b.open.day)} {b.cutoff}
            <span className="brf-state">진행 중 · 마감까지 {left(b.open.end)}</span>
          </p>
        </div>
        <form action={setCutoff} className="brf-cut">
          <label htmlFor="brf-cutoff">마감 시각</label>
          <input id="brf-cutoff" type="time" name="cutoff" defaultValue={b.cutoff} step={60} required />
          <button type="submit">저장</button>
        </form>
      </div>

      {b.live ? (
        <Body day={b.open.day} facts={b.live} extras={b.snapshot?.extras ?? null} extrasAt={b.snapshot?.updatedAt ?? null} live />
      ) : (
        <p className="brf-none">DB 를 못 읽었습니다.</p>
      )}

      <h3 className="brf-pasth">지난 마감 브리핑</h3>
      {b.history.length === 0 && <p className="brf-none">아직 마감된 날이 없습니다.</p>}
      {b.history.map((h, i) => (
        // 방금 끝난 하루는 펼쳐 둔다. 마감 직후에 열면 그게 「오늘 한 일」이다.
        <details className="brf-day" key={h.day} open={i === 0 && h.day === b.closed.day}>
          <summary>
            <b>{md(h.day)} 마감</b>
            <span>
              {h.status === "closed" ? "기록 굳음" : "DB 몫만 방금 셈 · 커밋·실행 기록은 GitHub 이 3시간 안에 굳힘"}
              {h.facts ? ` · 손댄 일 ${h.facts.clients.reduce((n, c) => n + c.work.length, 0)}건` : ""}
              {h.extras?.commits ? ` · 커밋 ${h.extras.commits.length}건` : ""}
            </span>
          </summary>
          {h.facts ? <Body day={h.day} facts={h.facts} extras={h.extras} extrasAt={null} live={false} /> : null}
        </details>
      ))}
    </section>
  );
}

const CSS = `
.brf{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px 18px}
.brf-top{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap}
.brf .brf-title{font-size:19px;font-weight:900;letter-spacing:-.03em;margin:0;padding:0}
.brf-range{margin:6px 0 0;font-size:13px;color:var(--mut)}
.brf-state{margin-left:10px;padding:2px 9px;border-radius:999px;background:rgba(61,214,196,.12);color:var(--cool);font-size:12px;font-weight:700}
.brf-cut{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink2)}
.brf-cut input{background:var(--sunk);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:6px 8px;font:inherit;color-scheme:dark}
.brf-cut button{background:var(--acc);color:#1A1204;border:0;border-radius:8px;padding:7px 13px;font-weight:800;cursor:pointer}
.brf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:10px;margin-top:16px}
.brf-card,.brf-box{background:var(--sunk);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.brf-name{font-size:14px;font-weight:800}
.brf-line{margin-top:5px;font-size:13px;color:var(--ink2);line-height:1.6}
.brf-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:10px;margin-top:10px}
.brf-h{font-size:12.5px;font-weight:800;color:var(--ink);margin-bottom:8px}
.brf-list{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:12.8px;color:var(--ink2);line-height:1.5}
.brf-list .mono{color:var(--faint);margin-right:6px}
.brf-more{color:var(--faint)}
.brf-none{margin:4px 0 0;font-size:12.8px;color:var(--faint)}
.brf-at{margin-top:8px;font-size:11.5px;color:var(--faint)}
.brf-kv{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--ink2);padding:4px 0;border-bottom:1px solid var(--soft)}
.brf-kv:last-of-type{border-bottom:0}
.brf-kv b{color:var(--ink);font-weight:700}
.brf-kv b.bad{color:var(--crit)}
.brf-sub{margin-top:8px;font-size:12px;color:var(--mut);line-height:1.6}
.brf .brf-pasth{margin:22px 0 0;padding:14px 0 0;border-top:1px dashed var(--line);font-size:14px;font-weight:800;color:var(--mut)}
.brf details.brf-day,.brf details.brf-day[open]{margin-top:10px;background:transparent;border:1px solid var(--line);border-radius:12px;box-shadow:none;overflow:visible}
.brf details.brf-day summary{padding:11px 14px;font-size:13px;font-weight:500;color:var(--mut);justify-content:flex-start;flex-wrap:wrap;gap:4px 12px}
.brf details.brf-day summary b{font-size:14px;font-weight:800;color:var(--ink)}
.brf details.brf-day summary::after{margin-left:auto;color:var(--mut);font-size:18px}
.brf details.brf-day > .brf-grid{margin-top:0}
.brf details.brf-day > *:not(summary){margin-left:12px;margin-right:12px}
.brf details.brf-day > *:last-child{margin-bottom:12px}
.brf details p.brf-none{padding:0;font-size:12.8px;color:var(--faint);max-width:none}
`;
