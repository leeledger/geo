import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

import { KINDS, listMaterials, materialCounts } from "@/lib/materials";
import { addMaterial } from "@/lib/material-actions";
import AdminNav from "../AdminNav";

/** 로그인 뒤 돌아올 자리 */
const HERE = "/admin/material";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 초안 재료 — 원장만 쓸 수 있는 말을 한 줄 남긴다.
 *
 * 자동 초안이 일반론이 되는 건 모델 탓이 아니라 재료가 없어서다. 재료가 없으면
 * 모델은 빈자리를 「한 학부모가」로 채우고, 원장은 그 초안을 버린다(2026-09-23, 이틀에 3편).
 * 그래서 이 화면은 30초 안에 끝나야 한다 — 종류 칩 하나, 들은 말 한 줄, 저장.
 * 학년·날짜는 접힌 자리에 둔다.
 */

const CSS = `
.mt-f{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.mt-f .l{display:block;font-size:14px;color:var(--ink2);margin:14px 0 6px}
.mt-f .l:first-of-type{margin-top:0}
.mt-f textarea,.mt-f input[type=text],.mt-f input[type=date]{width:100%}
.mt-f textarea{min-height:88px;resize:vertical}
.mt-f .go{margin-top:14px;width:100%;padding:13px;font-size:16px}
.mt-f .fold{margin-top:12px}
.mt-f .fold>summary{cursor:pointer;font-size:14px;color:var(--ink2);font-weight:700}
.mt-f .fold .in{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
@media(max-width:480px){.mt-f .fold .in{grid-template-columns:1fr}}
.mt-count{margin:0;font-size:16px}
.mt-count b{color:var(--acc)}
.mt-list{display:grid;gap:8px;margin-top:10px}
.mt-tag{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;
  background:var(--sunk);border:1px solid var(--line);color:var(--ink2);margin-left:6px}
.mt-tag.used{border-color:#2c5344;color:#9FD9BE}
`;

const md = (d: string) => `${Number(d.slice(5, 7))}/${d.slice(8, 10)}`;

/** 받침이 있으면 을, 없으면 를. 「이름를 가렸습니다」로 나가면 번역체로 읽힌다 */
function 을를(s: string) {
  const c = s.charCodeAt(s.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? "을" : "를";
}

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export default async function MaterialPage({
  searchParams,
}: { searchParams: Promise<{ key?: string; m?: string; ok?: string }> }) {
  const { key, m, ok } = await searchParams;
  // 옛 열쇠 주소는 쿠키로 바꿔 준다 — 서버 동작(저장 버튼)이 쿠키로만 관리자를 가린다
  if (key) redirect("/admin/enter?key=" + encodeURIComponent(key) + "&to=" + encodeURIComponent(HERE));
  if (!(await isAdmin(key))) redirect("/admin/login?to=" + encodeURIComponent(HERE));

  const [count, rows] = await Promise.all([materialCounts(1), listMaterials(10, 1)]);
  const 가린것 = (m ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const 모자람 = count.unused < 3;

  return (
    <main className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="w">
        <div className="adm-top">
          <h1>초안 재료</h1>
          <AdminNav here="/admin/material" />
        </div>

        <section className={모자람 ? "adm-todo" : undefined} aria-labelledby="mt-h">
          <h2 id="mt-h" style={모자람 ? undefined : { margin: "0 0 6px" }}>
            안 쓴 재료<span className="n"> {count.unused}개</span>
          </h2>
          <p className="mt-count">
            {모자람
              ? "3개 밑이면 자동 초안이 일반론이 됩니다. 상담에서 들은 말 한 줄이면 됩니다."
              : `마지막 기록 ${count.last ?? "없음"} · 자동 초안은 여기서 시작합니다.`}
          </p>
        </section>

        {가린것.length > 0 && (
          <p className="adm-said warn" role="status">
            {가린것.join(" · ")}{을를(가린것[가린것.length - 1])} 가리고 저장했습니다.
          </p>
        )}
        {ok && 가린것.length === 0 && <p className="adm-said" role="status">저장했습니다.</p>}

        <form className="mt-f" action={addMaterial} style={{ marginTop: 14 }}>
          <input type="hidden" name="client_id" value={1} />
          <span className="l">종류</span>
          <div className="adm-pick">
            {KINDS.map((k, i) => (
              <span key={k}>
                <input type="radio" id={`k-${k}`} name="kind" value={k} defaultChecked={i === 0} />
                <label htmlFor={`k-${k}`}>{k}</label>
              </span>
            ))}
          </div>

          <label className="l" htmlFor="said">들은 말 · 있었던 일 (고치지 말고 그대로)</label>
          <textarea
            id="said"
            name="said"
            required
            autoFocus
            maxLength={400}
            placeholder="대회 준비도 해주냐고 물으심 — 초5, 학교에서 정보 수업 듣고 옴"
          />

          <button className="adm-btn go" type="submit">재료 넣기</button>

          <details className="fold">
            <summary>상황·날짜 적기 (안 적어도 됩니다)</summary>
            <div className="in">
              <div>
                <label className="l" htmlFor="context">상황</label>
                <input id="context" type="text" name="context" maxLength={120} placeholder="초5 · 대회반 상담" />
              </div>
              <div>
                <label className="l" htmlFor="day">날짜</label>
                <input id="day" type="date" name="day" defaultValue={kstToday()} />
              </div>
            </div>
          </details>
        </form>

        <h2>최근 기록</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          전화번호·이름은 저장할 때 자동으로 가립니다. 학년은 남깁니다.
        </p>
        {rows.length === 0 ? (
          <p className="adm-empty">아직 없습니다 — 다음 상담·수업에서 한 줄만 남기시면 됩니다.</p>
        ) : (
          <div className="mt-list">
            {rows.map((r) => (
              <div key={r.id} className="adm-card">
                <div className="h">
                  {md(r.day)} · {r.kind}
                  {r.context ? ` · ${r.context}` : ""}
                  {r.origin === "inquiry" && <span className="mt-tag">문의에서</span>}
                  {r.usedIn.length > 0
                    ? <span className="mt-tag used">{r.usedIn[0]}</span>
                    : <span className="mt-tag">안 씀</span>}
                </div>
                <div className="d">「{r.said}」</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
