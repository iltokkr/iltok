import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { AuthProvider } from '@/providers/AuthProvider'
import Head from 'next/head'
import Script from 'next/script'

const GA_MEASUREMENT_ID = 'G-RT5E0QKYVV';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <meta charSet="utf-8" />
        <title>114114KR - 조선동포 및 교포 구인구직 서비스</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* SEO 메타 태그 */}
        <meta name="author" content="114114KR" />
        <meta name="description" content="114114KR은 조선동포와 교포를 위한 구인구직 플랫폼입니다. 아르바이트부터 정규직까지 다양한 일자리 정보를 제공합니다." />
        <meta name="keywords" content="114114, 114114코리아, 114114korea, 114114kr, 114114구인구직, 조선동포, 교포, 재외동포, 해외교포, 동포 구인구직, 일자리 정보" />
        
        {/* Open Graph 태그 */}
        <meta property="og:title" content="114114KR - 조선동포 및 교포 구인구직 서비스" />
        <meta property="og:description" content="114114KR은 조선동포와 교포를 위한 구인구직 플랫폼입니다. 아르바이트부터 정규직까지 다양한 일자리 정보를 제공합니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114kr.com" />
        <meta property="og:image" content="/icons/icon-192x192.png" />
        
        {/* PWA 관련 메타 태그 */}
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="114114KR" />
        
        {/* 네이버 사이트 인증 */}
        <meta name="naver-site-verification" content="2664c9542e7774437c1d026345f3ef09733c9ae5" />
      </Head>

      {/* Google Analytics */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>

      <Component {...pageProps} />
    </AuthProvider>
  )
}

export default MyApp
