import type { ReactNode } from "react";

import "./admin.css";

/** 관리 화면 공통 CSS 만 붙인다 (agent-board.css 선례). 배치는 각 페이지가 한다 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
