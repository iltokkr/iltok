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

interface Job {
  id: number;
  updated_time: string;
  title: string;
  contents: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
}

interface AdJob extends Job {
  ad: true;
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

  // 설치 불가능하거나 이미 설치된 경우 버튼을 숨김
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

      let regularQuery = supabase
        .from('jd')
        .select('*', { count: 'exact' })
        .eq('ad', false)
        .eq('board_type', currentBoardType)
        .order('updated_time', { ascending: false });

      if (city1) regularQuery = regularQuery.eq('1depth_region', city1);
      if (city2) regularQuery = regularQuery.eq('2depth_region', city2);
      if (cate1) regularQuery = regularQuery.eq('1depth_category', cate1);
      if (cate2) regularQuery = regularQuery.eq('2depth_category', cate2);
      
      if (keyword) {
        switch (searchType) {
          case 'title':
            regularQuery = regularQuery.ilike('title', `%${keyword}%`);
            break;
          case 'contents':
            regularQuery = regularQuery.ilike('contents', `%${keyword}%`);
            break;
          case 'both':
            regularQuery = regularQuery.or(
              `or(title.ilike.%${keyword}%,contents.ilike.%${keyword}%)`
            );
            break;
        }
      }

      const offset = (page - 1) * pageSize;
      regularQuery = regularQuery.range(offset, offset + pageSize - 1);

      const { data: regularData, error: regularError, count } = await regularQuery;


      if (regularError) {
        throw new Error(`Error fetching regular jobs: ${regularError.message}`);
      }

      setRegularJobs(regularData || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));

      // Fetch ad jobs (only for the first page)
      if (page === 1) {
        let adQuery = supabase
          .from('jd')
          .select('*')
          .eq('ad', true)
          .eq('board_type', currentBoardType)
          .order('updated_time', { ascending: false });

        if (city1) adQuery = adQuery.eq('1depth_region', city1);
        if (city2) adQuery = adQuery.eq('2depth_region', city2);
        if (cate1) adQuery = adQuery.eq('1depth_category', cate1);
        if (cate2) adQuery = adQuery.eq('2depth_category', cate2);
        
        if (keyword) {
          switch (searchType) {
            case 'title':
              adQuery = adQuery.ilike('title', `%${keyword}%`);
              break;
            case 'contents':
              adQuery = adQuery.ilike('contents', `%${keyword}%`);
              break;
            case 'both':
              adQuery = adQuery.or(
                `or(title.ilike.%${keyword}%,contents.ilike.%${keyword}%)`
              );
              break;
          }
        }

        const { data: adData, error: adError } = await adQuery;

        if (adError) {
          throw new Error(`Error fetching ad jobs: ${adError.message}`);
        }

        setAdJobs(adData as AdJob[] || []);
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
        <title>구인구직 게시판 | 114114KR</title>
        <meta name="description" content="다양한 직종의 구인구직 정보를 찾아보세요." />
        <meta name="keywords" content="114114, 114114코리아, 114114korea, 114114kr, 114114구인구직, 조선동포, 교포, 재외동포, 해외교포, 동포 구인구직, 일자리 정보, 구직자, 구인체, 경력직 채용, 구인구직, 기업 채용, 단기 알바, 드림 구인구직, 무료 채용 공고, 아르바이트, 알바, 알바 구인구직, 월급, 일당, 주급, 채용 정보, 취업 정보, 직업 정보 제공, 지역별 구인구직, 헤드헌팅 비스, 신입 채용 공고, 동포 취업, 동포 일자리" />
        <meta property="og:title" content="구인구직 게시판 | 114114KR" />
        <meta property="og:description" content="다양한 직종의 구인구직 정보를 찾아보세요. 지역별, 카테고리별로 필터링하여 원하는 일자리를 쉽게 찾을 수 있습니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/board" />
        <meta property="og:image" content="https://114114KR.com/ogimage.png" />
      </Head>

      <Header/>
      <div className={styles.layout} ref={contentRef}>
        <MainMenu currentBoardType={boardType} />
        <JobFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          city2Options={city2Options}
          cate2Options={cate2Options}
        />
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
            }
            // 추가 이미지와 링크를 여기에 추가
          ]}
        />

        <JobList 
          jobs={regularJobs}
          adJobs={adJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
      <Footer />
      {error && <div className={styles.error}>{error}</div>}
      <InstallPWA /> {/* PWA 설치 버튼 추가 */}
    </div>
  );
};

export default BoardPage;
