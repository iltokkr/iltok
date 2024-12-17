import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5358954637109366"
          crossOrigin="anonymous"
        />

        {/* 네이버 애널리틱스 */}
        <script src="//wcs.naver.net/wcslog.js" />
        <script id="naver-analytics">
          {`
            if(!wcs_add) var wcs_add = {};
            wcs_add["wa"] = "13f96843ef89820";
            if(window.wcs) {
              wcs_do();
            }
          `}
        </script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
