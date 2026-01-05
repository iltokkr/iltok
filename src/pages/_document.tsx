import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* Google Fonts - 부드러운 한글 폰트 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap" rel="stylesheet" />
        
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
