import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { q, dbEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 관리자 확인.
 *
 * 아이디와 비밀번호를 같이 본다. ADMIN_ID 를 안 정해 두면 비밀번호만 본다 —
 * 스크립트(naver-blog-post.mjs 등)가 헤더 하나로 부르고 있어서, 아이디를 필수로
 * 만들면 그것들이 전부 401 을 맞는다.
 */
function authed(req: Request) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;                        // 설정 전에는 아무도 못 쓴다
  if (req.headers.get("x-admin-pw") !== pw) return false;

  const id = process.env.ADMIN_ID;
  if (!id) return true;                         // 아이디를 안 쓰면 비번만으로 통과
  return req.headers.get("x-admin-id") === id;
}

/** 틀렸을 때 잠깐 멈춘다. 초당 수천 번 두드리는 걸 막는 최소한이다. */
const deny = async () => {
  await new Promise((r) => setTimeout(r, 700));
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
};

const slugify = (s: string) =>
  s.trim().toLowerCase()
    .replace(/[^\w가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || `post-${Date.now()}`;

export async function GET(req: Request) {
  if (!authed(req)) return deny();
  if (!dbEnabled) return NextResponse.json({ error: "DATABASE_URL 이 설정되지 않았습니다." }, { status: 500 });

  // ?slug= 이면 본문까지 한 건만 — 수정 화면이 쓴다
  const one = new URL(req.url).searchParams.get("slug");
  if (one) {
    const r = await q(`select * from academy.posts where slug = $1`, [one]);
    return NextResponse.json({ post: r[0] ?? null });
  }

  const rows = await q(
    `select id, slug, title, summary, category, tags, published, published_at, updated_at, source_url
       from academy.posts order by coalesce(published_at, created_at) desc limit 200`,
  );
  return NextResponse.json({ posts: rows });
}

export async function POST(req: Request) {
  if (!authed(req)) return deny();
  if (!dbEnabled) return NextResponse.json({ error: "DATABASE_URL 이 설정되지 않았습니다." }, { status: 500 });

  const b = await req.json().catch(() => null);
  if (!b?.title || !b?.body) {
    return NextResponse.json({ error: "제목과 본문은 비울 수 없습니다." }, { status: 400 });
  }

  const slug = (b.slug?.trim() || slugify(b.title));
  const tags: string[] = Array.isArray(b.tags)
    ? b.tags
    : String(b.tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean);
  const published = Boolean(b.published);

  const rows = await q<{ slug: string }>(
    `insert into academy.posts
       (slug, title, summary, body, category, tags, published, published_at, source_url, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7, case when $7 then coalesce($8::timestamptz, now()) else null end, $9, now())
     on conflict (slug) do update set
       title = excluded.title,
       summary = excluded.summary,
       body = excluded.body,
       category = excluded.category,
       tags = excluded.tags,
       published = excluded.published,
       published_at = case
         when excluded.published then coalesce(academy.posts.published_at, excluded.published_at, now())
         else null end,
       source_url = excluded.source_url,
       updated_at = now()
     returning slug`,
    [slug, b.title, b.summary ?? "", b.body, b.category || "수업기록", tags,
     published, b.published_at || null, b.source_url || null],
  );

  const saved = rows[0]?.slug ?? slug;
  revalidatePath("/blog");
  revalidatePath(`/blog/${saved}`);
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true, slug: saved });
}

export async function DELETE(req: Request) {
  if (!authed(req)) return deny();
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug 가 필요합니다." }, { status: 400 });
  await q(`delete from academy.posts where slug = $1`, [slug]);
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true });
}
