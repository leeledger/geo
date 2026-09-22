"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";

/**
 * 초안 검토 화면의 동작. 발행은 원장이 사실 확인을 끝냈다는 뜻이다 (CLAUDE.md 「발행 전 사실 확인」).
 * 발행하면 유통 담당 일감(색인 알림)을 바로 만든다 — 다음 회사 루프(매시)가 집어 간다.
 */

const slugOf = (form: FormData) => String(form.get("slug") ?? "").trim();

async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}

async function log(clientId: number, action: string, summary: string, ok = true) {
  await inqPool().query(
    `insert into geo.agent_activity (client_id, agent, action, ok, summary) values ($1, 'content', $2, $3, $4)`,
    [clientId, action, ok, summary],
  ).catch((e) => console.error("활동 기록 실패", e));
}

/** 콘텐츠 담당이 다듬기 전 원문으로 되돌린다 */
export async function revertDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug) return;
  const { rows } = await inqPool().query(
    `update academy.posts set body = review_notes->>'원문', updated_at=now(),
            review_notes = (review_notes - '원문') || jsonb_build_object('다듬음', '원장이 원문으로 되돌림')
      where slug=$1 and not published and review_notes ? '원문' returning client_id, title`, [slug]);
  if (rows[0]) await log(rows[0].client_id, "원문으로 되돌림", rows[0].title);
  revalidatePath("/admin/drafts");
}

export async function saveDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug) return;
  await inqPool().query(
    `update academy.posts set title=$2, summary=$3, body=$4, updated_at=now() where slug=$1 and not published`,
    [slug, String(form.get("title") ?? "").slice(0, 200), String(form.get("summary") ?? "").slice(0, 600), String(form.get("body") ?? "")],
  );
  revalidatePath("/admin/drafts");
}

/**
 * 도해 없는 초안은 발행하지 않는다(원장 2026-09-22 「도해는 무조건」). 화면은 버튼을 막고 이유를 보여 주고,
 * 여기서 한 번 더 막는다 — 본문에 `![` 가 없으면 update 가 0행이다
 */
export async function publishDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug) return;
  const { rows } = await inqPool().query(
    `update academy.posts set published=true, published_at=now(), updated_at=now()
      where slug=$1 and not published and position('![' in body) > 0
        -- 본문이 가리키는 /blog/img 그림이 post_images 에 다 있어야 한다 — 없는 그림 주소로 발행되면 빈 칸이 나간다
        and not exists (select 1 from regexp_matches(body, '/blog/img/([^/)\\s]+)/([a-z0-9-]+)\\.svg', 'g') m
                         where not exists (select 1 from academy.post_images i where i.slug = m[1] and i.name = m[2]))
      returning client_id, title`,
    [slug],
  );
  const p = rows[0];
  if (!p) return;
  // sticky: 정찰 같은 신호에서 나온 일이 아니다. 없으면 회사 루프가 「신호 사라짐」으로 바로 닫는다
  await inqPool().query(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority)
     values ($1, 'deliver', 'announce', $2, $3, '원장이 사실 확인 후 발행한 글을 검색엔진에 알리고 네이버 이관·구글 색인 요청을 잡습니다.', $4::jsonb, 20)
     on conflict (client_id, dedupe_key) do update set status='대기', attempts=0, next_try_at=now(), updated_at=now(),
       payload = geo.agent_tasks.payload || excluded.payload`,
    [p.client_id, `announce-${slug}`, `새 글 알리기: ${p.title}`, JSON.stringify({ slug, sticky: true })],
  ).catch((e) => log(p.client_id, "발행 알림 일감 만들기 실패", String(e), false));
  await inqPool().query(
    `update geo.agent_tasks set status='완료', done_at=now(), updated_at=now(), evidence = evidence || $3
      where client_id=$1 and dedupe_key=$2 and status <> '완료'`,
    [p.client_id, `review-${slug}`, "\n원장 확인 후 발행"],
  ).catch(() => {});
  await log(p.client_id, "원장 승인 발행", `${p.title} (/blog/${slug})`);
  revalidatePath("/admin/drafts");
  revalidatePath("/admin/ops");
}

/**
 * 도해 다시 그리기 — 시도 기록을 지우고 삽화 담당 일감을 지금 대기로 돌린다. 다음 회사 루프(매시)가 집어 간다.
 * 일감이 아직 없으면 만든다(회사 루프 계획과 같은 키)
 */
export async function requeueIllustrate(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug) return;
  const { rows } = await inqPool().query(
    `update academy.posts set review_notes = review_notes - '삽화'
      where slug=$1 and not published and position('![' in body) = 0 returning client_id, title`, [slug]);
  const p = rows[0];
  if (!p) return;
  await inqPool().query(
    `insert into geo.agent_tasks (client_id, agent, kind, dedupe_key, title, detail, payload, priority)
     values ($1, 'content', 'illustrate', $2, $3, '원장이 도해를 다시 그리라고 했습니다.', $4::jsonb, 16)
     on conflict (client_id, dedupe_key) do update set status='대기', attempts=0, next_try_at=now(), updated_at=now(),
       evidence = left(geo.agent_tasks.evidence || E'\n원장이 다시 그리기 요청', 4000)`,
    [p.client_id, `illustrate-${slug}`, `도해 그리기: ${p.title}`, JSON.stringify({ slug })],
  ).catch((e) => log(p.client_id, "도해 다시 그리기 요청 실패", String(e), false));
  await log(p.client_id, "도해 다시 그리기 요청", p.title);
  revalidatePath("/admin/drafts");
}

export async function discardDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug || form.get("confirm") !== "yes") return;
  const { rows } = await inqPool().query(
    `delete from academy.posts where slug=$1 and not published returning client_id, title`, [slug]);
  if (rows[0]) {
    await inqPool().query(
      `update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = evidence || '\n원장이 초안을 버림'
        where client_id=$1 and dedupe_key = any($2)`,
      [rows[0].client_id, [`review-${slug}`, `illustrate-${slug}`, `illustrate-human-${slug}`]]).catch(() => {});
    // 버린 초안의 도해(Step 12)는 어디서도 안 쓴다. 남겨 두면 /blog/img 주소로 계속 열린다
    await inqPool().query(`delete from academy.post_images where slug=$1`, [slug]).catch(() => {});
    await log(rows[0].client_id, "초안 버림", rows[0].title);
  }
  revalidatePath("/admin/drafts");
}
