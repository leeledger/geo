import type { ReactNode } from "react";

import type { Ops } from "@/lib/ops";
import { todoText, type TodoAction } from "@/lib/todo-text";
import { 오늘KST, 며칠전 } from "@/lib/client-status-core.mjs";
import { finishTask, resolveNaverAttempt, requestLogin } from "@/lib/task-actions";
import SubmitButton from "../SubmitButton";

/**
 * ① 오늘 원장님이 하실 일 — 현황판 맨 위.
 *
 * 원천은 일감 표의 「사람 대기」, 그리고 7일 넘게 밀린 「세션 대기」 한 줄(Step 40 D61)이다(새 쿼리 없음). 문장은 todoText() 가 kind·payload 로 만든다 — 데이터는 안 고친다.
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
  if (a.type === "login") {
    return (
      <form action={requestLogin}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton className="td-btn">로그인 창 열기</SubmitButton>
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

export default function Todo({ name, company, unresolved, marketing = 0 }: { name: string | null; company: Ops["company"]; unresolved: number | null; marketing?: number }) {
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
  // 바깥 글(Step 35 D54) — 글마다 줄을 세우지 않고 하루 한 줄. 손은 아래 「오늘 올릴 글」 카드에서
  if (marketing > 0 && name) {
    items.push({
      key: "mk", doing: null,
      title: `${name} 글 ${marketing}건 올리기(3분)`,
      why: "지식iN·카페는 본문 복사 → 질문 골라 붙이기 → 주소 적기. 블로그는 읽고 확인만",
      act: <a className="td-btn" href="#mk">올리러 가기 →</a>,
    });
  }
  // 「세션 대기」는 Claude 세션 몫(Step 30). 가장 오래된 것이 7일을 넘으면 세션을 여는 것이 원장 할 일이 된다(Step 40 D61)
  const 오늘 = 오늘KST();
  const sessionTasks = company.tasks.filter((t) => t.status === "세션 대기");
  const session = sessionTasks.length;
  const sessionDays = Math.max(0, ...sessionTasks.map((t) => 며칠전(t.createdAt, 오늘) ?? 0));
  const sessionLate = session > 0 && sessionDays >= 7 && !!name;
  if (sessionLate) {
    const questions = sessionTasks.flatMap((t) => {
      const l = Array.isArray(t.payload?.questions) ? (t.payload.questions as unknown[]).filter((x): x is string => typeof x === "string") : [];
      return l.length ? l : typeof t.payload?.question === "string" ? [t.payload.question] : [];
    });
    // 맨 앞에 — 뒤에 두면 다섯 줄 상한에 밀려 「자세히」로 빠지는데, 거기엔 이 줄이 없다
    items.unshift({
      key: "session", doing: null,
      title: `${name} 저장소에서 Claude 세션 한 번 열기`,
      why: `가이드 글 일감이 ${sessionDays}일째 밀렸습니다. 세션에 「밀린 세션 글 써 줘」라고 하면 됩니다`,
      act: (
        <details className="td-more-d">
          <summary className="td-btn alt">묶인 질문 보기</summary>
          <ul>{questions.map((x) => <li key={x}>{x}</li>)}</ul>
        </details>
      ),
    });
  }
  // 조치 중인 것은 맨 뒤로 (정렬은 안정적이라 나머지 순서는 그대로)
  items.sort((a, b) => Number(a.doing !== null) - Number(b.doing !== null));

  const shown = items.slice(0, MAX);
  const rest = items.length - shown.length;
  const open = items.filter((x) => !x.doing).length;
  // 원장 밖에 밀린 일(세션·원장 PC·자동 수리·실패) — 있으면 맨 위 고객 상태 칸에 있다고 알린다
  const 밖에밀림 = company.tasks.some((t) => ["세션 대기", "로컬 대기", "수리 대기", "실패"].includes(t.status));

  return (
    <>
    <section className="td" aria-labelledby="td-h">
      <h2 id="td-h">오늘 원장님이 하실 일{who}{open > 0 && <span className="td-n"> {open}건</span>}</h2>
      {items.length === 0 ? (
        <p className="td-none">{밖에밀림 ? "원장님 몫은 없습니다. 밀린 일은 맨 위에 있습니다" : "원장님 몫은 없습니다"}</p>
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
    {session > 0 && !sessionLate && <p className="td-session">Claude 세션 몫 {session}건 · 가장 오래된 것 {sessionDays === 0 ? "오늘" : `${sessionDays}일째`} — 세션을 열어야 움직입니다</p>}
    </>
  );
}
