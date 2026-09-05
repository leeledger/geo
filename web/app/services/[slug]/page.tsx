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

  return (
    <>
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
