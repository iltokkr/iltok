import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <title>114114KR - 빠르고 간편한 구인구직 서비스</title>
        <meta name="author" content="114114KOREA" />
        <meta name="Keywords" content="114114, 114114코리아, 114114korea, 114114구인구직, 일자리 정보, 구직자, 구인업체, 경력직 채용, 구인구직, 기업 채용, 단기 알바, 드림 구인구직, 무료 채용 공고, 아르바이트, 알바, 알바 구인구직, 월급, 일당, 주급, 채용 정보, 취업 정보, 직업 정보 제공, 지역별 구인구직, 헤드헌팅 서비스, 신입 채용 공고" />
        <meta name="Description" content="국내 1위 구인구직 플랫폼, 114114구인구직에서 쉽고 빠른 구직 서비스와 간편한 지역정보를 한 번에 확인하세요! 신속하고 정확한 114114구인구직 정보를 제공하는 플랫폼입니다. 아르바이트부터 경력직 채용, 일당, 주급, 월급까지 다양한 채용 정보를 손쉽게 확인하고 취업 기회를 찾으세요. 기업 채용 공고 무료 등록, 지역별 맞춤 구직 서비스, 헤드헌팅 서비스까지, 취업과 채용의 모든 것을 지원합니다." />
        <link rel="shortcut icon" href="/favicon.ico" />
      </Head>
      

      <main className={styles.main}>
        <div className={styles.indexWrap}>
          <h1 className={styles.indexLogo} id="index-logo">
            <em>114</em>
            114KR
          </h1>
          <div className={styles.indexPromote}>"간편한 지역정보 <b>114114KR</b>"</div>
          <div className={styles.indexNav}>
            <div className={styles.tit}>지역을 선택해주세요.</div>
            <ul className={styles.menu}>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=">전국</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=서울">서울</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">경기</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">인천</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">부산</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">대구</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">대전</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">광주</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">세종</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">울산</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">강원</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">경남</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">전남</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">전북</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">충남</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">충북</Link></li>
              <li><Link href="/board?bo_mode=list&bo_table=job&city1=경기">제주</Link></li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}