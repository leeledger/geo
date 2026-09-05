/** @type {import('next').NextConfig} */
export default {
  // AI 크롤러가 JS 없이 본문을 읽어야 한다 — 모든 페이지를 서버에서 완성해 내보낸다.
  poweredByHeader: false,
  compress: true,
};
