import type { Marketing as MarketingData } from "@/lib/marketing";
import { CHANNEL_NAME } from "@/lib/marketing-core.mjs";
import { engineName } from "@/lib/agents";
import { markPosted, discardDraft, approveBlog } from "@/lib/marketing-actions";
import SubmitButton from "../SubmitButton";
import CopyButton from "./CopyButton";

/**
 * 「오늘 올릴 글」 (Step 35 D54) — 바깥 글을 쓰는 고객 탭에만.
 * 지식iN·카페: 본문 복사 → 검색 링크로 실제 최근 질문을 골라 붙인다 → 올린 주소를 적고 「올렸어요」. 30초 입력(/admin/inquiry 와 같은 모양)
 * 블로그: 읽고 「확인했어요」 → 로컬 에이전트가 올린다(D55). 효과는 올린 주소가 AI 답 출처에 나온 수만(D56)
 */

export const MK_CSS = `
.mk{margin-top:26px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.ops .mk h2{margin:0 0 4px}
.mk-list{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:10px}
.mk-item{background:var(--sunk);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.mk-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.mk-ch{font-size:13px;font-weight:800;color:var(--cool);border:1px solid var(--line);border-radius:999px;padding:1px 9px}
.mk-h b{font-size:16px}
.mk-q{font-size:14px;color:var(--ink2)}
.ops .mk-body{margin-top:6px}
.ops .mk-body>summary{cursor:pointer;font-size:14px;color:var(--ink2)}
.mk-body pre{white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;font:inherit;font-size:14px;line-height:1.7;
  background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:6px 0 0;max-height:360px;overflow:auto}
.mk-act{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
.mk-act form{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0}
.mk-act input{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font:inherit;font-size:14px;min-width:220px}
.mk-act a.td-btn{color:var(--ink)}
.mk-spot{margin-top:8px;background:#1d1a14;border:1px solid #5c4a2a;border-radius:8px;padding:8px 12px;font-size:14px}
.mk-spot b{color:#F0CE87}
.mk-spot ul{margin:4px 0 0;padding-left:18px;color:var(--ink)}
.mk-note{font-size:14px;color:var(--ink2);margin:8px 0 0}
`;

const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

export default function Marketing({ m, name }: { m: MarketingData; name: string }) {
  if (m.ok && !m.enabled) return null;
  return (
    <section className="mk" id="mk" aria-labelledby="mk-h">
      <h2 id="mk-h">오늘 올릴 글 · {name}</h2>
      {!m.ok ? <p className="sub">못 읽었습니다 — {m.err}</p> : (
        <>
          <p className="sub">
            지식iN·카페는 원장님 손으로만 올립니다(자동 게시는 계정 정지 위험). 검색 링크에서 최근 질문을 골라 본문을 붙이고, 올린 주소를 적어 주세요.
          </p>
          {m.drafts.length === 0 ? <p className="mk-note">올릴 초안이 없습니다. 초안은 매일 아침 측정 뒤에 생깁니다</p> : (
            <ol className="mk-list">
              {m.drafts.map((d) => (
                <li key={d.id} className="mk-item">
                  <div className="mk-h">
                    <span className="mk-ch">{CHANNEL_NAME[d.channel]}</span>
                    <b>{d.title}</b>
                    <span className="mk-q">검색어 「{d.query}」 · {md(d.createdOn)}</span>
                  </div>
                  {d.spots.length > 0 && (
                    <div className="mk-spot">
                      <b>읽을 자리 — 원문에 없을 수 있는 문장 {d.spots.length}개</b>
                      <ul>{d.spots.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                  <details className="mk-body">
                    <summary>본문 보기 ({d.body.length.toLocaleString("ko-KR")}자)</summary>
                    <pre>{d.body}</pre>
                  </details>
                  <div className="mk-act">
                    <CopyButton text={d.channel === "jisikin" ? d.body : `${d.title}\n\n${d.body}`} />
                    {d.search && (
                      <a className="td-btn alt" href={d.search} target="_blank" rel="noreferrer">
                        {CHANNEL_NAME[d.channel]}에서 「{d.query}」 질문 찾기 →
                      </a>
                    )}
                    {d.channel === "blog" ? (
                      d.blogOk ? <span className="mk-q">확인함 — 로컬 에이전트가 문서딱 블로그에 올립니다</span> : (
                        <form action={approveBlog}>
                          <input type="hidden" name="id" value={d.id} />
                          <SubmitButton className="td-btn">읽었어요 · 올려 주세요</SubmitButton>
                        </form>
                      )
                    ) : (
                      <form action={markPosted}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="url" name="url" required placeholder="올린 글 주소" aria-label={`${CHANNEL_NAME[d.channel]}에 올린 글 주소`} />
                        <SubmitButton className="td-btn">올렸어요</SubmitButton>
                      </form>
                    )}
                    <form action={discardDraft}>
                      <input type="hidden" name="id" value={d.id} />
                      <SubmitButton className="td-btn alt">버림</SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mk-note">
            {!m.used ? "아직 올린 글이 없습니다 — AI 답 출처로 쓰였는지는 올린 주소가 생긴 뒤부터 셉니다" : (
              <>
                올린 글 {m.used.posted}개 중 {m.used.used}개가 AI 답 출처로 쓰임
                {Object.keys(m.used.perEngine).length > 0 && ` (${Object.entries(m.used.perEngine).map(([e, n]) => `${engineName(e)} ${n}`).join(" · ")})`}
                {` — ${md(m.firstPosted ?? "")} 이후 승인 질문 측정 기준`}
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
