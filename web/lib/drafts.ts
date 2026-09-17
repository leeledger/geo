import { inqPool } from "./inquiries";

/**
 * 검토할 초안 읽기. 카드에 「검토할 초안 3편」만 뜨고 열어 볼 곳이 없었다(2026-09-17 원장 지적).
 * 고객사 학원 글은 같은 DB 의 academy.posts 에 있다.
 */
export type Draft = {
  id: number; slug: string; title: string; summary: string; body: string; category: string;
  tags: string[]; clientId: number; clientName: string; domain: string;
  createdAt: string; updatedAt: string;
  notes: { 확인필요?: string[]; 짜임새?: string[]; AI티?: { why: string; sample: string[] }[]; 모델?: string; 질문?: string | null; 경쟁출처?: string[]; 다듬음?: string; 원문?: string };
  task: { status: string; evidence: string } | null;
};

export async function listDrafts(clientId?: number): Promise<Draft[]> {
  const { rows } = await inqPool().query(
    `select p.id, p.slug, p.title, coalesce(p.summary,'') summary, coalesce(p.body,'') body, coalesce(p.category,'') category,
            coalesce(p.tags, '{}') tags, p.client_id, c.name client_name, c.domain,
            p.created_at::text created_at, p.updated_at::text updated_at,
            coalesce(to_jsonb(p) -> 'review_notes', '{}'::jsonb) notes,
            (select jsonb_build_object('status', t.status, 'evidence', t.evidence) from geo.agent_tasks t
              where t.client_id = p.client_id and t.dedupe_key = 'review-' || p.slug limit 1) task
       from academy.posts p join geo.clients c on c.id = p.client_id
      where not p.published and ($1::int is null or p.client_id = $1)
      order by p.created_at desc`,
    [clientId ?? null],
  ).catch(async (e) => {
    // agent_tasks 표가 아직 없으면 일감 칸만 빼고 읽는다
    if (!/agent_tasks/.test(String(e))) throw e;
    return inqPool().query(
      `select p.id, p.slug, p.title, coalesce(p.summary,'') summary, coalesce(p.body,'') body, coalesce(p.category,'') category,
              coalesce(p.tags, '{}') tags, p.client_id, c.name client_name, c.domain,
              p.created_at::text created_at, p.updated_at::text updated_at, '{}'::jsonb notes, null::jsonb task
         from academy.posts p join geo.clients c on c.id = p.client_id
        where not p.published and ($1::int is null or p.client_id = $1) order by p.created_at desc`, [clientId ?? null]);
  });
  return rows.map((r) => ({
    id: Number(r.id), slug: r.slug, title: r.title, summary: r.summary, body: r.body, category: r.category,
    tags: r.tags ?? [], clientId: r.client_id, clientName: r.client_name, domain: r.domain,
    createdAt: r.created_at, updatedAt: r.updated_at, notes: r.notes ?? {}, task: r.task,
  }));
}
