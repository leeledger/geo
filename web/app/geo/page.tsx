import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import SiteNav from "../SiteNav";

/**
 * 가이드 목록.
 *
 * 경쟁사 한 곳을 뜯어보니 랜딩이 아니라 이런 페이지들이 검색어를 먹고 있었다.
 * 페이지 수가 40 대 7 이었다. 랜딩에 문구를 더 넣는 걸로는 그 자리에 못 간다.
 */

export const metadata: Metadata = {
  title: "GEO 가이드 — Cited 사이티드",
  description:
    "AI 답변에 회사 이름이 나오게 하는 일에 대해, 저희가 직접 재 본 것만 적었습니다. SEO 와의 차이, 대행사 고르는 기준, 비용, 측정 방법, 시작 순서.",
};

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://geo-rose-nine.vercel.app";

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${base}/geo#page`,
      name: "GEO 가이드",
      url: `${base}/geo`,
      inLanguage: "ko",
      isPartOf: { "@id": `${base}/#org` },
    },
    {
      "@type": "ItemList",
      itemListElement: GUIDES.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
        url: `${base}/geo/${g.slug}`,
      })),
    },
  ],
};

export default function GuideIndex() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <SiteNav />
      <header className="hero simple">
        <div className="wrap">
          <div className="lab">GEO 가이드</div>
          <h1>직접 재 본 것만 적었습니다</h1>
          <p className="lede">
            남의 시장 전망이나 출처를 확인하지 못한 통계는 싣지 않았습니다.
            여기 있는 숫자는 저희가 홈페이지 34곳을 진단하고 한 업계에 질문을 15회씩 던져 얻은 값,
            그리고 첫 레퍼런스의 서버 기록입니다. 표본이 작은 값은 작다고 적었습니다.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap narrow">
          <div className="does">
            {GUIDES.map((g) => (
              <div className="do" key={g.slug}>
                <span className="mono dn">{g.no}</span>
                <div>
                  <b>
                    <Link href={`/geo/${g.slug}`} style={{ color: "inherit" }}>
                      {g.title}
                    </Link>
                  </b>
                  <p>{g.short}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="svcnav">
            <Link className="btn" href="/#start">무료 진단 받기</Link>
            <Link className="btn ghost" href="/services">서비스 보기 →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
