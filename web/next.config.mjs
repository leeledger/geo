/** @type {import('next').NextConfig} */
const nextConfig = {
  // 진단은 외부 사이트를 여러 개 받아오므로 서버에서만 돈다
  serverExternalPackages: [],
  // 관리 화면에서 바깥 링크를 눌러도 주소(옛 ?key= 열쇠가 붙었을 수 있다)가 리퍼러로 새지 않게
  /**
   * 옛 주소(geo-rose-nine.vercel.app)는 cited.kr 로 308. 경로·쿼리는 그대로 넘긴다.
   * /api 와 /api/* 는 넘기지 않는다 — 스크립트·Actions(LLM_PROXY_URL)·문의 POST 가 옛 주소를 박아 쓴다.
   * 목적지는 SITE_URL 이 아니라 리터럴이다. 옛 호스트 하나만 다루고, env 가 틀려도 루프가 안 생긴다.
   * 미리보기 배포(geo-*.vercel.app)는 호스트가 달라 안 걸린다.
   */
  async redirects() {
    const old = [{ type: "host", value: "geo-rose-nine.vercel.app" }];
    return [
      { source: "/", has: old, destination: "https://cited.kr/", permanent: true },
      { source: "/:path((?!api(?:/|$)).+)", has: old, destination: "https://cited.kr/:path", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/admin/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/admin", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};
export default nextConfig;
