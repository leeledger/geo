"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { inqPool } from "./inquiries";
import { CODE_SLUGS, 고치기, 등록, 오류말, 입력검사, 점검저장, 지우기 } from "./client-core.mjs";

/**
 * 고객사 등록·고치기·다시 점검·GSC 권한 받음·지우기 (Step 38). 계산·SQL 은 client-core.mjs — 회사 루프·시험과 같은 함수.
 * 서버 동작은 동작 번호만 알면 누구나 부를 수 있다 — 화면과 별개로 여기서 관리자를 다시 본다(pilot-actions 와 같은 guard).
 * 점검은 한 주소 8초·전체 20초. 이 화면 page.tsx 의 maxDuration 60 안에 든다(node_modules/next/dist/docs … maxDuration「Server Actions」).
 */
async function guard() {
  if (!(await isAdmin())) throw new Error("관리자만 할 수 있습니다");
}

/** 한 연결에 묶은 q — 등록·지우기가 그 위에서 begin/commit 한다 */
async function 연결<T>(fn: (q: (s: string, p?: unknown[]) => Promise<any[]>) => Promise<T>): Promise<T> {
  const db = await inqPool().connect();
  try {
    return await fn((s, p = []) => db.query(s, p).then((r) => r.rows));
  } finally {
    db.release();
  }
}
const q = (s: string, p: unknown[] = []) => inqPool().query(s, p).then((r) => r.rows);
const 행 = async (slug: string) => (await q(`select to_jsonb(c) as r from geo.clients c where slug = $1`, [slug]))[0]?.r ?? null;

/** 점검 — 실패해도 저장은 남는다. 실패면 false(화면이 「다음 매시에 다시」를 띄운다). 오류 원문은 서버 로그에만 */
async function 점검(slug: string): Promise<boolean> {
  try {
    const row = await 행(slug);
    if (!row) return false;
    await 점검저장(q, row);
    return true;
  } catch (e) {
    console.error("세팅 점검 실패", slug, e);
    return false;
  }
}

export type FormState = { 오류: string[]; 값: Record<string, string>; n: number };

// 「$ACTION_…」 은 Next 가 넣는 칸 — 돌려줄 값에서 뺀다
const 폼글자 = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

/** 등록 폼(useActionState). 입력 오류·거부는 화면에 그대로, 값은 돌려줘 다시 치지 않게 */
export async function registerClient(prev: FormState, form: FormData): Promise<FormState> {
  await guard();
  const 값 = 폼글자(form);
  const r = 입력검사(값);
  if (!r.ok) return { 오류: r.오류, 값, n: prev.n + 1 };
  const 결과 = await 연결((dq) => 등록(dq, r.칸));
  if (!결과.ok) return { 오류: [오류말[결과.err] ?? "저장 안 됨"], 값, n: prev.n + 1 };
  const ok = await 점검(결과.slug);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${결과.slug}${ok ? "" : "?err=check"}`);
}

/** 고치기 폼. slug 는 바꾸지 않는다. 도메인이 바뀌면 바로 다시 점검 */
export async function updateClient(prev: FormState, form: FormData): Promise<FormState> {
  await guard();
  const 값 = 폼글자(form);
  const slug = String(form.get("slug_fixed") ?? "");
  const r = 입력검사({ ...값, slug });
  if (!r.ok) return { 오류: r.오류, 값, n: prev.n + 1 };
  const 결과 = await 고치기(q, slug, r.칸);
  if (!결과.ok) return { 오류: [오류말[결과.err] ?? "저장 안 됨"], 값, n: prev.n + 1 };
  const ok = 결과.도메인바뀜 ? await 점검(slug) : true;
  revalidatePath(`/admin/clients/${slug}`);
  redirect(`/admin/clients/${slug}?${ok ? "saved=1" : "err=check"}`);
}

const 고객slug = (form: FormData) => {
  const slug = String(form.get("slug") ?? "");
  return /^[a-z0-9-]{1,40}$/.test(slug) && !CODE_SLUGS.includes(slug) ? slug : null;
};

export async function recheckClient(form: FormData) {
  await guard();
  const slug = 고객slug(form);
  if (!slug) redirect("/admin/clients");
  const ok = await 점검(slug);
  revalidatePath(`/admin/clients/${slug}`);
  redirect(`/admin/clients/${slug}${ok ? "?checked=1" : "?err=check"}`);
}

/**
 * 「구글 서치콘솔 권한 받음」 — 원장 말을 믿는 임시 길(Step 39 탐침이 화면 원문으로 확인한다).
 * config.gsc = true 면 원장 PC 의 submit-gsc 가 이 고객도 돈다. 실패는 그쪽 활동 줄에 보인다
 */
export async function markGscGranted(form: FormData) {
  await guard();
  const slug = 고객slug(form);
  if (!slug) redirect("/admin/clients");
  await q(`update geo.clients set config = jsonb_set(coalesce(config, '{}'::jsonb), '{gsc}', 'true'::jsonb) where slug = $1`, [slug]);
  revalidatePath(`/admin/clients/${slug}`);
  redirect(`/admin/clients/${slug}`);
}

/** 시험 고객만. client-core 지우기 가 status 를 서버에서 다시 보고, 한 tx 에서 남은 행 0 을 확인한다 */
export async function deleteTestClient(form: FormData) {
  await guard();
  const slug = 고객slug(form);
  if (!slug) redirect("/admin/clients");
  const r = await 연결((dq) => 지우기(dq, slug));
  if (!r.ok) redirect(`/admin/clients/${slug}?err=${r.err}`);
  revalidatePath("/admin/clients");
  redirect("/admin/clients?deleted=1");
}
