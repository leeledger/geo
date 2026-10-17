"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { CODE_SLUGS, 등록, 오류말 } from "./client-core.mjs";
import { 두칸칸, 자동한걸음, 재시도, 사실입력검사, 사실저장, type 걸음 } from "./auto-setup-core.mjs";
import { checkPlatform } from "./platform-check";
import { detectPlatform } from "./platform";

/**
 * 두 칸 등록·자동 세팅 판(Step 55e). 계산·SQL 은 auto-setup-core.mjs — 매시 고리·시험과 같은 함수.
 * 서버 동작은 동작 번호만 알면 누구나 부를 수 있다 — 여기서 관리자를 다시 본다(client-actions 와 같은 guard).
 * 한 동작에 한 단계(≤30초) — 고객 화면 page.tsx maxDuration 60 안에 든다(D230).
 */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}

/** 한 연결에 묶은 q — 등록이 그 위에서 begin/commit 한다 */
async function 연결<T>(fn: (q: (s: string, p?: unknown[]) => Promise<any[]>) => Promise<T>): Promise<T> {
  const db = await inqPool().connect();
  try {
    return await fn((s, p = []) => db.query(s, p).then((r) => r.rows));
  } finally {
    db.release();
  }
}
const q = (s: string, p: unknown[] = []) => inqPool().query(s, p).then((r) => r.rows);
const 고객slug = (v: unknown) => {
  const slug = String(v ?? "");
  return /^[a-z0-9-]{1,40}$/.test(slug) && !CODE_SLUGS.includes(slug) ? slug : null;
};

export type 두칸State = { 오류: string[]; 값: Record<string, string>; n: number; 겹침?: string };
const 폼글자 = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

/** 두 칸 등록 — 바깥 요청 없이 칸만 채워 등록() 하고 고객 화면으로. 자동 세팅은 그 화면의 판이 잇는다 */
export async function registerAuto(prev: 두칸State, form: FormData): Promise<두칸State> {
  await guard();
  const 값 = 폼글자(form);
  const 쓰인 = (await q(`select slug from geo.clients`)).map((r) => String(r.slug));
  const r = 두칸칸(값, 쓰인);
  if (!r.ok || !r.칸) return { 오류: r.오류, 값, n: prev.n + 1 };
  const 결과 = await 연결((dq) => 등록(dq, r.칸!));
  if (!결과.ok) {
    if (결과.err === "name-dup") return { 오류: [오류말["name-dup"].replace("<slug>", 결과.겹침 ?? "")], 값, n: prev.n + 1, 겹침: 결과.겹침 };
    return { 오류: [오류말[결과.err] ?? "저장 안 됨"], 값, n: prev.n + 1 };
  }
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${결과.slug}`);
}

/** 판이 차례로 부르는 한 걸음. 오류 원문은 서버 로그에만 */
export async function autoStep(slug: string): Promise<걸음> {
  await guard();
  const s = 고객slug(slug);
  if (!s) return { 단계: null, 상태: "없음", 말: "고객을 못 찾았습니다" };
  try {
    const r = await 자동한걸음(q, s, { checkPlatform, detectPlatform, 실패도: false });
    revalidatePath(`/admin/clients/${s}`);
    return r;
  } catch (e) {
    console.error("자동 세팅 한 걸음 실패", s, e);
    return { 단계: null, 상태: "오류", 말: "자동 세팅을 못 돌렸습니다. 잠시 뒤 「다시 시도」를 누릅니다" };
  }
}

/** 「다시 시도」 — 그 단계 시도 0·대기 */
export async function retryAutoStep(form: FormData) {
  await guard();
  const slug = 고객slug(form.get("slug"));
  if (!slug) redirect("/admin/clients");
  await 재시도(q, slug, String(form.get("step") ?? ""));
  revalidatePath(`/admin/clients/${slug}`);
  redirect(`/admin/clients/${slug}`);
}

/** 원장 두 칸(업종·지역) — 업종지역 됨 · 검색어 대기 */
export async function saveAutoFacts(form: FormData) {
  await guard();
  const slug = 고객slug(form.get("slug"));
  if (!slug) redirect("/admin/clients");
  const r = 사실입력검사({ 업종: form.get("category"), 지역: form.get("district") });
  if (!r.ok) redirect(`/admin/clients/${slug}?err=facts`);
  await 사실저장(q, slug, r);
  revalidatePath(`/admin/clients/${slug}`);
  redirect(`/admin/clients/${slug}`);
}
