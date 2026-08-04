// 검증용 빌드를 dev 서버와 분리하기 위한 스위치.
//   NEXT_DIST_DIR=.next-verify npm run build
// 를 쓰면 빌드 결과가 .next-verify 에 떨어져서, 돌고 있는 dev 서버의 .next 를
// 덮어쓰지 않는다. (예전에는 빌드할 때마다 dev 서버가 죽어서 껐다 켜야 했다)
const verifyDistDir = process.env.NEXT_DIST_DIR;

const withPWA = require('next-pwa')({
  dest: 'public',
  // 검증용 빌드는 public/sw.js 도 건드리지 않게 한다 — 배포용 빌드에서만 생성한다
  disable: process.env.NODE_ENV === 'development' || !!verifyDistDir
  //disable: false
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: verifyDistDir || '.next',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap'
      }
    ]
  },
}

module.exports = withPWA(nextConfig)
