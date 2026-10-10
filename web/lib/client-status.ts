import { pool } from "./ops";
import { 상태문장, 이번주, 오늘KST, type StatusRaw, type StatusText, type Backlog } from "./client-status-core.mjs";

/**
 * 고객 상태 칸(Step 40 D63) — 원장이 고객 탭 맨 위에서 「이번 주 실제로 한 일 / 밀린 일·며칠째」를 읽는다.
 * 이번 주 = 어제까지 7일(KST). 문장은 client-status-core.mjs 가 만든다.
 * 못 읽으면 ok:false — 화면은 「이 고객 상태를 못 읽었습니다」(빈 칸·0 으로 쓰지 않는다).
 */
export type ClientStatus = { ok: true; s: StatusText } | { ok: false; err: string };

const 색인활동 = `(action in ('구글 색인 요청', '빙 주소 제출') or action like '네이버 이관:%')`;
const 밀린상태: Record<string, keyof StatusRaw["backlog"]> = {
  "사람 대기": "owner", "세션 대기": "session", "로컬 대기": "local", "수리 대기": "repair", "실패": "failed",
};

export async function readClientStatus(client: { id: number; name: string }): Promise<ClientStatus> {
  try {
    const p = pool();
    const q = async <R = Record<string, unknown>>(sql: string, args: unknown[]) => (await p.query(sql, args)).rows as R[];
    const 오늘 = 오늘KST();
    const { from, to } = 이번주(오늘);
    const 주 = [client.id, from, to];
    const 주안 = (col: string) => `(${col} at time zone 'Asia/Seoul')::date between $2::date and $3::date`;
    const [[posts], outside, [guides], acts, [last], backlog, [repair]] = await Promise.all([
      q<{ n: number }>(`select count(*)::int n from academy.posts where client_id=$1 and published and ${주안("published_at")}`, 주),
      q<{ channel: string; n: number }>(`select channel, count(*)::int n from geo.marketing_posts
          where client_id=$1 and status='올림' and ${주안("posted_at")} group by channel`, 주),
      q<{ n: number }>(`select count(*)::int n from geo.agent_tasks where client_id=$1 and kind='question-draft' and status='완료' and ${주안("done_at")}`, 주),
      q<{ k: string; n: number }>(`select case when action = '구글 색인 요청' then 'gsc' when action = '빙 주소 제출' then 'bing'
                 when action like '네이버 이관:%' then 'naver' else 'measure' end k, count(*)::int n
          from geo.agent_activity where client_id=$1 and ok and ${주안("at")}
           and (${색인활동} or action = '소비자 화면 AI 측정') group by 1`, 주),
      // 손댄 마지막 날 — 실제 작업만(사이트 글 발행·바깥 글 올림·가이드 글 반영), 전체 기간.
      // 색인 요청·빙 제출·네이버 옮김·측정은 기계가 저절로 하는 일이라 안 넣는다(세션 결정 2026-10-10)
      q<{ post: string | null; outside: string | null; guide: string | null }>(`select
            (select (max(published_at) at time zone 'Asia/Seoul')::date::text from academy.posts where client_id=$1 and published) post,
            (select (max(posted_at) at time zone 'Asia/Seoul')::date::text from geo.marketing_posts where client_id=$1 and status='올림') outside,
            (select (max(done_at) at time zone 'Asia/Seoul')::date::text from geo.agent_tasks
              where client_id=$1 and kind='question-draft' and status='완료') guide`, [client.id]),
      q<{ status: string; n: number; oldest: string; qn: number }>(`select status, count(*)::int n,
            (min(created_at) at time zone 'Asia/Seoul')::date::text oldest,
            sum(case when jsonb_typeof(payload->'questions') = 'array' then greatest(jsonb_array_length(payload->'questions'), 1) else 1 end)::int qn
          from geo.agent_tasks where client_id=$1 and status = any($2::text[]) group by status`, [client.id, Object.keys(밀린상태)]),
      // 자동 코드 수리 스위치 — pm-report 와 같은 셈(마지막 repair 활동이 「스위치 꺼짐」)
      q<{ off: boolean | null }>(`select summary like '스위치 꺼짐%' off from geo.agent_activity where agent = 'repair' order by at desc limit 1`, []),
    ]);
    const k = (key: string) => acts.find((a) => a.k === key)?.n ?? 0;
    const ch = (c: string) => outside.find((o) => o.channel === c)?.n ?? 0;
    const b: StatusRaw["backlog"] = {};
    for (const r of backlog) {
      const key = 밀린상태[r.status];
      const x: Backlog = { n: r.n, oldest: r.oldest };
      if (key === "session") x.q = r.qn;
      b[key] = x;
    }
    const raw: StatusRaw = {
      name: client.name,
      measure: k("measure"), posts: posts?.n ?? 0,
      outside: { blog: ch("blog"), jisikin: ch("jisikin"), cafe: ch("cafe") },
      guides: guides?.n ?? 0, gsc: k("gsc"), bing: k("bing"), naver: k("naver"),
      touched: { post: last?.post ?? null, outside: last?.outside ?? null, guide: last?.guide ?? null }, backlog: b, repairOff: !!repair?.off,
    };
    return { ok: true, s: 상태문장(raw, 오늘) };
  } catch (e) {
    console.error("고객 상태 읽기 실패", e);
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}
