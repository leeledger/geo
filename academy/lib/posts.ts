import { q, dbEnabled } from "./db";

export type Post = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  tags: string[];
  published_at: string | null;
  updated_at: string;
  source_url: string | null;
};

const LIST_COLS =
  "id, slug, title, summary, category, tags, published_at, updated_at, source_url";

export async function listPosts(limit = 50): Promise<Omit<Post, "body">[]> {
  if (!dbEnabled) return [];
  return q<Omit<Post, "body">>(
    `select ${LIST_COLS} from academy.published_posts
      order by published_at desc limit $1`,
    [limit],
  );
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!dbEnabled) return null;
  const rows = await q<Post>(
    `select ${LIST_COLS}, body from academy.published_posts where slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function listSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  if (!dbEnabled) return [];
  return q(`select slug, updated_at from academy.published_posts`);
}

export async function listCategories(): Promise<{ category: string; n: number }[]> {
  if (!dbEnabled) return [];
  return q(
    `select category, count(*)::int as n from academy.published_posts
      group by category order by n desc`,
  );
}
