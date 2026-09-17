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

export async function publishDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug) return;
  const { rows } = await inqPool().query(
    `update academy.posts set published=true, published_at=now(), updated_at=now()
      where slug=$1 and not published returning client_id, title`,
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

export async function discardDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug || form.get("confirm") !== "yes") return;
  const { rows } = await inqPool().query(
    `delete from academy.posts where slug=$1 and not published returning client_id, title`, [slug]);
  if (rows[0]) {
    await inqPool().query(
      `update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = evidence || '\n원장이 초안을 버림'
        where client_id=$1 and dedupe_key=$2`, [rows[0].client_id, `review-${slug}`]).catch(() => {});
    await log(rows[0].client_id, "초안 버림", rows[0].title);
  }
  revalidatePath("/admin/drafts");
}
