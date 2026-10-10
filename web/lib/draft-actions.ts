"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { DISCARD_REASONS } from "./drafts";
import { 발행, 내리기 } from "./post-auto-core.mjs";

/**
 * 초안 검토 화면의 동작. 원장 버튼 발행은 원장 판단이 감수라 자동 감수 조건을 안 본다.
 * 자동 글(Step 43)은 자동 감수를 통과하면 스스로 나가고, 원장은 나간 글을 「내리기」로 내린다.
 * 발행하면 유통 담당 일감(색인 알림)을 바로 만든다 — 다음 회사 루프(매시)가 집어 간다.
 */

const slugOf = (form: FormData) => String(form.get("slug") ?? "").trim();
const q = (sql: string, params: unknown[] = []) => inqPool().query(sql, params).then((r) => r.rows);

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
  // 조건(그림 있음·비공개이유 없음·본문 그림이 다 저장됨)·알림 일감·검토 일감 완료·활동은 core 한 곳 — 자동 발행과 같은 길(Step 43 D82)
  await 발행(q, slug, { 누가: "원장" });
  revalidatePath("/admin/drafts");
  revalidatePath("/admin/ops");
}

/** 학원 사이트 목록(홈·RSS·사이트맵·블로그)을 바로 다시 그리게 한다 — academy/app/api/posts PATCH */
async function 학원목록새로(slug: string) {
  const pw = process.env.ACADEMY_ADMIN_PASSWORD;
  if (!pw) throw new Error("ACADEMY_ADMIN_PASSWORD 가 없어 목록은 15분 안에 저절로 빠짐");
  const base = process.env.ACADEMY_SITE_URL || "https://robotncoding.com";
  const res = await fetch(`${base}/api/posts?slug=${encodeURIComponent(slug)}`, {
    method: "PATCH", headers: { "x-admin-pw": pw, ...(process.env.ACADEMY_ADMIN_ID ? { "x-admin-id": process.env.ACADEMY_ADMIN_ID } : {}) },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`학원 사이트 응답 ${res.status}`);
}

/** 내린 이유 — 고르기만 하면 된다. 다음 글 고를 때·아침 보고에서 사람이 읽는다 */
export async function takedownPost(form: FormData) {
  await guard();
  const slug = slugOf(form);
  if (!slug) return;
  const 고름 = String(form.get("reason") ?? "").trim();
  const 덧 = String(form.get("note") ?? "").trim();
  const 이유 = [고름, 덧].filter(Boolean).join(" — ").slice(0, 200);
  // 사이트는 revalidate 300 이라 5분 안에 사라진다. 네이버 글은 로그인이 필요해 사람 일감으로 남는다(D91)
  const r = await 내리기(q, slug, { 이유, 블로그: process.env.NAVER_BLOG_ID || "force11" });
  // 홈 「최근 글」·RSS·사이트맵은 학원 사이트 캐시(900초)라 여기 revalidatePath 가 안 닿는다 — 학원 사이트에 바로 다시 그리라고 부른다.
  // 비밀번호가 없거나 실패하면 목록은 15분 안에 저절로 빠진다. 실패를 활동에 남긴다
  if (r.ok) await 학원목록새로(slug).catch((e) => log(r.clientId ?? 1, "내린 글 목록 새로 고침 실패", String(e), false));
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

/**
 * 초안 버리기. 이유를 하나도 안 고르면 아무것도 안 지운다 —
 * 왜 버렸는지를 안 남기면 다음 주에 똑같은 글이 또 온다. 이틀에 3편을 그렇게 버렸다(2026-09-23).
 */
export async function discardDraft(form: FormData) {
  await guard();
  const slug = slugOf(form);
  const reasons = form.getAll("reason").map((r) => String(r))
    .filter((r) => (DISCARD_REASONS as readonly string[]).includes(r));
  if (!slug || reasons.length === 0) return;
  const note = String(form.get("note") ?? "").trim().slice(0, 300);

  // 지우기 전에 이유를 남긴다. 지운 뒤에는 본문을 못 읽는다
  const { rows: before } = await inqPool().query(
    `select client_id, title, body from academy.posts where slug=$1 and not published`, [slug]);
  if (!before[0]) return;
  await inqPool().query(
    `insert into academy.draft_feedback (client_id, slug, title, reasons, note, excerpt)
     values ($1, $2, $3, $4::text[], $5, $6)`,
    [before[0].client_id, slug, before[0].title, reasons, note, String(before[0].body ?? "").slice(0, 600)],
  ).catch((e) => console.error("버린 이유 기록 실패", e));

  const { rows } = await inqPool().query(
    `delete from academy.posts where slug=$1 and not published returning client_id, title`, [slug]);
  if (rows[0]) {
    await inqPool().query(
      `update geo.agent_tasks set status='닫힘', done_at=now(), updated_at=now(), evidence = evidence || '\n원장이 초안을 버림'
        where client_id=$1 and dedupe_key = any($2)`,
      [rows[0].client_id, [`review-${slug}`, `illustrate-${slug}`, `illustrate-human-${slug}`]]).catch(() => {});
    // 버린 초안의 도해(Step 12)는 어디서도 안 쓴다. 남겨 두면 /blog/img 주소로 계속 열린다
    await inqPool().query(`delete from academy.post_images where slug=$1`, [slug]).catch(() => {});
    await log(rows[0].client_id, "초안 버림", `${rows[0].title} — ${reasons.join(" · ")}${note ? ` · 「${note}」` : ""}`);
  }
  revalidatePath("/admin/drafts");
}
