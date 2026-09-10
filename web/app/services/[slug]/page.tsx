import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SERVICES, byslug } from "@/lib/services";
import SiteNav from "../../SiteNav";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = byslug(slug);
  if (!s) return { title: "서비스 — Cited" };
  return { title: `${s.name} — Cited 사이티드`, description: s.short };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const s = byslug(slug);
  if (!s) notFound();
  const i = SERVICES.findIndex((x) => x.slug === slug);
  const next = SERVICES[(i + 1) % SERVICES.length];

  /* 스키마가 홈에만 있어서 진단 점수가 36 이었다. 서비스 페이지에도 붙인다.
     이 서비스가 답하는 고객 질문을 Question 으로 넣는다 — 그게 AI 가 잡는 자리다. */
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${base}/services/${s.slug}#service`,
        name: s.name,
        description: s.short,
        url: `${base}/services/${s.slug}`,
        areaServed: "KR",
        provider: {
          "@type": "Organization",
          "@id": `${base}/#org`,
          name: "Cited 사이티드",
          url: base,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cited 사이티드", item: base },
          { "@type": "ListItem", position: 2, name: "서비스", item: `${base}/services` },
          { "@type": "ListItem", position: 3, name: s.name },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${base}/services/${s.slug}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: s.question,
            acceptedAnswer: { "@type": "Answer", text: s.lede },
          },
          ...s.does.map((d) => ({
            "@type": "Question" as const,
            name: d.t,
            acceptedAnswer: { "@type": "Answer" as const, text: d.d },
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
            <Link href="/services" style={{ color: "inherit" }}>서비스</Link> · {s.no}
          </div>
          <h1>{s.name}</h1>
          <p className="lede">{s.lede}</p>
          <div className="svcask">{s.question}</div>
        </div>
      </header>

      {/* 잘라서 인용할 수 있는 설명. 짧은 조각만 있으면 AI 가 가져갈 덩어리가 없다. */}
      <section className="svc-prose">
        <div className="wrap">
          {s.prose.map((t) => <p key={t.slice(0, 12)}>{t}</p>)}
        </div>
      </section>

      <section>
        <div className="wrap narrow">
          <div className="lab">하는 일</div>
          <div className="does">
            {s.does.map((d, n) => (
              <div className="do" key={d.t}>
                <span className="mono dn">{String(n + 1).padStart(2, "0")}</span>
                <div>
                  <b>{d.t}</b>
                  <p>{d.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="deep">
        <div className="wrap narrow">
          <div className="lab">받으시는 것</div>
          <ul className="gives">
            {s.gives.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </div>
      </section>

      <section>
        <div className="wrap narrow">
          <div className="lab">한계</div>
          <h2>이건 못 합니다</h2>
          <ul className="limits">
            {s.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>

          <div className="terms">
            {s.terms.map((t) => (
              <div className="term" key={t.k}>
                <span className="tk mono">{t.k}</span>
                <span className="tv">{t.v}</span>
              </div>
            ))}
          </div>

          <div className="svcnav">
            <Link className="btn" href="/#price">요금 보기</Link>
            <Link className="btn ghost" href={`/services/${next.slug}`}>
              다음 · {next.name} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
