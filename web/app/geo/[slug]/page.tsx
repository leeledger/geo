import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GUIDES, byGuide } from "@/lib/guides";
import SiteNav from "../../SiteNav";

/**
 * 가이드 상세.
 *
 * 골격은 서비스 페이지와 같게 둔다. 새 CSS 를 만들면 한쪽이 반드시 낡는다.
 * 스키마는 Article + BreadcrumbList + FAQPage 셋을 붙인다 —
 * AI 가 잡아 가는 자리가 FAQ 라서 화면의 질문과 같은 배열을 그대로 넘긴다.
 */

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = byGuide(slug);
  if (!g) return { title: "가이드 — Cited" };
  return { title: `${g.title} — Cited 사이티드`, description: g.short };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const g = byGuide(slug);
  if (!g) notFound();
  const i = GUIDES.findIndex((x) => x.slug === slug);
  const next = GUIDES[(i + 1) % GUIDES.length];

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";
  const url = `${base}/geo/${g.slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: g.title,
        description: g.short,
        url,
        inLanguage: "ko",
        author: { "@type": "Organization", "@id": `${base}/#org`, name: "Cited 사이티드" },
        publisher: { "@id": `${base}/#org` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cited 사이티드", item: base },
          { "@type": "ListItem", position: 2, name: "GEO 가이드", item: `${base}/geo` },
          { "@type": "ListItem", position: 3, name: g.title },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: g.question.replace(/[“”"]/g, ""),
            acceptedAnswer: { "@type": "Answer", text: g.lede },
          },
          ...g.faq.map(([q, a]) => ({
            "@type": "Question" as const,
            name: q,
            acceptedAnswer: { "@type": "Answer" as const, text: a },
          })),
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <SiteNav />
      <header className="hero simple">
        <div className="wrap">
          <div className="lab">
            <Link href="/geo" style={{ color: "inherit" }}>GEO 가이드</Link> · {g.no}
          </div>
          <h1>{g.title}</h1>
          <p className="lede">{g.lede}</p>
          <div className="svcask">{g.question}</div>
        </div>
      </header>

      {/* 잘라서 인용할 수 있는 길이의 문단만 싣는다. 짧은 조각은 AI 가 가져갈 덩어리가 안 된다. */}
      <section className="svc-prose">
        <div className="wrap">
          {g.prose.map((t) => <p key={t.slice(0, 12)}>{t}</p>)}
        </div>
      </section>

      {g.steps.length > 0 && (
        <section>
          <div className="wrap narrow">
            <div className="lab">순서</div>
            <div className="does">
              {g.steps.map((s, n) => (
                <div className="do" key={s.t}>
                  <span className="mono dn">{String(n + 1).padStart(2, "0")}</span>
                  <div>
                    <b>{s.t}</b>
                    <p>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 남의 시장 통계를 옮기지 않는다. 여기 숫자는 전부 우리가 직접 잰 것이고 표본을 같이 적는다. */}
      <section className="deep">
        <div className="wrap narrow">
          <div className="lab">직접 잰 숫자</div>
          {/* .do 를 쓰면 어두운 배경에서 제목이 안 보이고 배지가 두 줄로 깨진다. 전용 .fact 를 쓴다. */}
          <div className="gfacts">
            {g.facts.map((f) => (
              <div className="gfact" key={f.k + f.v}>
                <span className="mono gfv">{f.v}</span>
                <div>
                  <b>{f.k}</b>
                  <p>{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap narrow">
          <div className="lab">한계</div>
          <h2>이 글로 답할 수 없는 것</h2>
          <ul className="limits">
            {g.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>

          <div className="lab" style={{ marginTop: 40 }}>자주 묻는 것</div>
          <div className="does">
            {g.faq.map(([q, a]) => (
              <div className="do" key={q}>
                <span className="mono dn">Q</span>
                <div>
                  <b>{q}</b>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="svcnav">
            <Link className="btn" href="/#start">무료 진단 받기</Link>
            <Link className="btn ghost" href={`/geo/${next.slug}`}>
              다음 · {next.title} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
