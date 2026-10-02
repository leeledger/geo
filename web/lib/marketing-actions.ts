"use server";

import { revalidatePath } from "next/cache";

import { isAdmin } from "./admin-auth";
import { pool } from "./ops";

/**
 * 「오늘 올릴 글」 카드의 버튼 (Step 35 D54). "use server" 모듈은 async 함수만 내보낸다 — 상수(BLOG_OK)는 marketing.ts.
 * 서버 동작은 동작 번호만 알면 누구나 부를 수 있다. 화면이 관리자 전용이어도 동작 자체를 막는다
 */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}

const 아이디 = (form: FormData) => {
  const n = Number(form.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** 올렸어요 — 올린 주소를 같이 받는다. 주소가 없으면 효과(AI 답 출처)를 셀 수 없어 받지 않는다 */
export async function markPosted(form: FormData) {
  await guard();
  const id = 아이디(form);
  const url = String(form.get("url") ?? "").trim().slice(0, 500);
  if (!id || !/^https?:\/\/\S+$/i.test(url)) return;
  await pool().query(
    `update geo.marketing_posts set status = '올림', posted_url = $2, posted_at = now() where id = $1 and status = '초안'`, [id, url]);
  revalidatePath("/admin/ops");
}

/** 버림 — 안 올린다. 같은 질문은 14일 동안 다시 안 쓴다(초안 스크립트가 상태와 상관없이 센다) */
export async function discardDraft(form: FormData) {
  await guard();
  const id = 아이디(form);
  if (!id) return;
  await pool().query(
    `update geo.marketing_posts set status = '버림', note = left('원장 버림 · ' || note, 1000) where id = $1 and status = '초안'`, [id]);
  revalidatePath("/admin/ops");
}

/** 블로그 초안을 읽고 확인했다 — 로컬 에이전트가 문서딱 블로그에 올린다(D55). note 앞머리 「게시 승인」 */
export async function approveBlog(form: FormData) {
  await guard();
  const id = 아이디(form);
  if (!id) return;
  await pool().query(
    `update geo.marketing_posts set note = '게시 승인 ' || to_char(now() at time zone 'Asia/Seoul', 'MM-DD HH24:MI')
      where id = $1 and status = '초안' and channel = 'blog'`, [id]);
  revalidatePath("/admin/ops");
}
