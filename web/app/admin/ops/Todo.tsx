import type { ReactNode } from "react";

import type { Ops } from "@/lib/ops";
import { todoText, type TodoAction } from "@/lib/todo-text";
import { finishTask, resolveNaverAttempt } from "@/lib/task-actions";
import SubmitButton from "../SubmitButton";

/**
 * ① 오늘 원장님이 하실 일 — 현황판 맨 위.
 *
 * 원천은 일감 표의 「사람 대기」뿐이다(새 쿼리 없음). 문장은 todoText() 가 kind·payload 로 만든다 — 데이터는 안 고친다.
 * 행동은 AgentBoard 에 있던 것을 그대로 옮겼다. 서버 액션을 새로 만들지 않는다.
 * 근거에 최근 조치가 적힌 일은 「조치 중」으로 흐리게, 맨 뒤로.
 */

const MAX = 5;

type Item = { key: string; title: string; why: string; act: ReactNode; doing: string | null };

function Act({ id, a }: { id: number; a: TodoAction }) {
  if (a.type === "naver") {
    return (
      <form action={resolveNaverAttempt} className="td-naver">
        <input type="hidden" name="id" value={id} />
        <input name="logNo" placeholder="네이버 글 번호" aria-label="네이버 글 번호 또는 주소" />
        <SubmitButton name="outcome" value="posted" className="td-btn">올라가 있음</SubmitButton>
        <SubmitButton name="outcome" value="retry" className="td-btn alt">안 올라감 · 다시</SubmitButton>
      </form>
    );
  }
  if (a.type === "link") {
    const ext = /^https?:/.test(a.href);
    return <a className="td-btn" href={a.href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}>{a.label} →</a>;
  }
  if (a.type === "details") {
    return (
      <details className="td-more-d">
        <summary className="td-btn alt">{a.label}</summary>
        <p>{a.body}</p>
      </details>
    );
  }
  return (
    <form action={finishTask}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="td-btn">했어요</SubmitButton>
    </form>
  );
}

export default function Todo({ name, company, unresolved }: { name: string | null; company: Ops["company"]; unresolved: number | null }) {
  // 일감은 고객사별로 읽는다(readOps) — 어느 탭의 할 일인지 제목에 적는다(Step 33 D48)
  const who = name ? ` · ${name}` : "";
  if (!company.ok) {
    return (
      <section className="td" aria-labelledby="td-h">
        <h2 id="td-h">오늘 원장님이 하실 일{who}</h2>
        <p className="td-none bad">할 일 목록을 못 읽었습니다</p>
      </section>
    );
  }

  const human = company.tasks.filter((t) => t.status === "사람 대기");
  const items: Item[] = human.map((t) => {
    const x = todoText(t);
    return { key: `t${t.id}`, title: x.title, why: x.why, doing: x.doing, act: <Act id={t.id} a={x.action} /> };
  });

  // 상담 결과 미입력 — 큐에 같은 일감(문의 기록 링크)이 이미 있으면 겹쳐 적지 않는다
  if (unresolved && unresolved > 0 && !human.some((t) => t.link?.includes("/admin/inquiry"))) {
    items.push({
      key: "inq", doing: null,
      title: `상담 ${unresolved}건 — 등록했는지 적기`,
      why: "문의가 등록으로 이어졌는지는 이것으로만 압니다. 건마다 버튼 하나입니다",
      act: <a className="td-btn" href="/admin/inquiry">입력하기 →</a>,
    });
  }
  // 조치 중인 것은 맨 뒤로 (정렬은 안정적이라 나머지 순서는 그대로)
  items.sort((a, b) => Number(a.doing !== null) - Number(b.doing !== null));

  const shown = items.slice(0, MAX);
  const rest = items.length - shown.length;
  const open = items.filter((x) => !x.doing).length;
  // 「세션 대기」는 원장 몫이 아니다(Step 30 Arch) — 할 일 상자 밖에 한 줄만. Claude 세션을 열면 세션이 처리한다
  const session = company.tasks.filter((t) => t.status === "세션 대기").length;

  return (
    <>
    <section className="td" aria-labelledby="td-h">
      <h2 id="td-h">오늘 원장님이 하실 일{who}{open > 0 && <span className="td-n"> {open}건</span>}</h2>
      {items.length === 0 ? (
        <p className="td-none">없습니다. 나머지는 자동으로 돕니다</p>
      ) : (
        <ol className="td-list">
          {shown.map((x) => (
            <li key={x.key} className={x.doing ? "doing" : undefined}>
              <div className="td-t">
                <b>{x.title}</b>
                <span className="td-why">{x.doing ?? x.why}</span>
              </div>
              <div className="td-act">{x.act}</div>
            </li>
          ))}
        </ol>
      )}
      {rest > 0 && <p className="td-more">나머지 {rest}건은 맨 아래 「자세히」에 있습니다</p>}
    </section>
    {session > 0 && <p className="td-session">세션에서 할 일 {session}건 — 원장님 몫이 아닙니다. Claude 세션을 열면 세션이 처리합니다</p>}
    </>
  );
}
