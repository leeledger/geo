import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import schema from "@/content/schema.json";
import { listPosts } from "@/lib/posts";
import HomeScript from "@/components/HomeScript";

/**
 * 홈은 기존 정적 HTML 을 그대로 내보낸다.
 *
 * 왜 JSX 로 옮기지 않는가: 이 마크업은 AI 노출 측정에서 높은 점수를 받은 결과물이다.
 * 손으로 옮기면 태그가 미묘하게 달라지고 점수가 흔들린다. 빌드 시점에 파일을 읽어
 * 그대로 심으면 출력 HTML 이 한 글자도 바뀌지 않는다.
 *
 * 다만 최근 글 목록만은 서버에서 붙인다. 홈에서 개별 글로 가는 링크가 없으면
 * 크롤러가 목록 페이지를 거쳐야 글에 닿는다. 홈은 가장 자주 크롤되는 페이지라,
 * 여기 링크가 있으면 새 글이 훨씬 빨리 발견된다.
 */
const RAW = fs.readFileSync(
  path.join(process.cwd(), "content", "home.html"),
  "utf8",
);

const CUT = RAW.lastIndexOf("<footer>");
const HOME_TOP = CUT > 0 ? RAW.slice(0, CUT) : RAW;
const HOME_BOTTOM = CUT > 0 ? RAW.slice(CUT) : "";

/* innerHTML 로 들어간 <script> 는 클라이언트 이동 때 안 돈다. 본문만 떼어 HomeScript 가 돌린다. */
const HOME_JS = RAW.match(/<script>([\s\S]*?)<\/script>\s*$/)?.[1] ?? "";

export const revalidate = 900;

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

export default async function Home() {
  const posts = await listPosts(6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div dangerouslySetInnerHTML={{ __html: HOME_TOP }} />

      {posts.length > 0 && (
        <section id="journal" className="paper">
          <div className="wrap">
            <div className="lab">Journal</div>
            <h2>수업에서 있었던 일</h2>
            <p className="lead">
              아이가 무엇에 막혔고 어떻게 넘었는지, 어떤 작품이 나왔는지 적습니다.
              홍보 문구보다 실제 기록이 학원을 더 정확하게 설명한다고 생각합니다.
            </p>
            <div className="postlist">
              {posts.map((p) => (
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
            <p className="note" style={{ marginTop: 24 }}>
              <Link href="/blog" style={{ color: "#B5760A", fontWeight: 700 }}>
                수업 기록 전체 보기 →
              </Link>
            </p>
          </div>
        </section>
      )}

      {HOME_BOTTOM && <div dangerouslySetInnerHTML={{ __html: HOME_BOTTOM }} />}
      <HomeScript code={HOME_JS} />
    </>
  );
}
