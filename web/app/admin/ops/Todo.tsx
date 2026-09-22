import type { ReactNode } from "react";

import type { Ops } from "@/lib/ops";
import { plain } from "@/lib/agents";
import { finishTask, resolveNaverAttempt } from "@/lib/task-actions";

/**
 * ① 오늘 원장님이 하실 일 — 현황판 맨 위.
 *
 * 원천은 일감 표의 「사람 대기」뿐이다(새 쿼리 없음). 문구는 plain() 으로만 다듬는다 — 데이터는 안 고친다.
 * 행동은 AgentBoard 에 있던 것을 그대로 옮겼다. 서버 액션을 새로 만들지 않는다.
 */

const MAX = 5;

type Item = { key: string; title: string; why: string; act: ReactNode };

export default function Todo({ company, unresolved }: { company: Ops["company"]; unresolved: number | null }) {
  if (!company.ok) {
    return (
      <section className="td" aria-labelledby="td-h">
        <h2 id="td-h">오늘 원장님이 하실 일</h2>
        <p className="td-none bad">할 일 목록을 못 읽었습니다</p>
      </section>
    );
  }

  const human = company.tasks.filter((t) => t.status === "사람 대기");
  const items: Item[] = human.map((t) => ({
    key: `t${t.id}`,
    title: plain(t.title),
    why: plain(t.error || t.detail),
    act: t.kind === "naver-attempt" ? (
      <form action={resolveNaverAttempt} className="td-naver">
        <input type="hidden" name="id" value={t.id} />
        <input name="logNo" placeholder="네이버 글 번호" aria-label="네이버 글 번호 또는 주소" />
        <button type="submit" name="outcome" value="posted" className="td-btn">올라가 있음</button>
        <button type="submit" name="outcome" value="retry" className="td-btn alt">안 올라감 · 다시</button>
      </form>
    ) : t.link ? (
      <a className="td-btn" href={t.link.replace(/^https:\/\/geo-rose-nine\.vercel\.app/, "")}>
        {t.link.includes("/admin/drafts") ? "읽고 발행하기" : "열기"} →
      </a>
    ) : (
      <form action={finishTask}>
        <input type="hidden" name="id" value={t.id} />
        <button type="submit" className="td-btn">했어요</button>
      </form>
    ),
  }));

  // 상담 결과 미입력 — 큐에 같은 일감(문의 기록 링크)이 이미 있으면 겹쳐 적지 않는다
  if (unresolved && unresolved > 0 && !human.some((t) => t.link?.includes("/admin/inquiry"))) {
    items.push({
      key: "inq",
      title: `상담 결과 ${unresolved}건 입력`,
      why: "문의가 등록으로 이어졌는지 이것으로만 잰다",
      act: <a className="td-btn" href="/admin/inquiry">입력하기 →</a>,
    });
  }

  const shown = items.slice(0, MAX);
  const rest = items.length - shown.length;

  return (
    <section className="td" aria-labelledby="td-h">
      <h2 id="td-h">오늘 원장님이 하실 일{items.length > 0 && <span className="td-n"> {items.length}건</span>}</h2>
      {items.length === 0 ? (
        <p className="td-none">없음 — 직원들이 알아서 돌고 있습니다</p>
      ) : (
        <ol className="td-list">
          {shown.map((x) => (
            <li key={x.key}>
              <div className="td-t">
                <b>{x.title}</b>
                {x.why && <span className="td-why">{x.why}</span>}
              </div>
              <div className="td-act">{x.act}</div>
            </li>
          ))}
        </ol>
      )}
      {rest > 0 && <p className="td-more">외 {rest}건 — 아래 자세히의 직원별 현황</p>}
    </section>
  );
}
