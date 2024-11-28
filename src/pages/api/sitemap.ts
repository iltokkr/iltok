import { NextApiRequest, NextApiResponse } from 'next'
import { SitemapStream, streamToPromise } from 'sitemap'
import { Readable } from 'stream'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // 정적 페이지 목록
    const staticPages = [
      { url: '/', changefreq: 'monthly', priority: 0.5 },
      { url: '/board', changefreq: 'daily', priority: 1 },
      { url: '/my', changefreq: 'daily', priority: 0.5 },
      { url: '/write', changefreq: 'monthly', priority: 0.5 },
    ]

    // 모든 job ID 가져오기
    const { data: jobs, error } = await supabase
      .from('jd')
      .select('id')

    if (error) {
      throw new Error('Error fetching job IDs')
    }

    // Sitemap 스트림 생성
    const stream = new SitemapStream({ hostname: 'https://114114kr.com' })

    res.writeHead(200, {
      'Content-Type': 'application/xml'
    })

    // 정적 페이지 추가
    staticPages.forEach((page) => {
      stream.write(page)
    })

    // 동적 페이지 (JobDetailPage) 추가
    jobs.forEach((job) => {
      stream.write({
        url: `/jd/${job.id}`,
        changefreq: 'daily',
        priority: 1,
      })
    })

    stream.end()

    const xmlString = await streamToPromise(stream).then((data) => data.toString())

    res.end(xmlString)
  } catch (error) {
    console.error('Error generating sitemap:', error)
    res.status(500).end('Error generating sitemap')
  }
}
