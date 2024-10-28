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
        <title>당신의 회사 이름</title>
        <meta name="deeplehr" content="조선동포 전문 채용플랫폼" />
        {/* PWA 관련 메타 태그 추가 */}
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="당신의 회사 이름" />
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
