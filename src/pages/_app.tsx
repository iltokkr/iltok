import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { AuthProvider } from '@/providers/AuthProvider'
import Head from 'next/head'
import Script from 'next/script'
import { TranslationProvider } from '@/contexts/TranslationContext'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

const GA_MEASUREMENT_ID = 'G-RT5E0QKYVV';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // 브라우저 스크롤 복원 비활성화 (수동 관리)
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // 상세페이지(/jd/) 진입 시 스크롤 맨 위로
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // 상세페이지 진입 완료 시 스크롤 맨 위로
      if (url.startsWith('/jd/')) {
        window.scrollTo(0, 0);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <TranslationProvider>
      <AuthProvider>
        <Head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
          <meta httpEquiv="Pragma" content="no-cache" />
          <meta httpEquiv="Expires" content="0" />
          
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
        
          <Script async src="https://www.googletagmanager.com/gtag/js?id=AW-16758883524" />
          <Script id="google-tag" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'AW-16758883524');
            `}
          </Script>

          <meta name="google-adsense-account" content="ca-pub-5358954637109366"></meta>
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

        {/* 네이버 애널리틱스 */}
        <Script src="//wcs.naver.net/wcslog.js" strategy="afterInteractive" />
        <Script id="naver-analytics" strategy="afterInteractive">
          {`
            if(!wcs_add) var wcs_add = {};
            wcs_add["wa"] = "13f96843ef89820";
            if(window.wcs) {
              wcs_do();
            }
          `}
        </Script>

        <Component {...pageProps} />
      </AuthProvider>
    </TranslationProvider>
  )
}

export default MyApp
