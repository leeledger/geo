import Link from "next/link";

/**
 * 랜딩과 서비스 페이지가 같은 네비를 쓴다. 갈라지면 반드시 한쪽이 낡는다.
 * 랜딩은 히어로가 어두워서 네비도 어둡게 붙인다(tone="deep"). 링크는 같다.
 */
export default function SiteNav({ tone }: { tone?: "deep" }) {
  return (
    <nav className={tone === "deep" ? "lp-nav" : undefined}>
      <div className="wrap">
        <Link className="logo" href="/">
          <span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em>
        </Link>
        <span className="links">
          <Link href="/#geo">GEO란</Link>
          <Link href="/services">서비스</Link>
          <Link href="/#price">요금</Link>
          <Link href="/#how">진행</Link>
          <Link href="/#case">도입 사례</Link>
          <Link href="/#faq">자주 묻는 것</Link>
        </span>
        <Link className="navcta" href="/#start">무료 진단</Link>
      </div>
    </nav>
  );
}
