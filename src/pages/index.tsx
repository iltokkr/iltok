// import Head from 'next/head'
// import Link from 'next/link'
// import styles from '../styles/Home.module.css'

// export default function Home() {
//   return (
//     <div className={styles.container}>
//       <Head>
//         <meta charSet="utf-8" />
//         <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
//         <meta httpEquiv="Pragma" content="no-cache" />
//         <meta httpEquiv="Expires" content="0" />
//         <title>114114KR - 조선동포 및 교포 구인구직 서비스</title>
//         <meta name="author" content="114114KR" />
//         <meta name="Keywords" content="114114, 114114코리아, 114114korea, 114114kr, 114114구인구직, 조선동포, 교포, 재외동포, 해외교포, 동포 구인구직, 일자리 정보, 구직자, 구인업체, 경력직 채용, 구인구직, 기업 채용, 단기 알바, 드림 구인구직, 무료 채용 공고, 아르바이트, 알바, 알바 구인구직, 월급, 일당, 주급, 채용 정보, 취업 정보, 직업 정보 제공, 지역별 구인구직, 헤드헌팅 서비스, 신입 채용 공고, 동포 취업, 동포 일자리" />
//         <meta name="Description" content="114114KR은 조선동포와 교포를 위한 구인구직 플랫폼입니다. 아르바이트부터 정규직까지 다양한 일자리 정보를 제공합니다." />
//         <link rel="shortcut icon" href="/favicon.ico" />
//         <meta name="naver-site-verification" content="2664c9542e7774437c1d026345f3ef09733c9ae5" />
//         <meta property="og:title" content="114114KR - 조선동포 및 교포 구인구직 서비스" />
//         <meta property="og:description" content="114114KR은 조선동포와 교포를 위한 구인구직 플랫폼입니다. 아르바이트부터 정규직까지 다양한 일자리 정보를 제공합니다." />
//         <meta property="og:type" content="website" />
//         <meta property="og:url" content="https://114114kr.com" />
//       </Head>
      

//       <main className={styles.main}>
//         <div className={styles.indexWrap}>
//           <h1 className={styles.indexLogo} id="index-logo">
//             <em>114</em>
//             114KR
//           </h1>
//           <div className={styles.indexPromote}>"간편한 지역정보 <b>114114KR</b>"</div>
//           <div className={styles.indexNav}>
//             <div className={styles.tit}>지역을 선택해주세요.</div>
//             <ul className={styles.menu}>
//               <li><Link href="/board">전국</Link></li>
//               <li><Link href="/board?city1=서울">서울</Link></li>
//               <li><Link href="/board?city1=경기">경기</Link></li>
//               <li><Link href="/board?city1=인천">인천</Link></li>
//               <li><Link href="/board?city1=부산">부산</Link></li>
//               <li><Link href="/board?city1=대구">대구</Link></li>
//               <li><Link href="/board?city1=대전">대전</Link></li>
//               <li><Link href="/board?city1=광주">광주</Link></li>
//               <li><Link href="/board?city1=세종">세종</Link></li>
//               <li><Link href="/board?city1=울산">울산</Link></li>
//               <li><Link href="/board?city1=강원">강원</Link></li>
//               <li><Link href="/board?city1=경남">경남</Link></li>
//               <li><Link href="/board?city1=전남">전남</Link></li>
//               <li><Link href="/board?city1=전북">전북</Link></li>
//               <li><Link href="/board?city1=충남">충남</Link></li>
//               <li><Link href="/board?city1=충북">충북</Link></li>
//               <li><Link href="/board?city1=제주">제주</Link></li>
//             </ul>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/board');
  }, []);

  return null;
}
