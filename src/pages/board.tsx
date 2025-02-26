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
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

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
  salary_type: string;
  salary_detail: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
  board_type: string;
  bookmarked?: boolean;
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
      setInstallStatus('미 설치됨');
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

// ScrollToTop 컴포넌트 추가
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

// CustomerSupport 컴포넌트 추가
function CustomerSupport() {
  const { currentLanguage } = useLanguage();
  
  return (
    <a
      href="http://pf.kakao.com/_ywaMn"
      target="_blank"
      rel="noopener noreferrer"
      className={styles.customerSupport}
      aria-label={currentLanguage === 'ko' ? '고객센터 문의하기' : 'Contact Customer Support'}
    >
      <div className={styles.customerSupportIcon}>
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          fill="currentColor"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"/>
        </svg>
      </div>
      <span className={styles.tooltip}>
        {currentLanguage === 'ko' ? '불편한 점이 있다면 문의하세요' : 'Contact Us'}
      </span>
    </a>
  );
}

// WriteButton 컴포넌트 수정
function WriteButton() {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const { board_type } = router.query;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = () => {
    router.push('/write');
  };

  // board_type이 4가 아니거나 모바일이 아닐 경우 렌더링하지 않음
  if (!isMobile || board_type !== '4') return null;

  return (
    <button
      className={styles.writeButton}
      onClick={handleClick}
      aria-label={currentLanguage === 'ko' ? '글쓰기' : 'Write Post'}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>{currentLanguage === 'ko' ? '글쓰기' : 'Write'}</span>
    </button>
  );
}

// 페이지를 정적으로 생성하도록 설정
export async function getStaticProps() {
  return {
    props: {}
  }
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
  const [boardType, setBoardType] = useState<string>('0'); // 값을 '0'으로 설정
  const scrollPositionRef = useRef<number | null>(null);
  const isBackRef = useRef<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isPaginationChange, setIsPaginationChange] = useState(false);
  const { currentLanguage, changeLanguage } = useLanguage();  // 추가
  const auth = useContext(AuthContext);
  const [bookmarkedJobs, setBookmarkedJobs] = useState<number[]>([]);

  // AuthContext가 는 경우 에러 처리
  if (!auth) throw new Error("AuthContext not found");
  
  const { user, isLoggedIn } = auth;

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
      console.log('Fetching jobs with filters:', currentFilters, 'Page:', page, 'Board Type:', currentBoardType);

      const { city1, city2, cate1, cate2, keyword, searchType } = currentFilters;
      const pageSize = currentBoardType === '4' ? 20 : 40; // board_type 4일 때는 페이지당 20개
      const offset = (page - 1) * pageSize;

      // 기본 쿼리 설정
      let baseQuery = supabase
        .from('jd')
        .select(`
          *,
          users!inner (
            is_accept
          )
        `, { count: 'exact' })
        .eq('ad', false)
        .eq('board_type', currentBoardType)
        .not('uploader_id', 'is', null);

      // board_type이 0일 때만 is_accept 조건 추가
      if (currentBoardType === '0') {
        baseQuery = baseQuery.eq('users.is_accept', true);
      }

      // 필터 조건 추가
      if (city1) baseQuery = baseQuery.eq('1depth_region', city1);
      if (city2) baseQuery = baseQuery.eq('2depth_region', city2);
      if (cate1) baseQuery = baseQuery.eq('1depth_category', cate1);
      if (cate2) baseQuery = baseQuery.eq('2depth_category', cate2);
      
      // 검색어 조건 추가
      if (keyword) {
        switch (searchType) {
          case 'title':
            baseQuery = baseQuery.ilike('title', `%${keyword}%`);
            break;
          case 'contents':
            baseQuery = baseQuery.ilike('contents', `%${keyword}%`);
            break;
          case 'both':
            baseQuery = baseQuery.or(`title.ilike.%${keyword}%,contents.ilike.%${keyword}%`);
            break;
        }
      }

      // 데이터 조회 (페이지네이션 적용)
      const { data: jobs, count: totalCount, error } = await baseQuery
        .order('updated_time', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      // console.log('Total count:', totalCount);
      // console.log('Current page data:', jobs?.length);

      // 전체 페이지 수 계산
      const totalPages = Math.ceil((totalCount || 0) / pageSize);
      setTotalPages(totalPages);

      // 북마크 상태를 포함하여 jobs 매핑
      const mappedJobs = (jobs || []).map((job: any) => ({
        ...job,
        board_type: currentBoardType,
        bookmarked: bookmarkedJobs.includes(job.id)
      }));

      setRegularJobs(mappedJobs);
      setError(null);

      // 광고 게시물 처리 (첫 페이지에만)
      if (page === 1 && currentBoardType !== '4') {
        let adQuery;
        
        if (currentBoardType === '0') {
          // board_type이 0일 때는 users 테이블과 join하고 is_accept가 true인 것만 가져옴
          adQuery = supabase
            .from('jd')
            .select(`
              id,
              updated_time,
              title,
              contents,
              salary_type,
              salary_detail,
              1depth_region,
              2depth_region,
              1depth_category,
              2depth_category,
              ad,
              uploader_id,
              users!inner (
                is_accept
              )
            `)
            .eq('ad', true)
            .eq('board_type', currentBoardType)
            .eq('users.is_accept', true);

          // uploader_id가 null인 광고도 별도로 가져옴
          let nullUploaderQuery = supabase
            .from('jd')
            .select()
            .eq('ad', true)
            .eq('board_type', currentBoardType)
            .is('uploader_id', null);

          // 필터 조건 추가
          if (city1) {
            adQuery = adQuery.eq('1depth_region', city1);
            nullUploaderQuery = nullUploaderQuery.eq('1depth_region', city1);
          }
          if (city2) {
            adQuery = adQuery.eq('2depth_region', city2);
            nullUploaderQuery = nullUploaderQuery.eq('2depth_region', city2);
          }
          if (cate1) {
            adQuery = adQuery.eq('1depth_category', cate1);
            nullUploaderQuery = nullUploaderQuery.eq('1depth_category', cate1);
          }
          if (cate2) {
            adQuery = adQuery.eq('2depth_category', cate2);
            nullUploaderQuery = nullUploaderQuery.eq('2depth_category', cate2);
          }
          
          if (keyword) {
            switch (searchType) {
              case 'title':
                adQuery = adQuery.ilike('title', `%${keyword}%`);
                nullUploaderQuery = nullUploaderQuery.ilike('title', `%${keyword}%`);
                break;
              case 'contents':
                adQuery = adQuery.ilike('contents', `%${keyword}%`);
                nullUploaderQuery = nullUploaderQuery.ilike('contents', `%${keyword}%`);
                break;
              case 'both':
                adQuery = adQuery.or(`title.ilike.%${keyword}%,contents.ilike.%${keyword}%`);
                nullUploaderQuery = nullUploaderQuery.or(`title.ilike.%${keyword}%,contents.ilike.%${keyword}%`);
                break;
            }
          }

          const adResult = await adQuery;
          const nullUploaderResult = await nullUploaderQuery;

          if (adResult.error) throw adResult.error;
          if (nullUploaderResult.error) throw nullUploaderResult.error;

          const allAdJobs = [...(adResult.data || []), ...(nullUploaderResult.data || [])]
            .sort((a, b) => new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime())
            .map(job => ({
              ...job,
              board_type: currentBoardType,
              ad: true as const,
              bookmarked: bookmarkedJobs.includes(job.id)
            }));

          setAdJobs(allAdJobs);
        } else {
          // board_type이 1일 때는 users 테이블과 join하지 않음
          adQuery = supabase
            .from('jd')
            .select(`
              id,
              updated_time,
              title,
              contents,
              salary_type,
              salary_detail,
              1depth_region,
              2depth_region,
              1depth_category,
              2depth_category,
              ad,
              uploader_id
            `)
            .eq('ad', true)
            .eq('board_type', currentBoardType);

          // 필터 조건 추가
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
                adQuery = adQuery.or(`title.ilike.%${keyword}%,contents.ilike.%${keyword}%`);
                break;
            }
          }

          const adResult = await adQuery;

          if (adResult.error) throw adResult.error;

          const allAdJobs = [...(adResult.data || [])]
            .sort((a, b) => new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime())
            .map(job => ({
              ...job,
              board_type: currentBoardType,
              ad: true as const,
              bookmarked: bookmarkedJobs.includes(job.id)
            }));

          setAdJobs(allAdJobs);
        }

        setError(null);
      } else {
        setAdJobs([]);
      }

      setError(null);

      // 특정 ID 공고 디버깅
      // const debugQuery = await supabase
      //   .from('jd')
      //   .select(`
      //     *,
      //     users (
      //       is_accept
      //     )
      //   `)
      //   .eq('id', 9923)
      //   .single();
      
      // console.log('Debug 9923 공고:', debugQuery.data);
      // console.log('9923 공고 필터링 조건:');
      // console.log('- uploader_id:', debugQuery.data?.uploader_id);
      // console.log('- user accept status:', debugQuery.data?.users?.is_accept);
      // console.log('- board_type:', debugQuery.data?.board_type);
      // console.log('- ad status:', debugQuery.data?.ad);

    } catch (err) {
      console.error('Error in fetchJobs:', err);
      setError('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [bookmarkedJobs]);

  const restoreScrollPosition = useCallback(() => {
    const savedPosition = sessionStorage.getItem('boardScrollPosition');
    if (savedPosition !== null) {
      // console.log('Restoring scroll position:', savedPosition);
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedPosition));
        // console.log('Scroll position restored');
      }, 100);
    } // else {
      // console.log('No saved scroll position found.');
    // }
  }, []);

  useEffect(() => {
    const handleRouteChangeStart = () => {
      if (!isPaginationChange) {
        const currentPosition = window.pageYOffset;
        sessionStorage.setItem('boardScrollPosition', currentPosition.toString());
        // console.log('Board: Route change start. Saving scroll position:', currentPosition);
      } else {
        // console.log('Board: Pagination change. Not saving scroll position.');
      }
    };

    const handleRouteChangeComplete = () => {
      // console.log('Board: Route change complete. Attempting to restore scroll position.');
      if (!isInitialLoad && !isPaginationChange) {
        restoreScrollPosition();
      } else if (isPaginationChange) {
        window.scrollTo(0, 0);
        // console.log('Board: Pagination change. Scrolling to top.');
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

  useEffect(() => {
    if (!router.isReady) return;

    // console.log('Router is ready. Current query:', router.query);

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
    
    // console.log('Setting new filters:', newFilters);
    // console.log('Setting new board type:', newBoardType);
    // console.log('Setting new page:', newPage);

    setFilters(newFilters);
    setBoardType(newBoardType);
    setCurrentPage(newPage);
    fetchJobs(newFilters, newPage, newBoardType);
  }, [router.isReady, router.query, fetchJobs]);

  useEffect(() => {
    if (contentRef.current && regularJobs.length > 0 && adJobs.length >= 0) {
      if (isInitialLoad) {
        // console.log('Initial load complete. Attempting to restore scroll position.');
        restoreScrollPosition();
        setIsInitialLoad(false);
      }
    }
  }, [restoreScrollPosition, regularJobs, adJobs, isInitialLoad]);

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

  // 북마크 데이터를 가져오는 함수 추가
  const fetchBookmarks = useCallback(async () => {
    if (!isLoggedIn || !user) return;
    
    const { data, error } = await supabase
      .from('bookmark')
      .select('jd_id')
      .eq('users_id', user.id);
      
    if (data && !error) {
      setBookmarkedJobs(data.map(bookmark => bookmark.jd_id));
    }
  }, [isLoggedIn, user]);

  // 컴포넌트 마운트 시 북마크 데이터 가져오기
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // fetchJobs를 다시 호출하여 북마크 상태 업데이트
  useEffect(() => {
    if (router.isReady) {
      const { city1, city2, cate1, cate2, keyword, page, board_type, searchType } = router.query;
      const currentFilters = {
        city1: city1 as string || '',
        city2: city2 as string || '',
        cate1: cate1 as string || '',
        cate2: cate2 as string || '',
        keyword: keyword as string || '',
        searchType: (searchType as 'title' | 'contents' | 'both') || 'both'
      };
      const currentPage = page ? parseInt(page as string) : 1;
      const currentBoardType = board_type as string || '0';
      
      fetchJobs(currentFilters, currentPage, currentBoardType);
    }
  }, [router.isReady, bookmarkedJobs]);

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
        <meta name="keywords" content="114114, 114114코리아, 114114korea, 114114kr, 114114구인구직, 조선동포, 교포, 재외동, 해외교포, 동포 구인구직, 일자리 정보, 구직자, 구인체, 경력직 채용, 구인구직, 기업 채용, 기 알바, 드림 구인구직, 무료 채용 공고, 아르바이트, 알바, 알바 구인구직, 월급, 일당, 채용 정보, 취업 정보, 직업 정보 제공, 지역별 구인구직, 헤드헌팅 비스, 신입 채용 공고, 포 취업, 동포 일자리" />
        <meta property="og:title" content="구인구직 게시판 | 114114KR" />
        <meta property="og:description" content="다양한 직종의 구인구직 정보를 찾아보세요. 지역별, 카테고리별로 필터링하여 원하는 일자리를 쉽게 찾을 수 있습다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/board" />
        <meta property="og:image" content="https://114114KR.com/ogimage.png" />
      </Head>

      <Header/>
      <MainMenu currentBoardType={boardType} />
      <MainCarousel  
          images={[
            { 
              src: '/image copy.png', 
              link: 'https://open.kakao.com/me/114114KR',
              mobileSrc: '/image copy_mo.png'
            },
            { 
              src: '/image_3.png', 
              link: 'https://88pandacar.framer.website/',
              mobileSrc: '/image_3_mo.png'
            }
            // 추가 이미지와 링크를 여기에 추가
        ]}
      />
      <div className={styles.layout} ref={contentRef}>
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
          boardType={boardType}
        />
      </div>
      <Footer />
      {error && <div className={styles.error}>{error}</div>}
      <InstallPWA />
      <ScrollToTop />
      <CustomerSupport />
      <WriteButton />
    </div>
  );
};

export default BoardPage;
