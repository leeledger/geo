import Link from "next/link";
import Nav from "@/components/Nav";
import type { Metadata } from "next";
import { listPosts, listCategories } from "@/lib/posts";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "수업 기록과 학습 이야기",
  description:
    "로봇&코딩학원의 수업 기록, 학생 작품, 대회 준비 과정, 코딩 교육에 대한 생각을 남깁니다. 서울 송파구 석촌동 코딩·로봇·AI 교육 학원.",
  alternates: { canonical: "/blog" },
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

export default async function BlogIndex() {
  const [posts, cats] = await Promise.all([listPosts(60), listCategories()]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": "https://robotncoding.com/blog#blog",
            name: "로봇&코딩학원 수업 기록",
            description:
              "서울 송파구 석촌동 로봇&코딩학원의 수업 기록과 코딩 교육에 대한 글.",
            url: "https://robotncoding.com/blog",
            publisher: { "@id": "https://robotncoding.com/#org" },
            blogPost: posts.map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              description: p.summary,
              url: `https://robotncoding.com/blog/${p.slug}`,
              datePublished: p.published_at,
              dateModified: p.updated_at,
            })),
          }),
        }}
      />

      <Nav />

      <section className="bloghead">
        <div className="wrap">
          <div className="lab">Journal</div>
          <h1>수업에서 있었던 일을 적습니다</h1>
          <p className="lead">
            아이가 무엇에 막혔고 어떻게 넘었는지, 어떤 작품이 나왔는지 남깁니다.
            홍보 문구보다 실제 기록이 학원을 더 정확하게 설명한다고 생각합니다.
          </p>
          {cats.length > 0 && (
            <div className="cats">
              {cats.map((c) => (
                <span key={c.category}>{c.category} <b>{c.n}</b></span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="paper">
        <div className="wrap">
          {posts.length === 0 ? (
            <p className="lead">아직 올라온 글이 없습니다. 곧 수업 기록을 남기겠습니다.</p>
          ) : (
            <div className="postlist">
              {posts.map((p) => (
                <article className="pcard" key={p.slug}>
                  <Link href={`/blog/${p.slug}`}>
                    <div className="pmeta mono">
                      <span className="pcat">{p.category}</span>
                      <time dateTime={p.published_at ?? undefined}>{fmt(p.published_at)}</time>
                    </div>
                    <h2>{p.title}</h2>
                    <p>{p.summary}</p>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

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
