import { q, dbEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 에이전트가 그린 도해를 DB 에서 내보낸다 (Step 12).
 *
 * 학원 사이트는 git push 로 배포되지 않는다. 서버 에이전트가 public/blog 에 SVG 를 만들어도 못 올린다.
 * 글처럼 DB(academy.post_images)에 두면 배포 없이 붙는다. 본문 참조: /blog/img/<slug>/<name>.svg
 *
 * SVG 는 스크립트를 품을 수 있다. 저장 전에 illustrate.mjs 가 걸러도, 여기서 한 번 더 막는다 —
 * CSP 로 스크립트·외부 요청을 전부 끄고 인라인 스타일만 허락한다. sandbox — 주소로 직접 열어도 사이트 출처·쿠키와 떨어진다.
 *
 * 발행된 글의 그림만 내보낸다. 초안 그림은 관리 화면(web /admin/drafts)이 DB 에서 직접 읽어 보여 준다 — 초안 슬러그를 알아도 못 연다.
 * 캐시 1시간(Arch 9/22) — 발행 뒤 그림을 고쳐도 한 시간 안에 바뀐다
 */
const 이름꼴 = /^[a-z0-9][a-z0-9-]{0,79}$/;
const 슬러그꼴 = /^[a-z0-9가-힣][a-z0-9가-힣-]{0,119}$/; // api/posts 의 slugify 가 한글을 남긴다

const 없음 = () => new Response("not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; name: string }> }) {
  const { slug, name: file } = await ctx.params;
  const name = file.replace(/\.svg$/, "");
  if (!file.endsWith(".svg") || !슬러그꼴.test(slug) || !이름꼴.test(name) || !dbEnabled) return 없음();

  let rows: { svg: string }[] = [];
  try {
    rows = await q<{ svg: string }>(`select i.svg from academy.post_images i join academy.posts p on p.slug = i.slug and p.published
       where i.slug=$1 and i.name=$2`, [slug, name]);
  } catch {
    return 없음();
  }
  if (!rows.length) return 없음();

  return new Response(rows[0].svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
