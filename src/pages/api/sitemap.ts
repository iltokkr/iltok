import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // XML 헤더 설정
    res.setHeader('Content-Type', 'application/xml')

    // 기본 URL 설정
    const baseUrl = 'https://114114kr.com'

    // sitemap XML 생성
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${baseUrl}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>${baseUrl}/board</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>0.8</priority>
      </url>
      <url>
        <loc>${baseUrl}/privacy-policy</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>0.5</priority>
      </url>
    </urlset>`

    // XML 응답 전송
    res.write(xml)
    res.end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error generating sitemap' })
  }
}
