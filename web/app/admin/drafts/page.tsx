import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listDrafts } from "@/lib/drafts";
import { saveDraft, publishDraft, discardDraft, revertDraft } from "@/lib/draft-actions";

const HERE = "/admin/drafts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 초안 검토 — 읽고, 고치고, 발행한다.
 *
 * 에이전트가 쓰는 건 초안까지다. 발행 전 사실 확인은 사람만 한다(CLAUDE.md).
 * 그래서 확인할 것을 맨 위에 모아 둔다: 모델이 스스로 「지어냈을 수 있다」고 적은 문장, AI 티 검사, 짜임새.
 */

const CSS = `
.dr{--bg:#0C1016;--card:#141A22;--sunk:#10151C;--line:#232C38;--soft:#1A222C;
  --ink:#E8EDF3;--ink2:#A7B2C0;--mut:#7B8696;--faint:#5A6474;
  --acc:#F5A623;--cool:#3DD6C4;--ok:#3DD6A0;--warn:#E0A93C;--crit:#D2705F;
  background:var(--bg);color:var(--ink);min-height:100vh;
  font-family:"Noto Sans KR",system-ui,sans-serif;padding:38px 0 90px;word-break:keep-all}
.dr .w{max-width:880px;margin:0 auto;padding:0 16px}
.dr h1{font-size:25px;font-weight:900;letter-spacing:-.035em;margin:0 0 6px}
.dr .eb{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);margin-bottom:8px}
.dr .lead{font-size:14px;color:var(--mut);margin:0 0 20px}
.dr a{color:var(--cool)}
.dr-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 24px}
.dr-nav a{font-size:13px;padding:6px 11px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink2)}
.dr-nav a.on{border-color:var(--acc);color:var(--acc)}
.dr-empty{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px;color:var(--mut)}
article.dr-card{background:var(--card);border:1px solid var(--line);border-radius:16px;margin:0 0 28px;overflow:hidden}
.dr-head{padding:20px 22px 14px;border-bottom:1px solid var(--line)}
.dr-meta{font-size:12px;color:var(--mut);font-family:"IBM Plex Mono",monospace;display:flex;gap:12px;flex-wrap:wrap}
.dr-head h2{font-size:20px;font-weight:800;letter-spacing:-.03em;margin:8px 0 6px}
.dr-sum{font-size:14px;color:var(--ink2);margin:0}
.dr-check{padding:14px 22px;background:var(--sunk);border-bottom:1px solid var(--line)}
.dr-check h3{font-size:13px;font-weight:800;margin:10px 0 6px;color:var(--warn)}
.dr-check h3:first-child{margin-top:0}
.dr-check ul{margin:0;padding-left:18px;font-size:13.5px;color:var(--ink2);line-height:1.7}
.dr-check .okk{color:var(--ok);font-size:13px;margin:0}
.dr-body{padding:6px 22px 18px;font-size:15px;line-height:1.85;color:var(--ink)}
.dr-body h3{font-size:17px;margin:22px 0 6px}
.dr-body p{margin:10px 0}
.dr-body li{margin:4px 0}
.dr-body .img{display:inline-block;font-size:12px;color:var(--mut);border:1px dashed var(--line);padding:4px 8px;border-radius:6px}
details.dr-edit{border-top:1px solid var(--line);padding:12px 22px}
details.dr-edit summary{cursor:pointer;font-size:13.5px;color:var(--ink2)}
.dr-edit label{display:block;font-size:12px;color:var(--mut);margin:12px 0 5px}
.dr-edit input,.dr-edit textarea{width:100%;box-sizing:border-box;background:var(--sunk);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font:inherit;font-size:14px}
.dr-edit textarea{min-height:420px;line-height:1.7;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:13px}
.dr-act{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:16px 22px;border-top:1px solid var(--line)}
.dr button{font:inherit;font-size:14px;font-weight:700;border-radius:10px;padding:10px 16px;cursor:pointer;border:1px solid var(--line);background:var(--soft);color:var(--ink)}
.dr button.pub{background:var(--acc);border-color:var(--acc);color:#1a1204}
.dr button.del{color:var(--crit)}
.dr-act small{color:var(--mut);font-size:12px}
.dr-conf{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--mut)}
@media (max-width:600px){.dr-head,.dr-check,.dr-body,.dr-act,details.dr-edit{padding-left:16px;padding-right:16px}}
`;

// 모델이 쓴 글이라 따옴표까지 막는다 — 링크 주소가 속성 밖으로 새지 않게
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** 본문 마크다운을 읽을 수 있게만 바꾼다. 사이트와 똑같이 그리는 게 아니라 검토용이다 */
function render(md: string) {
  const inline = (s: string) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<span class="img">도해: $1</span>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.join("")}</ul>`); list = []; } };
  for (const block of md.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      list.push(...lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`));
      continue;
    }
    flush();
    const h = /^#{1,4}\s+(.*)$/.exec(block.trim());
    out.push(h ? `<h3>${inline(h[1])}</h3>` : `<p>${lines.map(inline).join("<br>")}</p>`);
  }
  flush();
  return out.join("\n");
}

const kst = (s: string) => new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ key?: string; c?: string }> }) {
  const { key, c } = await searchParams;
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));
  const clientId = c ? Number(c) : undefined;
  const drafts = await listDrafts(Number.isInteger(clientId) ? clientId : undefined);

  return (
    <main className="dr">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="eb">CONTENT REVIEW</div>
        <h1>검토할 초안 {drafts.length}편</h1>
        <p className="lead">에이전트가 쓴 글입니다. 사실을 확인하고 발행하면 한 시간 안에 유통 담당이 검색엔진에 알립니다. 발행 전에는 사이트에 안 보입니다.</p>
        <nav className="dr-nav">
          <Link href="/admin/ops">← 운영 현황</Link>
          <Link href={HERE} className={!c ? "on" : ""}>전체</Link>
        </nav>

        {drafts.length === 0 && <div className="dr-empty">검토할 초안이 없습니다.</div>}

        {drafts.map((d) => {
          const n = d.notes ?? {};
          const 확인 = n.확인필요 ?? [];
          const 티 = n.AI티 ?? [];
          const 흠 = n.짜임새 ?? [];
          return (
            <article key={d.slug} className="dr-card" id={d.slug}>
              <div className="dr-head">
                <div className="dr-meta">
                  <span>{d.clientName}</span><span>{d.category}</span><span>쓴 때 {kst(d.createdAt)}</span>
                  <span>{d.body.length.toLocaleString("ko-KR")}자</span>{n.모델 && <span>{n.모델}</span>}
                </div>
                <h2>{d.title}</h2>
                <p className="dr-sum">{d.summary}</p>
                {n.질문 && <p className="dr-sum" style={{ marginTop: 8 }}>겨냥한 AI 질문: 「{n.질문}」{n.경쟁출처?.length ? ` · 대신 인용된 곳: ${n.경쟁출처.join(", ")}` : ""}</p>}
              </div>

              <div className="dr-check">
                <h3>사실 확인할 문장 {확인.length ? `${확인.length}개` : ""}</h3>
                {확인.length ? <ul>{확인.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  : <p className="okk">{Object.keys(n).length ? "모델이 적은 문장은 없습니다. 그래도 숫자·경험담은 읽어 보세요." : "이 초안은 메모 없이 저장됐습니다. 본문 전체를 읽어 확인하세요."}</p>}
                <h3>AI 티 검사</h3>
                {티.length ? <ul>{티.map((t, i) => <li key={i}>{t.why} — {t.sample.join(", ")}</li>)}</ul>
                  : <p className="okk">{d.task?.evidence?.includes("AI 티") ? "걸린 표현 없음" : "콘텐츠 담당이 아직 검사하지 않았습니다 (매시 실행)"}</p>}
                {흠.length > 0 && <><h3>짜임새</h3><ul>{흠.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
                {n.다듬음 && <p className="okk" style={{ marginTop: 8 }}>{n.다듬음}</p>}
                {n.원문 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink2)" }}>다듬기 전 원문 보기</summary>
                    <div className="dr-body" style={{ padding: "6px 0" }} dangerouslySetInnerHTML={{ __html: render(n.원문) }} />
                    <form action={revertDraft}><input type="hidden" name="slug" value={d.slug} /><button type="submit">원문으로 되돌리기</button></form>
                  </details>
                )}
              </div>

              <div className="dr-body" dangerouslySetInnerHTML={{ __html: render(d.body) }} />

              <details className="dr-edit">
                <summary>직접 고치기</summary>
                <form action={saveDraft}>
                  <input type="hidden" name="slug" value={d.slug} />
                  <label>제목</label><input name="title" defaultValue={d.title} />
                  <label>요약</label><input name="summary" defaultValue={d.summary} />
                  <label>본문 (마크다운)</label><textarea name="body" defaultValue={d.body} />
                  <div className="dr-act" style={{ padding: "14px 0 0", border: 0 }}><button type="submit">고친 내용 저장</button></div>
                </form>
              </details>

              <div className="dr-act">
                <form action={publishDraft}>
                  <input type="hidden" name="slug" value={d.slug} />
                  <button type="submit" className="pub">사실 확인했음 · 발행</button>
                </form>
                <small>발행 주소: {d.domain}/blog/{d.slug}</small>
                <form action={discardDraft} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="slug" value={d.slug} />
                  <label className="dr-conf"><input type="checkbox" name="confirm" value="yes" required /> 버리기 확인</label>
                  <button type="submit" className="del">초안 버리기</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
