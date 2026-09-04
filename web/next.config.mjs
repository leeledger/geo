/** @type {import('next').NextConfig} */
const nextConfig = {
  // 진단은 외부 사이트를 여러 개 받아오므로 서버에서만 돈다
  serverExternalPackages: [],
};
export default nextConfig;
