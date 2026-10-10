import { inqPool } from "./inquiries";

/**
 * 검토할 초안 읽기. 카드에 「검토할 초안 3편」만 뜨고 열어 볼 곳이 없었다(2026-09-17 원장 지적).
 * 고객사 학원 글은 같은 DB 의 academy.posts 에 있다.
 */
/**
 * 버린 이유 — 다음 프롬프트가 이걸 읽는다(academy.draft_feedback → write-draft.mjs).
 * 자유 입력만 두면 셀 수가 없어 칩으로 고정한다. 쓰기는 draft-actions.ts 에 있다
 * ("use server" 모듈은 내보내는 것이 전부 async 함수여야 한다).
 */
export const DISCARD_REASONS = [
  "일반론", "지어낸 장면", "사실이 틀림", "우리 얘기가 아님", "문체(AI 티)", "주제가 안 맞음", "이미 쓴 내용",
] as const;

export type Draft = {
  id: number; slug: string; title: string; summary: string; body: string; category: string;
  tags: string[]; clientId: number; clientName: string; domain: string;
  createdAt: string; updatedAt: string;
  notes: { 확인필요?: string[]; 짜임새?: string[]; AI티?: { why: string; sample: string[] }[]; 모델?: string; 질문?: string | null; 경쟁출처?: string[]; 다듬음?: string; 원문?: string;
    비공개이유?: string;
    /** 쓰기 전에 모은 근거 (Step 19, write-draft). 글은 이 표에 있는 숫자·날짜만 쓸 수 있다 */
    근거표?: { 사실?: string[]; 추정?: string[]; 확인필요?: string[] };
    삽화?: { 장수?: number; 버린것?: string[]; 쓴날?: string; 시도?: number } };
  task: { status: string; evidence: string } | null;
  /** 삽화 담당이 그린 도해(academy.post_images) 이름 → SVG. 초안 그림은 공개 경로가 안 내보내서 여기서 읽는다 */
  images: Record<string, string>;
};

/** 내린 이유 — 고르기만 하면 된다(draft-actions.ts takedownPost) */
export const TAKEDOWN_REASONS = ["사실이 틀림", "광고로 읽힘", "옛 이야기", "문체(AI 티)", "우리 얘기가 아님"] as const;

type 감수단계 = {
  회차?: number; 다시쓰기?: string;
  a?: { 통과: boolean; 왜: string; 출처?: { 주소: string; 최종?: string; 상태: string; 왜?: string; 맞음: number }[]; 대조?: number; 맞음?: number; 지운것?: string[] };
  b?: { 통과: boolean; 걸림?: string[]; 고친것?: string };
  c?: { 통과: boolean; 왜?: string; 걸림?: { 문장: string; 종류: string }[]; 말리기?: string };
  d?: { 통과: boolean; 걸림?: string[] };
};
/** 자동 글(Step 43) — 감수 중 초안과 최근 30일 자동 발행 글. 검토 화면 맨 위 「자동 글」 절이 읽는다 */
export type AutoPost = {
  slug: string; title: string; published: boolean; publishedAt: string | null; domain: string;
  주제: { 제목?: string; 이유?: string } | null;
  재료: string[];
  감수: { 통과?: boolean; 회차?: number; 고침?: string[] } | null;
  기록: 감수단계 | null;
};

export async function listAutoPosts(): Promise<AutoPost[]> {
  const { rows } = await inqPool().query(
    `select p.slug, p.title, p.published, p.published_at::text published_at, c.domain, coalesce(p.review_notes, '{}'::jsonb) notes
       from academy.posts p join geo.clients c on c.id = p.client_id
      where coalesce(p.review_notes, '{}'::jsonb) ? '주제' and not (coalesce(p.review_notes, '{}'::jsonb) ? '비공개이유')
        and (not p.published or p.published_at > now() - interval '30 days')
      order by p.published, coalesce(p.published_at, p.created_at) desc`);
  return rows.map((r) => {
    const n = r.notes ?? {};
    const 표 = new Map<string, string>((Array.isArray(n.재료표) ? n.재료표 : []).map((m: { 라벨: string; 원문: string }) => [String(m.라벨), String(m.원문 ?? "")]));
    const 쓴 = [...new Set((Array.isArray(n.주장) ? n.주장 : []).flatMap((c: { 재료?: unknown }) => (Array.isArray(c?.재료) ? c.재료.map(String) : [])))] as string[];
    return {
      slug: r.slug, title: r.title, published: !!r.published, publishedAt: r.published_at, domain: r.domain,
      주제: n.주제 ?? null,
      재료: 쓴.filter((l) => 표.has(l)).map((l) => `${l} ${표.get(l)!.slice(0, 40)}`),
      감수: n.감수 ?? null,
      기록: n.감수기록 ?? null,
    };
  });
}

export async function listDrafts(clientId?: number): Promise<Draft[]> {
  const { rows } = await inqPool().query(
    `select p.id, p.slug, p.title, coalesce(p.summary,'') summary, coalesce(p.body,'') body, coalesce(p.category,'') category,
            coalesce(p.tags, '{}') tags, p.client_id, c.name client_name, c.domain,
            p.created_at::text created_at, p.updated_at::text updated_at,
            coalesce(to_jsonb(p) -> 'review_notes', '{}'::jsonb) notes,
            (select jsonb_build_object('status', t.status, 'evidence', t.evidence) from geo.agent_tasks t
              where t.client_id = p.client_id and t.dedupe_key = 'review-' || p.slug limit 1) task
       from academy.posts p join geo.clients c on c.id = p.client_id
      where not p.published and not (coalesce(to_jsonb(p) -> 'review_notes', '{}'::jsonb) ? '비공개이유')
        and ($1::int is null or p.client_id = $1)
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
        where not p.published and not (coalesce(to_jsonb(p) -> 'review_notes', '{}'::jsonb) ? '비공개이유')
          and ($1::int is null or p.client_id = $1) order by p.created_at desc`, [clientId ?? null]);
  });
  // 초안 그림은 사이트(/blog/img)가 발행 전에는 안 내보낸다 — 검토 화면이 DB 에서 직접 읽어 미리 보여 준다
  const imgs: { slug: string; name: string; svg: string }[] = rows.length
    ? (await inqPool().query(`select slug, name, svg from academy.post_images where slug = any($1)`, [rows.map((r) => r.slug)])
        .catch(() => ({ rows: [] }))).rows
    : [];
  return rows.map((r) => ({
    id: Number(r.id), slug: r.slug, title: r.title, summary: r.summary, body: r.body, category: r.category,
    tags: r.tags ?? [], clientId: r.client_id, clientName: r.client_name, domain: r.domain,
    createdAt: r.created_at, updatedAt: r.updated_at, notes: r.notes ?? {}, task: r.task,
    images: Object.fromEntries(imgs.filter((i) => i.slug === r.slug).map((i) => [i.name, i.svg])),
  }));
}
