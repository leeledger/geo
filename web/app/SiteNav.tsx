import Link from "next/link";

/** 랜딩과 서비스 페이지가 같은 네비를 쓴다. 갈라지면 반드시 한쪽이 낡는다. */
export default function SiteNav() {
  return (
    <nav>
      <div className="wrap">
        <Link className="logo" href="/">
          <span className="mk" aria-hidden="true">[ ]</span>Cited<em>사이티드</em>
        </Link>
        <span className="links">
          <Link href="/#geo">GEO란</Link>
          <Link href="/services">서비스</Link>
          <Link href="/#how">진행</Link>
          <Link href="/#case">도입 사례</Link>
          <Link href="/#price">요금</Link>
          <Link href="/#faq">자주 묻는 것</Link>
        </span>
        <Link className="navcta" href="/#start">무료 진단</Link>
      </div>
    </nav>
  );
}
