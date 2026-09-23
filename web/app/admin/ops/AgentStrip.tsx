"use client";

import { useEffect, useRef, useState } from "react";

import type { Agents, AgentState } from "@/lib/agents";

/**
 * ② 에이전트 직원 — 지금. 45초마다 /api/admin/agents 를 다시 읽는다.
 *
 * 판정은 서버가 한다. 여기서는 그리고, 「n분 전」을 1분마다 다시 세고, 바뀐 줄을 잠깐 번쩍인다.
 * 상태등 옆에는 늘 글자 라벨 — 색만으로 뜻을 싣지 않는다.
 * 움직임은 점(.lt)의 opacity·box-shadow, 점 안 전용 ring 의 scale, 줄 배경에만. transform 을 쓰는 요소에 애니메이션을 걸지 않는다.
 */

const LABEL: Record<AgentState, string> = {
  unknown: "확인 못함", off: "꺼짐", stuck: "실패", late: "늦음", wait: "원장님 차례", working: "일하는 중", pcoff: "PC 꺼짐", idle: "쉬는 중", ok: "정상",
};
const POLL_MS = 45_000;
const FLASH_MS = 1_800;

/** KST HH:MM. Intl 은 서버·브라우저 ICU 가 달라 글자가 어긋날 수 있어 직접 센다 (KST 는 서머타임 없음) */
const hhmm = (iso: string) => new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(11, 16);

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

const CSS = `
.ag{margin-top:26px}
.ag-hd{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap}
.ag-hd h2{margin:0}
.ag-sub{font-size:14px;color:var(--ink2)}
.ag-sub.lost{color:var(--crit);font-weight:700}
.ag-claude{font-size:14px;color:var(--ink2);margin:2px 0 0}
.ag-list{list-style:none;margin:8px 0 0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden}
.ag-row{display:grid;grid-template-columns:118px 104px minmax(0,1fr) auto auto auto;
  grid-template-areas:"st nm main ago nx cnt";align-items:center;column-gap:14px;
  padding:8px 16px;border-bottom:1px solid var(--soft);font-size:16px;line-height:1.55}
.ag-row:last-child{border-bottom:0}
.ag-st{grid-area:st;display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink2);white-space:nowrap}
.ag-nm{grid-area:nm;font-weight:800;white-space:nowrap}
.ag-main{grid-area:main;min-width:0;color:var(--ink);overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;word-break:keep-all;overflow-wrap:anywhere}
.ag-ago,.ag-nx,.ag-cnt{font-size:14px;color:var(--ink2);white-space:nowrap}
.ag-ago{grid-area:ago}.ag-nx{grid-area:nx}.ag-cnt{grid-area:cnt}
.ag-cnt b{color:var(--crit);font-weight:700}
.ag-row.stuck .ag-main,.ag-row.late .ag-main,.ag-row.stuck .ag-st,.ag-row.late .ag-st{color:var(--crit)}
.ag-row.stuck .ag-st,.ag-row.late .ag-st{font-weight:700}
@media(max-width:720px){
  .ag-row{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"st nm ago" "main main main" "nx cnt cnt";row-gap:2px}
  .ag-cnt{justify-self:start}
}

/* 상태등 — 점과 그 안 전용 ring. 점 자체에는 transform 을 쓰지 않는다 */
.lt{position:relative;display:inline-block;flex:none;width:10px;height:10px;border-radius:50%;background:var(--faint)}
.lt .ring{position:absolute;inset:0;border-radius:50%;background:var(--cool);opacity:0;pointer-events:none}
.lt.working{background:var(--cool)}
.lt.working .ring{animation:lt-ring 1.6s ease-out infinite}
.lt.ok{background:var(--ok);animation:lt-breathe 3s ease-in-out infinite}
.lt.stuck,.lt.late{background:var(--crit);animation:lt-blink 1.2s ease-in-out infinite}
.lt.wait{background:var(--acc)}
.ag-row.wait .ag-st{color:#F0CE87;font-weight:700}
@keyframes lt-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.2);opacity:0}}
@keyframes lt-breathe{0%,100%{box-shadow:0 0 0 0 rgba(61,214,160,0)}50%{box-shadow:0 0 6px 2px rgba(61,214,160,.35)}}
@keyframes lt-blink{0%,100%{opacity:1}50%{opacity:.35}}

/* 줄 배경 — 일하는 중은 옅게 흐르고, 마지막 활동이 바뀐 줄은 잠깐 번쩍 */
.ag-row.working{background-image:linear-gradient(100deg,transparent 30%,rgba(61,214,196,.08) 50%,transparent 70%);
  background-size:200% 100%;animation:ag-shim 2.4s linear infinite}
.ag-row.flash{animation:ag-flash 1.8s ease-out}
.ag-row.working.flash{animation:ag-shim 2.4s linear infinite,ag-flash 1.8s ease-out}
@keyframes ag-shim{from{background-position:100% 0}to{background-position:-100% 0}}
@keyframes ag-flash{from{background-color:rgba(245,166,35,.12)}to{background-color:rgba(245,166,35,0)}}

@media(prefers-reduced-motion:reduce){
  .ag .lt,.ag .lt .ring,.ag .ag-row{animation:none!important}
  .ag .ag-row.working{background-image:none}
}
`;

export default function AgentStrip({ initial }: { initial: Agents }) {
  const [data, setData] = useState(initial);
  const [lost, setLost] = useState(false);
  // 첫 그림은 서버 시각으로 센다 — 서버와 브라우저가 같은 글자를 그려야 hydration 이 안 어긋난다
  const [now, setNow] = useState(() => Date.parse(initial.at));
  const [flash, setFlash] = useState<string[]>([]);
  const prev = useRef(initial);

  useEffect(() => {
    let alive = true;
    let unflash: ReturnType<typeof setTimeout> | undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);

    const pull = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/admin/agents", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const next = (await r.json()) as Agents;
        if (!alive) return;
        const before = new Map(prev.current.rows.map((x) => [x.id, x.last?.at ?? null]));
        const changed = next.rows
          .filter((x) => before.has(x.id) && before.get(x.id) !== (x.last?.at ?? null))
          .map((x) => x.id);
        prev.current = next;
        setData(next);
        setLost(false);
        setNow(Date.now());
        if (changed.length) {
          setFlash(changed);
          clearTimeout(unflash);
          unflash = setTimeout(() => { if (alive) setFlash([]); }, FLASH_MS);
        }
      } catch {
        // 마지막 값을 그대로 둔다. 머리에 「연결 끊김」
        if (alive) { setLost(true); setNow(Date.now()); }
      }
    };

    const poll = setInterval(pull, POLL_MS);
    const onVis = () => { if (!document.hidden) void pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(tick);
      clearInterval(poll);
      clearTimeout(unflash);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const c = data.claude;
  return (
    <section className="ag" aria-labelledby="ag-h">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ag-hd">
        <h2 id="ag-h">자동으로 도는 일</h2>
        {lost
          ? <span className="ag-sub lost" role="status">연결 끊김 · {ago(data.at, now)} 값</span>
          : <span className="ag-sub">{hhmm(data.at)} 기준 · 저절로 새로 고침</span>}
      </div>
      {c && (
        <p className="ag-claude">
          오늘 Claude 를 {c.n.toLocaleString("ko-KR")}번 불렀습니다{c.cap !== null && ` · 하루 ${c.cap.toLocaleString("ko-KR")}번까지`}
        </p>
      )}
      <ol className="ag-list">
        {data.rows.map((r) => (
          <li key={r.id} className={`ag-row ${r.state}${flash.includes(r.id) ? " flash" : ""}`} data-agent={r.id}>
            <span className="ag-st">
              <span className={`lt ${r.state}`} aria-hidden="true"><i className="ring" /></span>
              {LABEL[r.state]}
            </span>
            <b className="ag-nm">{r.name}</b>
            <span className="ag-main" title={r.reason ?? r.does}>{r.reason ?? r.does}</span>
            <span className="ag-ago">{r.last ? `마지막 ${ago(r.last.at, now)}` : "최근 10일 기록 없음"}</span>
            <span className="ag-nx">{r.next ? `다음 ${r.next}` : "필요할 때"}</span>
            <span className="ag-cnt">
              오늘 {r.today.ok + r.today.fail}건{r.today.fail > 0 && <> · <b>실패 {r.today.fail}</b></>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
