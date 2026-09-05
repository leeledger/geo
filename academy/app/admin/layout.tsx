import type { Metadata } from "next";

// 관리 화면은 검색·AI 노출 대상이 아니다
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
