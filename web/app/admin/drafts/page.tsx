import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { listDrafts, listAutoPosts, DISCARD_REASONS, TAKEDOWN_REASONS, type AutoPost } from "@/lib/drafts";
import { saveDraft, publishDraft, discardDraft, revertDraft, requeueIllustrate, takedownPost } from "@/lib/draft-actions";
import AdminNav from "../AdminNav";
import SubmitButton from "../SubmitButton";

const HERE = "/admin/drafts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 초안 검토 — 읽고, 사실 확인하고, 발행한다.
 *
 * 자동 글(Step 43)은 맨 위 「자동 글」 절 — 자동 감수를 다 통과하면 스스로 나가고, 원장은 이상하면 내린다.
 * 그 밖의 초안(세션 글·스위치가 꺼졌을 때의 자동 글)은 아래 목록에서 원장이 읽고 발행한다.
 * 맨 위 카드에는 결정에 쓰는 것만: 제목 · 사실 확인할 문장 · 도해 썸네일 · 발행/버리기.
 * AI 티·짜임새는 걸렸을 때만 한 줄, 통과면 자세히. 본문·고치기·되돌리기·도해 다시 요청도 자세히.
 */

const CSS = `
.dr-list{display:grid;gap:14px}
.dr-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.dr-card h3{margin:0;font-size:18px;line-height:1.45}
.dr-meta{font-size:14px;color:var(--ink2);margin-top:2px}
.dr-sec{margin-top:12px}
.dr-sec b.t{display:block;font-size:14px;color:var(--warn);margin-bottom:4px}
.dr-sec ul{margin:0;padding-left:18px;font-size:16px;line-height:1.6}
.dr-sec p{margin:0;font-size:14px;color:var(--ink2)}
.dr-sec p.warn{color:var(--warn)}
.dr-thumbs{display:flex;gap:8px;flex-wrap:wrap}
.dr-thumbs img{width:96px;height:72px;object-fit:contain;background:#fff;border-radius:8px;border:1px solid var(--line)}
.dr-flag>summary{cursor:pointer;color:var(--warn);font-size:14px;font-weight:700;margin-top:10px}
.dr-flag ul{margin:6px 0 0;padding-left:18px;font-size:14px;color:var(--ink2)}
.dr-act{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}
.dr-act form{margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dr-act small{font-size:14px;color:var(--ink2)}
.dr-kill>summary{color:var(--crit)}
.dr-kill form{margin:10px 0 0;display:grid;gap:10px;justify-items:start}
.dr-kill .why{margin:0;font-size:14px;color:var(--ink2)}
.dr-kill input[type=text]{width:100%;max-width:420px}
.dr-more{margin-top:12px;border-top:1px solid var(--line);padding-top:8px}
.dr-more>summary{cursor:pointer;font-size:14px;color:var(--ink2);font-weight:700}
.dr-body{font-size:16px;line-height:1.8;color:var(--ink)}
.dr-body h3{font-size:17px;margin:20px 0 6px}
.dr-body p{margin:10px 0}
.dr-body .img{display:inline-block;font-size:14px;color:var(--ink2);border:1px dashed var(--line);padding:4px 8px;border-radius:6px}
.dr-body .imgp{display:block;margin:12px 0}
.dr-body .imgp img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--line);margin-bottom:6px}
.dr-edit label{display:block;font-size:14px;color:var(--ink2);margin:12px 0 5px}
.dr-edit input,.dr-edit textarea{width:100%}
.dr-edit textarea{min-height:420px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:14px}
`;

// 모델이 쓴 글이라 따옴표까지 막는다 — 링크 주소가 속성 밖으로 새지 않게
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * 도해 주소. 원장이 그림 속 글자·숫자까지 사실 확인한다(Richard 9/22).
 * 에이전트 도해(/blog/img/<slug>/<name>.svg)는 발행 전에는 사이트가 안 내보내니 DB 의 SVG 를 data: 로 넣는다.
 * <img> 로 그리므로 SVG 안 스크립트는 돌지 않는다. 손으로 넣은 public 도해는 사이트 주소로 연다
 */
function 그림주소(src: string, slug: string, domain: string, images: Record<string, string>): string | null {
  const 에이전트 = /^\/blog\/img\/([^/]+)\/([a-z0-9-]+)\.svg$/.exec(src);
  return 에이전트
    ? (에이전트[1] === slug && images[에이전트[2]] ? `data:image/svg+xml;base64,${Buffer.from(images[에이전트[2]]).toString("base64")}` : null)
    : /^\/blog\/[a-z0-9가-힣-]+\/[\w.-]+\.(?:svg|png)$/.test(src) ? `https://${domain}${src}` : null;
}

function 미리보기(alt: string, src: string, slug: string, domain: string, images: Record<string, string>) {
  const 주소 = 그림주소(src, slug, domain, images);
  const 글 = `<span class="img">도해: ${alt}${주소 ? "" : " (그림을 찾을 수 없음)"}</span>`;
  return 주소 ? `<span class="imgp"><img src="${esc(주소)}" alt="${alt}" loading="lazy">${글}</span>` : 글;
}

/** 본문 마크다운을 읽을 수 있게만 바꾼다. 사이트와 똑같이 그리는 게 아니라 검토용이다 */
function render(md: string, 그림: { slug: string; domain: string; images: Record<string, string> } = { slug: "", domain: "", images: {} }) {
  const inline = (s: string) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) => 미리보기(alt, src.replace(/&amp;/g, "&"), 그림.slug, 그림.domain, 그림.images))
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

/**
 * 자동 글 카드(Step 43) — 감수 중이거나 최근 30일 안에 자동으로 나간 글. 원장이 할 일은 이상하면 「내리기」 한 번.
 * 고른 이유 · 쓴 재료 · 대조한 출처 · 감수 네 줄 · 회차를 사람 말로만 보여 준다
 */
function 자동카드({ p }: { p: AutoPost }) {
  const g = p.기록;
  const 줄 = (이름: string, s: { 통과: boolean } | undefined, 말: string) =>
    <li key={이름}><b>{이름}</b> {s ? (s.통과 ? "통과" : "걸림") : "아직 안 봄"}{s && 말 ? ` — ${말}` : ""}</li>;
  const 출처 = g?.a?.출처 ?? [];
  const 못읽음 = 출처.filter((x) => x.상태 !== "읽음");
  return (
    <article className="dr-card" id={`auto-${p.slug}`}>
      <h3>{p.title}</h3>
      <div className="dr-meta">
        {p.published ? `자동 발행 ${p.publishedAt ? kst(p.publishedAt) : ""} · ${p.domain}/blog/${p.slug}` : `감수 중 · ${p.감수?.회차 ?? 0}/3회`}
      </div>
      <div className="dr-sec">
        <p>고른 이유: {p.주제?.이유 || "기록 없음"}</p>
        <p>쓴 재료: {p.재료.length ? p.재료.join(" / ") : "재료 없이 바깥 사실로 씀"}</p>
      </div>
      <div className="dr-sec">
        <b className="t">감수 {g?.회차 ?? p.감수?.회차 ?? 0}/3회</b>
        <ul>
          {줄("출처 대조", g?.a, g?.a ? `${g.a.대조 ?? 0}문장 중 ${g.a.맞음 ?? 0} 맞음${g.a.지운것?.length ? ` · 지운 문장 ${g.a.지운것.length}` : ""}${g.a.통과 ? "" : ` · ${g.a.왜}`}` : "")}
          {줄("AI 티", g?.b, g?.b?.걸림?.[0] ?? g?.b?.고친것 ?? "")}
          {줄("원장 관점", g?.c, g?.c?.통과 ? (g.c.말리기 ? `말리는 문장 「${g.c.말리기.slice(0, 40)}」` : "") : g?.c?.왜 ?? "")}
          {줄("가림", g?.d, g?.d?.걸림?.join(", ") ?? "")}
        </ul>
        {!p.published && p.감수?.통과 === false && (p.감수.고침?.length ?? 0) > 0 && (
          <p className="warn">내일 이걸 고쳐 다시 봅니다: {p.감수.고침![0]}</p>
        )}
      </div>
      {출처.length > 0 && (
        <details className="dr-flag">
          <summary>대조한 출처 {출처.length}곳{못읽음.length ? ` · 못 읽은 곳 ${못읽음.length}` : ""}{g?.a?.지운것?.length ? ` · 지운 문장 ${g.a.지운것.length}` : ""}</summary>
          <ul>
            {출처.map((x, i) => <li key={i}>{x.주소} — {x.상태 === "읽음" ? `맞은 문장 ${x.맞음}` : `${x.상태}${x.왜 ? ` (${x.왜})` : ""}`}</li>)}
          </ul>
          {(g?.a?.지운것?.length ?? 0) > 0 && <ul>{g!.a!.지운것!.map((s, i) => <li key={`d${i}`}>지움: {s}</li>)}</ul>}
        </details>
      )}
      {p.published && (
        <details className="dr-flag dr-kill">
          <summary>내리기</summary>
          <form action={takedownPost}>
            <input type="hidden" name="slug" value={p.slug} />
            <p className="why">사이트에서는 5분 안에 사라집니다. 네이버 글은 「오늘 하실 일」로 따로 올라갑니다.</p>
            <select name="reason" defaultValue="">
              <option value="">이유 안 고름</option>
              {TAKEDOWN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="text" name="note" maxLength={150} placeholder="한 줄 더 (없어도 됩니다)" />
            <SubmitButton className="adm-btn bad">이 글을 내립니다</SubmitButton>
          </form>
        </details>
      )}
    </article>
  );
}

const kst = (s: string) => new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ key?: string; c?: string }> }) {
  const { key, c } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(HERE));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));
  const clientId = c ? Number(c) : undefined;
  const drafts = await listDrafts(Number.isInteger(clientId) ? clientId : undefined);
  // 자동 글 절은 못 읽어도 화면 전체를 죽이지 않는다 — 아래 초안 목록은 그대로 보여 준다
  const 자동 = await listAutoPosts().catch((e) => { console.error("자동 글 읽기 실패", e); return null; });

  return (
    <main className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>초안 검토</h1>
          <AdminNav here="/admin/drafts" />
        </div>

        <section className="adm-todo" aria-labelledby="auto-h">
          <h2 id="auto-h">자동 글{자동 && 자동.length > 0 && <span className="n"> {자동.length}편</span>}</h2>
          <p className="sub" style={{ margin: 0 }}>
            {자동 === null ? "자동 글을 못 읽었습니다."
              : 자동.length === 0 ? "없음 — 감수 중이거나 최근 30일에 자동으로 나간 글이 생기면 여기 뜹니다."
                : "주제·감수·발행은 자동입니다. 출처 원문 대조·AI 티·원장 관점·가림을 다 통과한 글만 나갑니다. 이상하면 「내리기」 한 번."}
          </p>
        </section>
        {자동 && 자동.length > 0 && (
          <div className="dr-list" style={{ marginTop: 14, marginBottom: 14 }}>
            {자동.map((p) => <자동카드 key={p.slug} p={p} />)}
          </div>
        )}

        <section className="adm-todo" aria-labelledby="dr-h">
          <h2 id="dr-h">검토할 초안{drafts.length > 0 && <span className="n"> {drafts.length}편</span>}</h2>
          {drafts.length === 0 ? <p className="none">없음 — 새 초안이 오면 여기 뜹니다</p> : (
            <p className="sub" style={{ margin: 0 }}>사실을 확인하고 발행하면 한 시간 안에 유통 담당이 검색엔진에 알립니다. 발행 전에는 사이트에 안 보입니다.</p>
          )}
        </section>

        <div className="dr-list" style={{ marginTop: 14 }}>
          {drafts.map((d) => {
            const n = d.notes ?? {};
            const 확인 = n.확인필요 ?? [];
            const 티 = n.AI티 ?? [];
            const 흠 = n.짜임새 ?? [];
            // 도해는 무조건(원장 2026-09-22) — 없으면 발행 버튼을 막는다. 서버(publishDraft)도 한 번 더 막는다
            const 그림들 = [...d.body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((m) => ({ alt: m[1], url: 그림주소(m[2], d.slug, d.domain, d.images) }));
            const 도해수 = 그림들.length;
            const 삽화 = n.삽화;
            const 검사함 = d.task?.evidence?.includes("AI 티") ?? false;
            return (
              <article key={d.slug} className="dr-card" id={d.slug}>
                <h3>{d.title}</h3>
                <div className="dr-meta">{d.clientName} · {d.body.length.toLocaleString("ko-KR")}자 · 쓴 때 {kst(d.createdAt)}</div>

                <div className="dr-sec">
                  <b className="t">사실 확인할 문장{확인.length ? ` ${확인.length}개` : ""}</b>
                  {확인.length ? <ul>{확인.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    : <p>{Object.keys(n).length ? "모델이 적은 문장은 없습니다. 그래도 숫자·경험담은 읽어 보세요." : "메모 없이 저장된 초안입니다. 본문 전체를 읽어 확인하세요."}</p>}
                </div>

                {n.근거표 && (
                  // 글쓴이는 이 표에 있는 숫자·날짜만 쓸 수 있다(게이트가 막는다). 사실 확인은 이 표와 본문을 맞춰 보면 된다
                  <details className="dr-flag">
                    <summary>근거표 — 사실 {n.근거표.사실?.length ?? 0}줄{n.근거표.추정?.length ? ` · 추정 ${n.근거표.추정.length}줄` : ""}</summary>
                    {([["사실", n.근거표.사실], ["추정", n.근거표.추정], ["확인 필요", n.근거표.확인필요]] as const).map(([칸, 줄]) =>
                      줄?.length ? (
                        <div key={칸}>
                          <b>{칸}</b>
                          <ul>{줄.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      ) : null)}
                  </details>
                )}

                <div className="dr-sec">
                  <b className="t">도해{도해수 ? ` ${도해수}장 — 그림 속 글자·숫자도 확인` : ""}</b>
                  {도해수 > 0 ? (
                    <div className="dr-thumbs">
                      {그림들.map((g, i) => g.url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img key={i} src={g.url} alt={g.alt} loading="lazy" />
                        : <p key={i} className="warn">「{g.alt}」 그림을 찾을 수 없음</p>)}
                    </div>
                  ) : (
                    <p className="warn">
                      {d.body.length < 600
                        ? "없음 — 본문이 600자보다 짧아 삽화 담당이 그리지 않습니다. 도해가 붙어야 발행할 수 있습니다."
                        : "아직 없음 — 삽화 담당이 그리는 중입니다(매시 1편, 하루 6편까지). 도해가 붙어야 발행할 수 있습니다."}
                      {삽화?.시도 ? ` 지금까지 ${삽화.시도}번 그렸고 검사에서 다 버려졌습니다.` : ""}
                    </p>
                  )}
                </div>

                {티.length > 0 && (
                  <details className="dr-flag">
                    <summary>AI 티 {티.length}곳 — 보기</summary>
                    <ul>{티.map((t, i) => <li key={i}>{t.why} — {t.sample.join(", ")}</li>)}</ul>
                  </details>
                )}
                {흠.length > 0 && (
                  <details className="dr-flag">
                    <summary>짜임새 {흠.length}곳 — 보기</summary>
                    <ul>{흠.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </details>
                )}

                <div className="dr-act">
                  <form action={publishDraft}>
                    <input type="hidden" name="slug" value={d.slug} />
                    <SubmitButton className="adm-btn" disabled={도해수 === 0}>사실 확인했음 · 발행</SubmitButton>
                  </form>
                </div>

                <details className="dr-flag dr-kill">
                  <summary>초안 버리기</summary>
                  <form action={discardDraft}>
                    <input type="hidden" name="slug" value={d.slug} />
                    <p className="why">왜 버리는지 고르면 다음 초안 프롬프트가 그걸 읽습니다. 안 고르면 안 지웁니다.</p>
                    <div className="adm-pick">
                      {DISCARD_REASONS.map((r) => (
                        <span key={r}>
                          <input type="checkbox" id={`r-${d.slug}-${r}`} name="reason" value={r} />
                          <label htmlFor={`r-${d.slug}-${r}`}>{r}</label>
                        </span>
                      ))}
                    </div>
                    <input type="text" name="note" maxLength={300} placeholder="한 줄 더 (없어도 됩니다)" />
                    <SubmitButton className="adm-btn bad">이 이유로 버립니다</SubmitButton>
                  </form>
                </details>

                <details className="dr-more">
                  <summary>자세히 — 본문 · 고치기 · 검사 결과</summary>
                  <div className="dr-sec">
                    <p>발행 주소: {d.domain}/blog/{d.slug}{d.category ? ` · ${d.category}` : ""}</p>
                    {d.summary && <p>요약: {d.summary}</p>}
                    {n.질문 && <p>겨냥한 AI 질문: 「{n.질문}」{n.경쟁출처?.length ? ` · 대신 인용된 곳: ${n.경쟁출처.join(", ")}` : ""}</p>}
                    {티.length === 0 && <p>AI 티 검사: {검사함 ? "걸린 표현 없음" : "콘텐츠 담당이 아직 검사하지 않았습니다 (매시 실행)"}</p>}
                    {흠.length === 0 && <p>짜임새: 걸린 것 없음</p>}
                    {n.다듬음 && <p>{n.다듬음}</p>}
                  </div>
                  {도해수 === 0 && (
                    <div className="dr-sec">
                      {(삽화?.버린것?.length ?? 0) > 0 && <ul>{삽화!.버린것!.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}</ul>}
                      <form action={requeueIllustrate} style={{ marginTop: 8 }}>
                        <input type="hidden" name="slug" value={d.slug} /><SubmitButton className="adm-btn alt">도해 다시 그리기</SubmitButton>
                      </form>
                    </div>
                  )}
                  <div className="dr-body" dangerouslySetInnerHTML={{ __html: render(d.body, { slug: d.slug, domain: d.domain, images: d.images }) }} />
                  {n.원문 && (
                    <details className="dr-more">
                      <summary>다듬기 전 원문 보기</summary>
                      <div className="dr-body" dangerouslySetInnerHTML={{ __html: render(n.원문) }} />
                      <form action={revertDraft}><input type="hidden" name="slug" value={d.slug} /><SubmitButton className="adm-btn alt">원문으로 되돌리기</SubmitButton></form>
                    </details>
                  )}
                  <details className="dr-more dr-edit">
                    <summary>직접 고치기</summary>
                    <form action={saveDraft}>
                      <input type="hidden" name="slug" value={d.slug} />
                      <label>제목</label><input name="title" defaultValue={d.title} />
                      <label>요약</label><input name="summary" defaultValue={d.summary} />
                      <label>본문 (마크다운)</label><textarea name="body" defaultValue={d.body} />
                      <div className="dr-act"><SubmitButton className="adm-btn alt">고친 내용 저장</SubmitButton></div>
                    </form>
                  </details>
                </details>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
