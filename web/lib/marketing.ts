import { pool } from "./ops";
import { countUsed, readSpots, searchLink, type Channel, type UsedCount } from "./marketing-core.mjs";
import { 창상태말, 공급말 } from "./kin-core.mjs";

/**
 * 「오늘 올릴 글」 카드 읽기 (Step 35 D54·D56). 쓰기(서버 동작)는 marketing-actions.ts.
 *
 * 초안은 academy/scripts/marketing-draft.mjs 가 매일 쓴다. 지식iN·카페는 원장이 손으로 올리고 주소를 적는다.
 * 블로그는 원장이 「확인했어요」를 누르면 로컬 에이전트가 올린다(D55) — 발행 전 사실 확인은 사람 몫이다(CLAUDE.md).
 * 효과는 올린 주소가 AI 답 출처에 나왔는지만 센다. 기여 추정은 하지 않는다.
 */

/** 블로그 초안을 원장이 확인했다는 표시 — note 앞머리. 로컬 에이전트가 이 줄이 있는 블로그 초안만 올린다 */
export const BLOG_OK = "게시 승인";

export type MarketingDraft = {
  id: number;
  channel: Channel;
  query: string;
  sourceUrl: string;
  title: string;
  body: string;
  createdOn: string;
  blogOk: boolean;
  /** 원문과 겹침이 낮은 문장 — 올리기 전에 읽을 자리(숫자 없는 지어낸 말 후보) */
  spots: string[];
  search: string | null;
  /** 지식iN 실제 질문(Step 41) — 있으면 카드가 질문을 보여 주고 「이 질문에 답하기」 버튼을 띄운다 */
  kin: { url: string; title: string; head: string; askedOn: string } | null;
  /** 「이 질문에 답하기」 창 요청 상태 — open-kin 일감 */
  kinTask: { status: string; note: string } | null;
};

export type Marketing =
  | { ok: true; enabled: boolean; drafts: MarketingDraft[]; todo: number; used: UsedCount | null; firstPosted: string | null; kinSupply?: string | null }
  | { ok: false; err: string };

const noTable = (e: unknown) => (e as { code?: string })?.code === "42P01";

/**
 * 고른 고객의 올릴 글. 초안은 7일 것까지 — 하루 못 올린 글이 다음 날 사라지면 안 된다.
 * enabled — 이 고객에 초안이 한 번이라도 있었나. 바깥 글을 안 쓰는 고객(학원·아이로그) 탭에는 카드를 안 띄운다
 */
export async function readMarketing(clientId: number): Promise<Marketing> {
  try {
    const db = pool();
    const { rows: any } = await db.query(`select 1 from geo.marketing_posts where client_id = $1 limit 1`, [clientId]);
    if (!any.length) return { ok: true, enabled: false, drafts: [], todo: 0, used: null, firstPosted: null };

    const { rows } = await db.query(
      `select m.id::int, m.channel, m.target_query, m.source_url, m.title, m.body, m.created_on::text, m.note,
              k.url as kin_url, k.title as kin_title, left(k.body, 200) as kin_head, k.asked_at::text as kin_asked,
              t.status as task_status, t.last_error as task_error, t.evidence as task_evidence
         from geo.marketing_posts m
         left join geo.kin_questions k on k.id = m.kin_question_id
         left join geo.agent_tasks t on t.client_id = m.client_id and t.dedupe_key = 'open-kin-' || m.id
        where m.client_id = $1 and m.status = '초안'
          and m.created_on > (now() at time zone 'Asia/Seoul')::date - 7
        order by m.created_on desc, array_position(array['jisikin','cafe','blog'], m.channel), m.id`, [clientId]);
    const drafts: MarketingDraft[] = rows.map((r) => ({
      id: r.id, channel: r.channel, query: r.target_query, sourceUrl: r.source_url, title: r.title, body: r.body,
      createdOn: r.created_on, blogOk: String(r.note ?? "").startsWith(BLOG_OK), spots: readSpots(r.note),
      // 실제 질문이 붙은 답은 검색 링크가 필요 없다 — 질문 주소가 있다
      search: r.kin_url ? null : searchLink(r.channel, r.target_query),
      kin: r.kin_url ? { url: r.kin_url, title: r.kin_title, head: r.kin_head ?? "", askedOn: r.kin_asked } : null,
      kinTask: r.task_status ? { status: r.task_status, note: 창상태말(r.task_status, r.task_error, r.task_evidence) } : null,
    }));
    // 원장 몫 — 손으로 올릴 지식iN·카페, 확인을 기다리는 블로그
    const todo = drafts.filter((d) => d.channel !== "blog" || !d.blogOk).length;

    const { rows: posted } = await db.query(
      `select id::int, posted_url, (posted_at at time zone 'Asia/Seoul')::date::text as posted_day
         from geo.marketing_posts where client_id = $1 and status = '올림' and posted_url is not null and posted_at is not null`, [clientId]);
    let used: UsedCount | null = null;
    const firstPosted = posted.map((p) => p.posted_day as string).sort()[0] ?? null;
    if (firstPosted) {
      // 승인 질문(q<번호>) 측정만 — 탐침은 따로 표다. 곳 = 측정 방법(collection_method) — pilot-report 와 같은 칸으로 묶는다
      const { rows: cites } = await db.query(
        `select m.collection_method as engine, m.measured_on::text as measured_on, c->>'url' as url
           from academy.ai_measurements m, jsonb_array_elements(m.citations) c
          where m.client_id = $1 and m.measured_on >= $2::date and m.prompt_id ~ '^q[0-9]+$'`, [clientId, firstPosted]);
      used = countUsed(posted, cites);
    }
    // 지식iN 공급(KG-41-6) — 찾기를 한 번이라도 돈 고객만. 표가 아직 없으면 줄을 안 띄운다
    const kinSupply = await db.query(
      `select (select count(*)::int from geo.kin_runs where client_id = $1) as runs,
              (select coalesce(sum(read), 0)::int from geo.kin_runs where client_id = $1 and at > now() - interval '7 days') as read,
              (select coalesce(sum(matched), 0)::int from geo.kin_runs where client_id = $1 and at > now() - interval '7 days') as matched,
              (select count(*)::int from geo.kin_questions where client_id = $1 and found_at > now() - interval '7 days' and note = '채택된 답 있음') as missed`, [clientId])
      .then(({ rows: [s] }) => (s && s.runs > 0 ? 공급말({ 읽음: s.read, 맞음: s.matched, 놓침: s.missed }) : null))
      .catch(() => null);
    return { ok: true, enabled: true, drafts, todo, used, firstPosted, kinSupply };
  } catch (e) {
    if (noTable(e)) return { ok: true, enabled: false, drafts: [], todo: 0, used: null, firstPosted: null };
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}
