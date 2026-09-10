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
          <Link href="/services">서비스</Link>
          <Link href="/#why">받는 것</Link>
          <Link href="/#how">진행</Link>
          <Link href="/#case">케이스</Link>
          <Link href="/#nots">하지 않는 일</Link>
          <Link href="/#price">요금</Link>
        </span>
      </div>
    </nav>
  );
}
