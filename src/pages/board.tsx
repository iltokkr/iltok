import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
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
import { FiEdit3 } from 'react-icons/fi';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 목록에서 실제로 렌더링되는 컬럼만 조회한다.
// contents는 본문 전체(평균 714B, row의 73%)라 목록에서는 미리보기 생성 컬럼으로 대체한다.
// 게시판별로 본문 미리보기를 쓰는 곳이 다르다:
//   0(채용정보) renderJobItem  - 본문을 아예 표시하지 않으므로 조회하지 않는다
//   1(구직정보) renderJobSeekerItem, 4(자유게시판) 커뮤니티/인기글 - 미리보기를 표시한다
// (검색용 ilike는 서버에서 원본 contents를 그대로 쓰므로 어느 쪽이든 영향 없음)
const listColumns = (boardType: string) => `
  id,
  updated_time,
  title,
  ${boardType === '0' ? '' : 'contents:contents_preview,'}
  salary_type,
  salary_detail,
  1depth_region,
  2depth_region,
  1depth_category,
  2depth_category,
  ad,
  view_count,
  community_tag,
  is_urgent,
  is_ads,
  is_day_pay,
  work_start_time,
  work_end_time,
  age_limit,
  korean_name,
  seeker_gender,
  birth_date,
  nationality,
  visa_status,
  desired_regions,
  work_conditions,
  career_history
`;

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
  // 채용정보(board_type 0) 목록과 광고는 본문을 표시하지 않아 조회하지 않는다.
  contents?: string;
  salary_type: string;
  salary_detail: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
  board_type: string;
  bookmarked?: boolean;
  comment_count?: number;
  community_tag?: string;
  is_urgent?: boolean;
}

interface AdJob extends Job {
  ad: true;
}

// 상세로 갔다가 뒤로 돌아올 때 쓰는 스냅샷.
// 재조회를 기다렸다가 스크롤을 옮기면 "상단이 잠깐 보였다가 툭 점프"하는 것처럼 보이므로,
// 목록과 좌표를 함께 저장해뒀다가 첫 페인트 전에 통째로 복원한다(Supabase 재조회도 생략).
const SNAPSHOT_KEY = 'boardSnapshot';
const SNAPSHOT_TTL = 10 * 60 * 1000;

interface BoardSnapshot {
  url: string;
  savedAt: number;
  scrollY: number;
  regularJobs: Job[];
  adJobs: AdJob[];
  partnerJobs: Job[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

// 같은 URL(게시판·필터·페이지)로 돌아온 경우에만 재사용한다.
function readSnapshot(): BoardSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as BoardSnapshot;
    if (!snap?.regularJobs?.length) return null;
    if (Date.now() - snap.savedAt > SNAPSHOT_TTL) return null;
    if (snap.url !== window.location.pathname + window.location.search) return null;
    return snap;
  } catch {
    return null;
  }
}

// SSR 에서는 layout effect 를 쓸 수 없어 경고가 나므로 브라우저에서만 사용한다.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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

// WriteButton 플로팅 버튼 컴포넌트
function WriteButton({ boardType }: { boardType: string }) {
  const router = useRouter();
  
  const handleClick = () => {
    // write 페이지로 이동 (로그인 체크는 write 페이지에서 처리)
    router.push(`/write?board_type=${boardType}`);
  };
  
  return (
    <button
      onClick={handleClick}
      className={styles.writeButton}
      aria-label="글쓰기"
    >
      <FiEdit3 />
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
  const [partnerJobs, setPartnerJobs] = useState<Job[]>([]); // 제휴(is_ads) - 프리미엄 상단 고정용
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
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
  const [showModal, setShowModal] = useState(true); // 모달 상태 추가

  const { user, isLoggedIn } = auth || {};

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
      const pageSize = 40;
      const offset = (page - 1) * pageSize;

      // 기본 쿼리: 채용정보(board_type 0)는 제휴 제외 일반 공고만, 그 외는 기존대로
      let baseQuery = supabase
        .from('jd')
        .select(`${listColumns(currentBoardType)}, user_public!inner(is_accept)`, { count: 'exact' })
        .eq('board_type', currentBoardType)
        .not('uploader_id', 'is', null)
        .or('is_hidden.is.null,is_hidden.eq.false'); // 숨김 처리된 게시글 제외

      if (currentBoardType === '0') {
        baseQuery = baseQuery.eq('user_public.is_accept', true)
          .eq('ad', false)
          .or('is_ads.is.null,is_ads.eq.false'); // 제휴(is_ads) 제외 - 프리미엄 섹션으로 분리
      } else {
        baseQuery = baseQuery.or('ad.eq.false,is_ads.eq.true');
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

      // 전체 페이지 수 및 총 건수 계산
      const totalPages = Math.ceil((totalCount || 0) / pageSize);
      setTotalPages(totalPages);
      setTotalCount(totalCount || 0);

      // 댓글 수 가져오기
      const jobIds = (jobs || []).map((job: any) => job.id);
      let commentCounts: Record<number, number> = {};
      
      if (jobIds.length > 0) {
        const { data: comments } = await supabase
          .from('comment')
          .select('jd_id')
          .in('jd_id', jobIds);
        
        if (comments) {
          commentCounts = comments.reduce((acc: Record<number, number>, comment: any) => {
            acc[comment.jd_id] = (acc[comment.jd_id] || 0) + 1;
            return acc;
          }, {});
        }
      }

      // 지원 수 가져오기 (개별 지원 행 노출 없이 집계값만 — get_application_counts RPC)
      let bookmarkCountsData: Record<number, number> = {};
      if (jobIds.length > 0) {
        const { data } = await supabase.rpc('get_application_counts', { jd_ids: jobIds });
        if (data) {
          bookmarkCountsData = (data as { jd_id: number; cnt: number }[]).reduce(
            (acc: Record<number, number>, item) => {
              acc[item.jd_id] = Number(item.cnt);
              return acc;
            },
            {}
          );
        }
      }

      // 북마크 상태와 댓글 수, 조회수를 포함하여 jobs 매핑
      const mappedJobs = (jobs || []).map((job: any) => ({
        ...job,
        board_type: currentBoardType,
        bookmarked: bookmarkedJobs.includes(job.id),
        comment_count: commentCounts[job.id] || 0,
        bookmark_count: bookmarkCountsData[job.id] || 0,
        view_count: job.view_count || 0,
        // 인기 점수 계산: 조회수 × 1 + 댓글수 × 3 + 북마크수 × 2
        popularity_score: (job.view_count || 0) + (commentCounts[job.id] || 0) * 3 + (bookmarkCountsData[job.id] || 0) * 2
      }));

      // 자유게시판(board_type 4)인 경우: 공지 게시글 상단 고정 + 나머지는 시간순
      if (currentBoardType === '4') {
        setPartnerJobs([]);
        const noticeJobs = mappedJobs.filter((job: any) => job.community_tag === '공지');
        const regularJobsFiltered = mappedJobs.filter((job: any) => job.community_tag !== '공지');
        setRegularJobs([...noticeJobs, ...regularJobsFiltered]);
      } else if (currentBoardType === '0') {
        setRegularJobs(mappedJobs);
      } else {
        setPartnerJobs([]);
        setRegularJobs(mappedJobs);
      }
      setError(null);

      // 광고·제휴 게시물 처리 (첫 페이지에만)
      if (page !== 1 && currentBoardType === '0') {
        setPartnerJobs([]);
      }
      if (page === 1) {
        let adQuery;
        
        if (currentBoardType === '0') {
          // board_type이 0일 때는 users 테이블과 join하고 is_accept가 true인 것만 가져옴
          adQuery = supabase
            .from('jd')
            // 컬럼을 따로 나열하면 listColumns 에 뭔가 추가될 때 이 쿼리만 빠진다.
            // 실제로 work_start_time/work_end_time 이 없어 프리미엄 카드에만
            // 근무시간이 표시되지 않았다. 목록과 같은 정의를 쓴다.
            .select(`${listColumns(currentBoardType)}, user_public!inner(is_accept)`)
            .eq('ad', true)
            .eq('board_type', currentBoardType)
            .eq('user_public.is_accept', true)
            .or('is_hidden.is.null,is_hidden.eq.false')
            .or(`ad_until.is.null,ad_until.gte.${new Date().toISOString()}`);

          // uploader_id가 null인 광고도 별도로 가져옴
          let nullUploaderQuery = supabase
            .from('jd')
            .select(listColumns(currentBoardType))
            .eq('ad', true)
            .eq('board_type', currentBoardType)
            .is('uploader_id', null)
            .or('is_hidden.is.null,is_hidden.eq.false')
            .or(`ad_until.is.null,ad_until.gte.${new Date().toISOString()}`);

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

          // 제휴(is_ads) 게시물 - 프리미엄 섹션 상단 고정용
          let partnerQuery = supabase
            .from('jd')
            .select(`${listColumns(currentBoardType)}, user_public!inner(is_accept)`)
            .eq('board_type', currentBoardType)
            .eq('is_ads', true)
            .eq('user_public.is_accept', true)
            .not('uploader_id', 'is', null)
            .or('is_hidden.is.null,is_hidden.eq.false')
            .or(`ad_until.is.null,ad_until.gte.${new Date().toISOString()}`);
          if (city1) partnerQuery = partnerQuery.eq('1depth_region', city1);
          if (city2) partnerQuery = partnerQuery.eq('2depth_region', city2);
          if (cate1) partnerQuery = partnerQuery.eq('1depth_category', cate1);
          if (cate2) partnerQuery = partnerQuery.eq('2depth_category', cate2);
          if (keyword) {
            switch (searchType) {
              case 'title': partnerQuery = partnerQuery.ilike('title', `%${keyword}%`); break;
              case 'contents': partnerQuery = partnerQuery.ilike('contents', `%${keyword}%`); break;
              case 'both': partnerQuery = partnerQuery.or(`title.ilike.%${keyword}%,contents.ilike.%${keyword}%`); break;
            }
          }
          const { data: partnerData } = await partnerQuery.order('updated_time', { ascending: false });

          const adResult = await adQuery;
          const nullUploaderResult = await nullUploaderQuery;

          if (adResult.error) throw adResult.error;
          if (nullUploaderResult.error) throw nullUploaderResult.error;

          // 두 광고 쿼리는 조회 컬럼이 달라 추론 타입이 갈리므로 any[]로 합친다.
          const allAdJobs = ([...(adResult.data || []), ...(nullUploaderResult.data || [])] as any[])
            .sort((a, b) => new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime())
            .map((job: any) => ({
              ...job,
              board_type: currentBoardType,
              ad: true as const,
              bookmarked: bookmarkedJobs.includes(job.id)
            }));

          const partnerMapped = (partnerData || []).map((job: any) => ({
            ...job,
            board_type: currentBoardType,
            bookmarked: bookmarkedJobs.includes(job.id)
          }));
          setPartnerJobs(partnerMapped);
          setAdJobs(allAdJobs);
        } else {
          // board_type이 1일 때는 users 테이블과 join하지 않음
          adQuery = supabase
            .from('jd')
            .select(`
              id,
              updated_time,
              title,
              salary_type,
              salary_detail,
              1depth_region,
              2depth_region,
              1depth_category,
              2depth_category,
              ad
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

  // 스냅샷으로 복원했으면 첫 조회를 건너뛴다(이미 화면이 완성돼 있음)
  const restoredFromSnapshotRef = useRef(false);
  // 복원 대기 중인 스크롤 좌표 — 목록이 DOM 에 올라간 커밋 직후 한 번만 적용한다
  const pendingScrollRef = useRef<number | null>(null);

  // 상세 페이지로 나갈 때 화면 상태 저장
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (!url.startsWith('/jd/')) return;
      try {
        const snapshot: BoardSnapshot = {
          url: window.location.pathname + window.location.search,
          savedAt: Date.now(),
          scrollY: window.pageYOffset || document.documentElement.scrollTop,
          regularJobs,
          adJobs,
          partnerJobs,
          currentPage,
          totalPages,
          totalCount
        };
        sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // 저장 실패(용량 초과 등)는 무시 — 스냅샷이 없으면 기존대로 재조회한다
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [router, regularJobs, adJobs, partnerJobs, currentPage, totalPages, totalCount]);

  // 뒤로가기 복원: 저장해둔 목록을 첫 페인트 전에 되돌린다
  // (브라우저 자동 복원은 _app.tsx 에서 이미 manual 로 꺼둔 상태)
  useIsoLayoutEffect(() => {
    const snap = readSnapshot();
    if (!snap) return;

    restoredFromSnapshotRef.current = true;
    setRegularJobs(snap.regularJobs);
    setAdJobs(snap.adJobs);
    setPartnerJobs(snap.partnerJobs);
    setCurrentPage(snap.currentPage);
    setTotalPages(snap.totalPages);
    setTotalCount(snap.totalCount);
    setIsInitialLoad(false);
    pendingScrollRef.current = snap.scrollY;
    sessionStorage.removeItem(SNAPSHOT_KEY);
  }, []);

  // 목록이 그려진 커밋 직후(=브라우저가 화면을 칠하기 전)에 딱 한 번 좌표 복원
  useIsoLayoutEffect(() => {
    if (pendingScrollRef.current === null || regularJobs.length === 0) return;
    window.scrollTo(0, pendingScrollRef.current);
    pendingScrollRef.current = null;
  });

  // 페이지네이션 변경 시 상단으로 스크롤
  useEffect(() => {
    if (isPaginationChange) {
      window.scrollTo(0, 0);
      setIsPaginationChange(false);
    }
  }, [isPaginationChange]);

  useEffect(() => {
    if (!router.isReady) return;

    // console.log('Router is ready. Current query:', router.query);

    const { city1, city2, cate1, cate2, keyword, page, board_type, searchType } = router.query;

    // board_type 변경 시 기존 데이터와 필터 초기화
    const newBoardType = board_type as string || '0';

    // 뒤로가기 스냅샷으로 이미 같은 URL의 목록을 복원했다면
    // 필터·페이지 상태만 URL 에 맞춰두고 재조회는 건너뛴다(깜빡임·불필요한 조회 제거).
    if (restoredFromSnapshotRef.current) {
      restoredFromSnapshotRef.current = false;
      setFilters({
        city1: city1 as string || '',
        city2: city2 as string || '',
        cate1: cate1 as string || '',
        cate2: cate2 as string || '',
        keyword: keyword as string || '',
        searchType: (searchType as 'title' | 'contents' | 'both') || 'both'
      });
      setBoardType(newBoardType);
      setCurrentPage(page ? parseInt(page as string) : 1);
      return;
    }

    const isBoardTypeChanged = newBoardType !== boardType;

    if (isBoardTypeChanged) {
      setIsLoading(true);
      setRegularJobs([]);
      setAdJobs([]);
      setTotalPages(0);
      setTotalCount(0);
    }
    
    // board_type 변경 시 필터 초기화, 아니면 URL에서 필터 가져오기
    let newFilters = isBoardTypeChanged ? {
      city1: '',
      city2: '',
      cate1: '',
      cate2: '',
      keyword: '',
      searchType: 'both' as const
    } : {
      city1: city1 as string || '',
      city2: city2 as string || '',
      cate1: cate1 as string || '',
      cate2: cate2 as string || '',
      keyword: keyword as string || '',
      searchType: (searchType as 'title' | 'contents' | 'both') || 'both'
    };

    const newPage = isBoardTypeChanged ? 1 : (page ? parseInt(page as string) : 1);
    
    // console.log('Setting new filters:', newFilters);
    // console.log('Setting new board type:', newBoardType);
    // console.log('Setting new page:', newPage);

    setFilters(newFilters);
    setBoardType(newBoardType);
    setCurrentPage(newPage);
    fetchJobs(newFilters, newPage, newBoardType);
  }, [router.isReady, router.query, fetchJobs]);

  useEffect(() => {
    // 초기 로드 완료 표시
    if (isInitialLoad && regularJobs.length > 0) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, regularJobs.length]);

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

  // 지원(job_application) 데이터를 가져오는 함수
  const fetchBookmarks = useCallback(async () => {
    if (!isLoggedIn || !user) return;
    
    const { data, error } = await supabase
      .from('job_application')
      .select('jd_id')
      .eq('users_id', user.id);
      
    if (data && !error) {
      setBookmarkedJobs(data.map((item: { jd_id: number }) => item.jd_id));
    }
  }, [isLoggedIn, user]);

  // 컴포넌트 마운트 시 북마크 데이터 가져오기
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // 북마크 상태 변경 시 현재 jobs의 북마크 상태만 업데이트 (재호출 없이)
  useEffect(() => {
    if (regularJobs.length > 0) {
      setRegularJobs(prev => prev.map(job => ({
        ...job,
        bookmarked: bookmarkedJobs.includes(job.id)
      })));
    }
    if (adJobs.length > 0) {
      setAdJobs(prev => prev.map(job => ({
        ...job,
        bookmarked: bookmarkedJobs.includes(job.id)
      })));
    }
  }, [bookmarkedJobs]);

  // 모달 닫기 핸들러 추가
  const handleCloseModal = () => {
    setShowModal(false);
  };

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
        <meta name="keywords" content="114114, 114114코리아, 114114korea, 114114kr, 114114구인구직, 조선동포, 교포, 재외동, 해외교포, 동포 구인구직, 일자리 정보, 구직자, 구인체, 경력직 채용, 구인구직, 기업 채용, 기 알바, 드림 구인구직, 무료 채용 공고, 아르바이트, 알바, 알바 구인구직, 월급, 일당, ��급, 채용 정보, 취업 정보, 직업 정보 제공, 지역별 구인구직, 헤드헌팅 비스, 신입 채용 공고, 포 취업, 동포 일자리" />
        <meta property="og:title" content="[114114KR.com] 외국인 특화 채용 플랫폼" />
        <meta property="og:description" content="외국인 채용, 가장 빠른 연결" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/board" />
        <meta property="og:image" content="https://114114kr.com/og-image.png" />
      </Head>

      <Header/>
      <MainMenu currentBoardType={boardType} />
      {boardType === '0' && (
        <>
          <MainCarousel
            images={[
              {
                src: '/banner_23030.png',
                mobileSrc: '/banner_23030_mo.png',
                action: 'navigate',
                navigateTo: '/jd/23030'
              }
            ]}
          />
        </>
      )}
      <div className={styles.layout} ref={contentRef}>
        <JobFilter
          boardType={boardType}
          filters={filters}
          onFilterChange={handleFilterChange}
          city2Options={city2Options}
          cate2Options={cate2Options}
        />

        <JobList
          jobs={regularJobs}
          adJobs={boardType === '0' ? [...partnerJobs.map(j => ({ ...j, ad: true as const })), ...adJobs] : adJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={handlePageChange}
          boardType={boardType}
          isLoading={isLoading}
        />
      </div>
      <Footer />
      {error && <div className={styles.error}>{error}</div>}
      <InstallPWA /> {/* PWA 설치 버튼 추가 */}
      <ScrollToTop /> {/* ScrollToTop 컴포넌트 추가 */}
      <WriteButton boardType={boardType} /> {/* 글쓰기 버튼 추가 */}
      
      {/* 긴급공지 모달 추가 */}
      {/* {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>[긴급공지] 서비스 전수 조사 안내</h2>
            <div className={styles.modalContent}>
              <p>안녕하세요, 운영자입니다.</p>
              <br />
              <p>더 좋은 서비스 경험을 위해 게시글에 대한 전수 조사를 하며, 불법 채용 공고 및 중복된 공고들을 줄이고자 합니다. 전수 조사기간 중 공고 열람 및 업로드는 불가능하오니 참고부탁드립니다.</p>
              <br />
              <p>[검수기간] 25년 1월 2일 기준 3~7일 소요</p>
              <p>[검수내용] 불법 채용 공고 및 중복된 공고</p>
              <br />
              <p><a href="https://www.114114kr.com/jd/3323" target="_blank" rel="noopener noreferrer">자세히 보러가기</a></p>
              <br />
              <p>감사합니다.</p>
            </div>
            <button className={styles.modalCloseButton} onClick={handleCloseModal}>
              닫기
            </button>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default BoardPage;
