const withPWA = require('next-pwa')({
  dest: 'public',
  //disable: process.env.NODE_ENV === 'development'
  disable: false
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
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
  }
}

module.exports = withPWA(nextConfig)
