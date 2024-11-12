import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import JobFilter from '@/components/JobFilter';
import JobList from '@/components/JobList';
import Pagination from '@/components/Pagination';
import Footer from '@/components/Footer';
import MainCarousel from '@/components/MainCarousel';
import styles from '@/styles/Board.module.css';
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'// 사용자에게 알림을 표시하기 위해 추가
import { useLanguage } from '@/hooks/useLanguage';  // 추가
import { Job, AdJob } from '@/types/job';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FilterOptions {
  city1: string;
  city2: string;
  cate1: string;
  cate2: string;
  keyword: string;
  searchType: 'title' | 'contents' | 'both';
}

function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
  const [installStatus, setInstallStatus] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 모바일 기기 체크
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };

    setIsMobile(checkMobile());

    const handler = (e: any) => {
      console.log('beforeinstallprompt 이벤트 발생!');
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
      setInstallStatus('설치 가능');
    };

    // iOS Safari 체크
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !window.matchMedia('(display-mode: standalone)').matches) {
      setSupportsPWA(true);
      setInstallStatus('iOS에서 설하려면 공유 버튼을 눌러주세요');
    }

    // 이미 설치되어 있는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('이미 설치됨');
      setInstallStatus('이미 설치됨');
      setSupportsPWA(false);
      return;
    }

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = async (evt: any) => {
    evt.preventDefault();

    // iOS Safari의 경우
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      alert('Safari에서 "공유" 버튼을 누른 후 "홈 화면에 추가"를 선택해주세요.');
      return;
    }

    if (!promptInstall) {
      console.log('설치 프롬프트 없음');
      return;
    }
    
    try {
      const result = await promptInstall.prompt();
      console.log('설치 프롬프트 결과:', result);
      setInstallStatus('설치 완료');
      setSupportsPWA(false);
    } catch (err) {
      console.error('설치 중 에러:', err);
      setInstallStatus('설치 실패');
    }
  };

  // 설치 불가능하거나 이 설치된 경우 버튼을 숨김
  if (!supportsPWA) {
    return null;
  }

  return (
    <button
      className={styles.installButton}
      onClick={onClick}
    >
      {isMobile && /iPad|iPhone|iPod/.test(navigator.userAgent)
        ? '앱 설치 방법 보기'
        : '앱 설치하기'}
      {installStatus && ` (${installStatus})`}
    </button>
  );
}

// ScrollToTop 컴포넌트 가
function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  // 스크롤 위치에 따 버튼 표시 여부 결정
  const toggleVisibility = useCallback(() => {
    if (window.pageYOffset > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  // 클릭 시 최상단으로 스크롤
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, [toggleVisibility]);

  return (
    <>
      {isVisible && (
        <button
          className={styles.scrollToTop}
          onClick={scrollToTop}
          aria-label="맨 위로 가기"
        >
          ↑
        </button>
      )}
    </>
  );
}

const BoardPage: React.FC = () => {

  const router = useRouter();
  const [regularJobs, setRegularJobs] = useState<Job[]>([]);
  const [adJobs, setAdJobs] = useState<AdJob[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>({
    city1: '',
    city2: '',
    cate1: '',
    cate2: '',
    keyword: '',
    searchType: 'both'
  });
  const [city2Options, setCity2Options] = useState<string[]>([]);
  const [cate2Options, setCate2Options] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [boardType, setBoardType] = useState<string>('0'); // 기본값을 '0'으로 설정
  const scrollPositionRef = useRef<number | null>(null);
  const isBackRef = useRef<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isPaginationChange, setIsPaginationChange] = useState(false);
  const { currentLanguage, changeLanguage } = useLanguage();  // 추가

  // 번역 관련 상태들을 Board로 이동
  const [translatedTitles, setTranslatedTitles] = useState<{ [key: number]: string }>({});
  const [translatedDetails, setTranslatedDetails] = useState<{ [key: number]: string }>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const previousJobsRef = useRef<string>('');

  // 번역 함수
  const translate = useCallback(async (text: string, targetLang: string) => {
    if (targetLang === 'ko') return text;
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await response.json();
      return data[0][0][0];
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }, []);

  // 언어 변경 핸들러
  const handleLanguageChange = useCallback((lang: string) => {
    if (lang === currentLanguage || isTranslating) return;
    
    window.gtag('event', 'translate', {
      event_category: 'Translation',
      event_label: `${currentLanguage}_to_${lang}`,
      page: 'job_list',
      current_page: currentPage
    });
    
    changeLanguage(lang);
    setTranslatedTitles({});
    setTranslatedDetails({});
  }, [currentLanguage, isTranslating, changeLanguage, currentPage]);

  // 직무 상세 정보 포맷팅
  const formatJobDetails = useCallback((job: Job) => {
    return `(${job['1depth_region']} ${job['2depth_region']}) - ${job['1depth_category']}`;
  }, []);

  // 번역 실행 로직
  useEffect(() => {
    const currentJobsString = JSON.stringify([...regularJobs, ...adJobs]);
    
    if (
      currentLanguage === 'ko' || 
      isTranslating || 
      (currentJobsString === previousJobsRef.current && Object.keys(translatedTitles).length > 0)
    ) {
      return;
    }

    const translateAllPosts = async () => {
      setIsTranslating(true);
      
      try {
        const allJobs = [...(currentPage === 1 ? adJobs : []), ...regularJobs];
        const newTitles = { ...translatedTitles };
        const newDetails = { ...translatedDetails };
        
        const untranslatedJobs = allJobs.filter(job => !newTitles[job.id]);
        
        if (untranslatedJobs.length > 0) {
          await Promise.all(untranslatedJobs.map(async (job) => {
            const [translatedTitle, translatedDetail] = await Promise.all([
              translate(job.title, currentLanguage),
              translate(formatJobDetails(job), currentLanguage)
            ]);
            newTitles[job.id] = translatedTitle;
            newDetails[job.id] = translatedDetail;
          }));

          setTranslatedTitles(newTitles);
          setTranslatedDetails(newDetails);

          window.gtag('event', 'translation_complete', {
            event_category: 'Translation',
            event_label: currentLanguage,
            page: 'job_list',
            current_page: currentPage,
            translated_count: untranslatedJobs.length
          });
        }
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsTranslating(false);
      }
    };

    translateAllPosts();
    previousJobsRef.current = currentJobsString;
  }, [
    currentLanguage,
    regularJobs,
    adJobs,
    currentPage,
    translate,
    isTranslating,
    formatJobDetails
  ]);

  // 텍스트 표시 함수
  const getDisplayText = useCallback((job: Job, type: 'title' | 'details') => {
    if (currentLanguage === 'ko') {
      return type === 'title' ? job.title : formatJobDetails(job);
    }
    return type === 'title' 
      ? translatedTitles[job.id] || job.title 
      : translatedDetails[job.id] || formatJobDetails(job);
  }, [currentLanguage, translatedTitles, translatedDetails, formatJobDetails]);

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    // city1이 변경되었는지 확인
    if (newFilters.city1 !== filters.city1) {
      // city1이 변경되었다면 city2를 초기화
      newFilters.city2 = '';
    }

    setFilters(newFilters);
    setCurrentPage(1);  // 필터가 변경되면 첫 페이지로 돌아갑니다
    
    const query = {
      ...newFilters,
      page: '1',  // 페이지를 1로 설정
      board_type: boardType  // board_type을 쿼리에 추가
    };
    router.push({
      pathname: router.pathname,
      query: query
    }, undefined, { shallow: true });
  }, [filters, router, boardType]);

  const fetchJobs = useCallback(async (currentFilters: FilterOptions, page: number, currentBoardType: string) => {
    setIsLoading(true);
    try {
      const { city1, city2, cate1, cate2, keyword, searchType } = currentFilters;
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      // 사용자가 작성한 게시물 쿼리만 실행 (null 게시물 제외)
      let userQuery;
      if (currentBoardType === '0') {
        // board_type이 '0'일 때는 is_accept가 true인 사용자의 게시물만
        userQuery = supabase
          .from('jd')
          .select(`
            *,
            users!inner (
              is_accept
            )
          `)
          .eq('ad', false)
          .eq('board_type', currentBoardType)
          .eq('users.is_accept', true)
          .not('uploader_id', 'is', null); // null이 아닌 게시물만 선택

      } else {
        // 다른 board_type일 때는 모든 사용자의 게시물
        userQuery = supabase
          .from('jd')
          .select('*')
          .eq('ad', false)
          .eq('board_type', currentBoardType)
          .not('uploader_id', 'is', null); // null이 아닌 게시물만 선택
      }

      // 필터 조건 추가
      if (city1) userQuery = userQuery.eq('1depth_region', city1);
      if (city2) userQuery = userQuery.eq('2depth_region', city2);
      if (cate1) userQuery = userQuery.eq('1depth_category', cate1);
      if (cate2) userQuery = userQuery.eq('2depth_category', cate2);
      
      if (keyword) {
        switch (searchType) {
          case 'title':
            userQuery = userQuery.ilike('title', `%${keyword}%`);
            break;
          case 'contents':
            userQuery = userQuery.ilike('contents', `%${keyword}%`);
            break;
          case 'both':
            userQuery = userQuery.or(`title.ilike.%${keyword}%,contents.ilike.%${keyword}%`);
            break;
        }
      }

      // 쿼리 실행
      const userResult = await userQuery;

      if (userResult.error) throw userResult.error;

      // 결과 정렬
      const allJobs = [...(userResult.data || [])]
        .sort((a, b) => new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime());

      // 페이지네이션 적용
      const totalCount = allJobs.length;
      const paginatedJobs = allJobs.slice(offset, offset + pageSize);

      setRegularJobs(paginatedJobs);
      setTotalPages(Math.ceil(totalCount / pageSize));

      // 광고 게시물도 동일한 로직으로 처리
      if (page === 1) {
        let nullUploaderAdQuery = supabase
          .from('jd')
          .select('*')
          .eq('ad', true)
          .eq('board_type', currentBoardType)
          .is('uploader_id', null);

        let userAdQuery;
        let acceptedUploaderAdQuery = supabase
          .from('jd')
          .select(`
            *,
            users!inner (
              is_accept
            )
          `)
          .eq('ad', true)
          .eq('board_type', currentBoardType)
          .eq('users.is_accept', true);

        // 광고 쿼리에 필터 조건 추가
        if (city1) {
          nullUploaderAdQuery = nullUploaderAdQuery.eq('1depth_region', city1);
          acceptedUploaderAdQuery = acceptedUploaderAdQuery.eq('1depth_region', city1);
        }
        if (city2) {
          nullUploaderAdQuery = nullUploaderAdQuery.eq('2depth_region', city2);
          acceptedUploaderAdQuery = acceptedUploaderAdQuery.eq('2depth_region', city2);
        }
        if (cate1) {
          nullUploaderAdQuery = nullUploaderAdQuery.eq('1depth_category', cate1);
          acceptedUploaderAdQuery = acceptedUploaderAdQuery.eq('1depth_category', cate1);
        }
        if (cate2) {
          nullUploaderAdQuery = nullUploaderAdQuery.eq('2depth_category', cate2);
          acceptedUploaderAdQuery = acceptedUploaderAdQuery.eq('2depth_category', cate2);
        }
        
        if (keyword) {
          switch (searchType) {
            case 'title':
              nullUploaderAdQuery = nullUploaderAdQuery.ilike('title', `%${keyword}%`);
              acceptedUploaderAdQuery = acceptedUploaderAdQuery.ilike('title', `%${keyword}%`);
              break;
            case 'contents':
              nullUploaderAdQuery = nullUploaderAdQuery.ilike('contents', `%${keyword}%`);
              acceptedUploaderAdQuery = acceptedUploaderAdQuery.ilike('contents', `%${keyword}%`);
              break;
            case 'both':
              nullUploaderAdQuery = nullUploaderAdQuery.or(
                `title.ilike.%${keyword}%,contents.ilike.%${keyword}%`
              );
              acceptedUploaderAdQuery = acceptedUploaderAdQuery.or(
                `title.ilike.%${keyword}%,contents.ilike.%${keyword}%`
              );
              break;
          }
        }

        const [nullUploaderAdResult, acceptedUploaderAdResult] = await Promise.all([
          nullUploaderAdQuery,
          acceptedUploaderAdQuery
        ]);

        if (nullUploaderAdResult.error) throw nullUploaderAdResult.error;
        if (acceptedUploaderAdResult.error) throw acceptedUploaderAdResult.error;

        const allAdJobs = [...(nullUploaderAdResult.data || []), ...(acceptedUploaderAdResult.data || [])]
          .sort((a, b) => new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime());

        setAdJobs(allAdJobs as AdJob[]);
      } else {
        setAdJobs([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error in fetchJobs:', err);
      setError('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleRouteChangeStart = () => {
      if (!isPaginationChange) {
        const currentPosition = window.pageYOffset;
        sessionStorage.setItem('boardScrollPosition', currentPosition.toString());
        console.log('Board: Route change start. Saving scroll position:', currentPosition);
      } else {
        console.log('Board: Pagination change. Not saving scroll position.');
      }
    };

    const handleRouteChangeComplete = () => {
      console.log('Board: Route change complete. Attempting to restore scroll position.');
      if (!isInitialLoad && !isPaginationChange) {
        restoreScrollPosition();
      } else if (isPaginationChange) {
        window.scrollTo(0, 0);
        console.log('Board: Pagination change. Scrolling to top.');
        setIsPaginationChange(false);
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router, isInitialLoad, isPaginationChange]);

  const restoreScrollPosition = useCallback(() => {
    const savedPosition = sessionStorage.getItem('boardScrollPosition');
    if (savedPosition !== null) {
      console.log('Restoring scroll position:', savedPosition);
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedPosition));
        console.log('Scroll position restored');
      });
    } else {
      console.log('No saved scroll position found.');
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    console.log('Router is ready. Current query:', router.query);

    const { city1, city2, cate1, cate2, keyword, page, board_type, searchType } = router.query;
    let newFilters = {
      city1: city1 as string || '',
      city2: city2 as string || '',
      cate1: cate1 as string || '',
      cate2: cate2 as string || '',
      keyword: keyword as string || '',
      searchType: (searchType as 'title' | 'contents' | 'both') || 'both'
    };

    const newBoardType = board_type as string || '0';
    const newPage = page ? parseInt(page as string) : 1;
    
    console.log('Setting new filters:', newFilters);
    console.log('Setting new board type:', newBoardType);
    console.log('Setting new page:', newPage);

    setFilters(newFilters);
    setBoardType(newBoardType);
    setCurrentPage(newPage);
    fetchJobs(newFilters, newPage, newBoardType);
  }, [router.isReady, router.query, fetchJobs]);

  useEffect(() => {
    if (contentRef.current && regularJobs.length > 0) {
      if (isInitialLoad) {
        console.log('Initial load complete. Attempting to restore scroll position.');
        restoreScrollPosition();
        setIsInitialLoad(false);
      }
    }
  }, [restoreScrollPosition, regularJobs, isInitialLoad]);

  const handlePageChange = (newPage: number) => {
    setIsPaginationChange(true);
    const query = {
      ...filters,
      page: newPage.toString(),
      board_type: boardType
    };
    router.push({
      pathname: router.pathname,
      query: query
    }, undefined, { shallow: true });
  };

  const updateURL = (newFilters: FilterOptions, newPage: number) => {
    const query = {
      ...newFilters,
      page: newPage.toString(),
      board_type: boardType
    };
    router.push({
      pathname: router.pathname,
      query: query
    }, undefined, { shallow: true });
  };

  const handleSearch = useCallback((keyword: string, searchType: 'title' | 'contents' | 'both') => {
    const newFilters = {
      ...filters,
      keyword,
      searchType
    };
    handleFilterChange(newFilters);
  }, [filters, handleFilterChange]);

  return (
    <div className={styles.container}>
      <Head>
        <title>{currentLanguage === 'ko' ? '구인구직 게시판 | 114114KR' : 'Job Board | 114114KR'}</title>
        <meta 
          name="description" 
          content={currentLanguage === 'ko' 
            ? "다양한 직종의 구인구직 정보를 찾아보세요." 
            : "Find job opportunities across various industries."
          } 
        />
        <meta name="keywords" content="114114, 114114코리아, 114114korea, 114114kr, 114114구인구직, 조선동포, 교포, 재외동, 해외교포, 동포 구인구직, 일자리 정보, 구직자, 구인체, 경력직 채용, 구인구직, 기업 채용, 단기 알바, 드림 구인구직, 무료 채용 공고, 아르바이트, 알바, 알바 구인구직, 월급, 일당, 주급, 채용 정보, 취업 정보, 직업 정보 제공, 지역별 구인구직, 헤드헌팅 비스, 신입 채용 공고, 동포 취업, 동포 일자리" />
        <meta property="og:title" content="구인구직 게시판 | 114114KR" />
        <meta property="og:description" content="다양한 직종의 구인구직 정보를 찾아보세요. 지역별, 카테고리별로 필터링하여 원하는 일자리를 쉽게 찾을 수 있습니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/board" />
        <meta property="og:image" content="https://114114KR.com/ogimage.png" />
      </Head>

      <Header/>
      <div className={styles.layout}>
        <MainCarousel 
          images={[
            { 
              src: '/image copy.png', 
              link: 'https://open.kakao.com/me/114114KR',
              mobileSrc: '/image copy_mo.png'
            },
            { 
              src: '/image.png', 
              link: '/jd/6599',
              mobileSrc: '/image_mo.png'
            },
            { 
              src: '/image_3.png', 
              link: 'https://88pandacar.framer.website/',
              mobileSrc: '/image_3_mo.png'
            }
            // 추가 이미지와 링크를 여기에 추가
          ]}
        />
        
        <div className={styles.contentWrapper}>
          <div className={styles.sideMenu}>
            <MainMenu currentBoardType={boardType} />
            <div className={styles.languageSelector}>
              <button 
                className={currentLanguage === 'ko' ? styles.activeLanguage : ''} 
                onClick={() => handleLanguageChange('ko')}
              >
                한국어
              </button>
              <button 
                className={currentLanguage === 'en' ? styles.activeLanguage : ''} 
                onClick={() => handleLanguageChange('en')}
              >
                English
              </button>
              <button 
                className={currentLanguage === 'zh' ? styles.activeLanguage : ''} 
                onClick={() => handleLanguageChange('zh')}
              >
                中文
              </button>
              <button 
                className={currentLanguage === 'ja' ? styles.activeLanguage : ''} 
                onClick={() => handleLanguageChange('ja')}
              >
                日本語
              </button>
            </div>
          </div>
          
          <div className={styles.mainContent}>
            <JobFilter
              filters={filters}
              onFilterChange={handleFilterChange}
              city2Options={city2Options}
              cate2Options={cate2Options}
            />

            <JobList 
              jobs={regularJobs}
              adJobs={adJobs}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              getDisplayText={getDisplayText}  // 새로운 prop 추가
            />
          </div>
        </div>
      </div>
      
      <Footer />
      {error && <div className={styles.error}>{error}</div>}
      <InstallPWA />
      <ScrollToTop />
    </div>
  );
};

export default BoardPage;
