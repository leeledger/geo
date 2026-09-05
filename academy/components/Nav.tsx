import Link from "next/link";

/** 홈·블로그가 같은 네비를 쓴다. 링크 목록이 갈라지면 반드시 한쪽이 낡는다. */
const LINKS = [
  { href: "/#why", label: "교육 철학" },
  { href: "/#curriculum", label: "커리큘럼" },
  { href: "/#ai", label: "AI 리터러시" },
  { href: "/#tutor", label: "학습 프로그램" },
  { href: "/#principal", label: "원장 소개" },
  { href: "/blog", label: "수업 기록" },
  { href: "/#contact", label: "상담" },
  { href: "/#location", label: "오시는 길" },
];

export default function Nav() {
  return (
    <nav id="nav">
      <input type="checkbox" id="navtoggle" className="navtoggle" hidden />
      <div className="wrap">
        <Link className="brand" href="/" aria-label="로봇·코딩학원 홈">
          <span className="lk" aria-hidden="true">
            <i className="br" /><b>로봇</b><i className="pd" /><b>코딩</b><i className="br r" />
          </span>
            <span className="aib" aria-hidden="true">AI</span>
        </Link>
        <div className="navlinks">
          {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <a className="mtel" href="tel:02-422-0525">전화 02-422-0525</a>
        </div>
        <a className="navtel mono" href="tel:02-422-0525">02-422-0525</a>
        <label htmlFor="navtoggle" className="burger" aria-label="메뉴 열기">
          <span /><span /><span />
        </label>
      </div>
    </nav>
  );
}
