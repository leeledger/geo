/** @type {import('next').NextConfig} */
const nextConfig = {
  // 진단은 외부 사이트를 여러 개 받아오므로 서버에서만 돈다
  serverExternalPackages: [],
  // 관리 화면에서 바깥 링크를 눌러도 주소(옛 ?key= 열쇠가 붙었을 수 있다)가 리퍼러로 새지 않게
  async headers() {
    return [
      { source: "/admin/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/admin", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};
export default nextConfig;
