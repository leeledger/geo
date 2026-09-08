import Link from "next/link";
import Nav from "@/components/Nav";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPost, listSlugs, listPosts } from "@/lib/posts";
import { renderMarkdown, excerpt } from "@/lib/md";

export const revalidate = 300;

export async function generateStaticParams() {
  const rows = await listSlugs();
  return rows.map((r) => ({ slug: r.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "찾을 수 없는 글" };
  const desc = post.summary || excerpt(post.body);
  return {
    title: post.title,
    description: desc,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: desc,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
    },
  };
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.body);
  const desc = post.summary || excerpt(post.body);
  const others = (await listPosts(8)).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BlogPosting",
                "@id": `https://robotncoding.com/blog/${post.slug}#post`,
                headline: post.title,
                description: desc,
                articleBody: post.body.slice(0, 5000),
                datePublished: post.published_at,
                dateModified: post.updated_at,
                inLanguage: "ko-KR",
                keywords: post.tags.join(", "),
                articleSection: post.category,
                mainEntityOfPage: `https://robotncoding.com/blog/${post.slug}`,
                author: { "@id": "https://robotncoding.com/#principal" },
                publisher: { "@id": "https://robotncoding.com/#org" },
                isPartOf: { "@id": "https://robotncoding.com/blog#blog" },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "로봇&코딩학원", item: "https://robotncoding.com/" },
                  { "@type": "ListItem", position: 2, name: "수업 기록", item: "https://robotncoding.com/blog" },
                  { "@type": "ListItem", position: 3, name: post.title },
                ],
              },
            ],
          }),
        }}
      />

      <Nav />

      <article className="post">
        <div className="wrap">
          <div className="pmeta mono">
            <Link href="/blog" className="pcat">{post.category}</Link>
            <time dateTime={post.published_at ?? undefined}>{fmt(post.published_at)}</time>
          </div>
          <h1>{post.title}</h1>
          {desc && <p className="psum">{desc}</p>}
          <div className="pbody" dangerouslySetInnerHTML={{ __html: html }} />

          {post.tags.length > 0 && (
            <div className="ptags mono">
              {post.tags.map((t) => <span key={t}>#{t}</span>)}
            </div>
          )}
          {post.source_url && (
            <p className="psrc mono">
              이 글은 <a href={post.source_url} rel="noopener">네이버 블로그</a>에 먼저 올렸던 글을 옮긴 것입니다.
            </p>
          )}

          {/* 글마다 본문에 넣지 않고 여기 한 곳에 둔다.
              본문에 넣으면 41편을 각각 고쳐야 하고, 나중에 번호가 바뀌면 반드시 어긋난다. */}
          <div className="pcta">
            <p>
              로봇&amp;코딩학원은 서울 송파구 석촌동 274-8 2층에 있습니다.
              궁금한 것은 전화나 카카오톡으로 물어보셔도 됩니다.
            </p>
            <div className="pctab">
              <a className="btn primary" href="tel:02-422-0525">상담 전화 02-422-0525</a>
              <a
                className="btn kakao"
                href="http://pf.kakao.com/_Bxhxbxjxb/chat"
                target="_blank"
                rel="noopener"
              >
                카카오톡으로 상담하기
              </a>
            </div>
          </div>
        </div>
      </article>

      {others.length > 0 && (
        <section className="paper">
          <div className="wrap">
            <div className="lab">More</div>
            <h2>다른 기록</h2>
            <div className="postlist">
              {others.map((p) => (
                <article className="pcard" key={p.slug}>
                  <Link href={`/blog/${p.slug}`}>
                    <div className="pmeta mono">
                      <span className="pcat">{p.category}</span>
                      <time dateTime={p.published_at ?? undefined}>{fmt(p.published_at)}</time>
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.summary}</p>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer>
        <div className="wrap">
          <p className="mono">
            로봇&amp;코딩학원 · 서울특별시 송파구 석촌동 274-8 2층 ·{" "}
            <a href="tel:02-422-0525">02-422-0525</a>
          </p>
        </div>
      </footer>
    </>
  );
}
