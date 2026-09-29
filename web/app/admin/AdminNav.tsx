import Link from "next/link";

/** 관리 화면 이동 줄. 지금 페이지를 표시한다. 로그인 화면엔 안 넣는다 */
const PAGES = [
  { href: "/admin/ops", name: "현황" },
  { href: "/admin/asks", name: "AI 질문 기록" },
  { href: "/admin/drafts", name: "초안" },
  { href: "/admin/material", name: "재료" },
  { href: "/admin/inquiry", name: "문의" },
  { href: "/admin", name: "리드" },
  { href: "/admin/outreach", name: "영업판" },
  { href: "/admin/pilots", name: "파일럿" },
] as const;

export type AdminPage = (typeof PAGES)[number]["href"];

export default function AdminNav({ here }: { here: AdminPage }) {
  return (
    <nav className="adm-nav" aria-label="관리 화면">
      {PAGES.map((p) => (
        <Link key={p.href} href={p.href} aria-current={p.href === here ? "page" : undefined}>{p.name}</Link>
      ))}
    </nav>
  );
}
