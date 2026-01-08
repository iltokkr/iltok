import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '@/styles/JobList.module.css';
import { parseISO, format, subHours } from 'date-fns';
import Pagination from './Pagination';
import AdPopup from './AdPopup';
import { useReadPosts } from '@/hooks/useReadPosts';
import { useLanguage } from '@/hooks/useLanguage';
import { useRouter } from 'next/router';
import { useTranslation } from '@/contexts/TranslationContext';
import { event } from '@/lib/gtag';
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js'
import { BsHeart, BsHeartFill } from 'react-icons/bs';
import { HiLocationMarker } from 'react-icons/hi';
import { toast } from 'react-hot-toast';
import LoginPopup from './LoginPopup';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Job {
  id: number;
  updated_time: string;
  title: string;
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
  bookmark_count?: number;
  comment_count?: number;
  view_count?: number;
  popularity_score?: number;
  community_tag?: string;
  is_urgent?: boolean;
  is_day_pay?: boolean;
  // 구직정보 필드
  korean_name?: string;
  seeker_gender?: string;
  birth_date?: string;
  nationality?: string;
  visa_status?: string;
  desired_regions?: string;
  work_conditions?: string;
  career_history?: string;
}

interface AdJob extends Job {
  ad: true;
}

interface JobListProps {
  jobs: Job[];
  adJobs: AdJob[];
  currentPage: number;
  totalPages: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
  boardType: string;
  isLoading?: boolean;
}

const JobList: React.FC<JobListProps> = ({ jobs, adJobs, currentPage, totalPages, totalCount = 0, onPageChange, boardType, isLoading = false }) => {
  const { currentLanguage } = useTranslation();
  const { markAsRead, isRead } = useReadPosts();
  const previousJobsRef = useRef<string>('');
  const router = useRouter();
  const auth = useContext(AuthContext);
  
  // AuthContext가 없는 경우 에러 처리
  if (!auth) throw new Error("AuthContext not found");
  
  const { user, isLoggedIn } = auth;
  const [bookmarkedJobs, setBookmarkedJobs] = useState<number[]>([]);
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<number, number>>({});
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  
  // 구직정보 등록 여부 및 CTA 숨김 상태
  const [hasJobSeekerPost, setHasJobSeekerPost] = useState(false);
  const [hideResumeCta, setHideResumeCta] = useState(false);

  // localStorage에서 CTA 숨김 상태 확인
  useEffect(() => {
    const hidden = localStorage.getItem('hideResumeCta');
    if (hidden === 'true') {
      setHideResumeCta(true);
    }
  }, []);

  // 사용자가 구직정보를 등록했는지 확인
  useEffect(() => {
    const checkJobSeekerPost = async () => {
      if (!isLoggedIn || !user) return;
      
      const { data, error } = await supabase
        .from('jd')
        .select('id')
        .eq('user_id', user.id)
        .eq('board_type', '1')
        .limit(1);
        
      if (data && data.length > 0 && !error) {
        setHasJobSeekerPost(true);
      }
    };

    checkJobSeekerPost();
  }, [isLoggedIn, user]);

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!isLoggedIn || !user) return;
      
      const { data, error } = await supabase
        .from('bookmark')
        .select('jd_id')
        .eq('users_id', user.id);
        
      if (data && !error) {
        setBookmarkedJobs(data.map(bookmark => bookmark.jd_id));
      }
    };

    fetchBookmarks();
  }, [isLoggedIn, user]);

  const fetchBookmarkCounts = async () => {
    const { data, error } = await supabase
      .from('bookmark')
      .select('jd_id');

    if (data && !error) {
      // 각 job_id별로 북마크 수를 계산
      const counts = data.reduce((acc, item) => {
        acc[item.jd_id] = (acc[item.jd_id] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      console.log('Bookmark counts:', counts); // 디버깅용
      setBookmarkCounts(counts);
    }
  };

  useEffect(() => {
    fetchBookmarkCounts();
  }, []);

  // 기존 날짜 형식 (구인/구직정보용) - MM-dd
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
  };

  // 상대 시간 형식 (자유게시판용) - 몇분전, 몇시간전
  const formatRelativeTime = (dateString: string) => {
    const date = parseISO(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}분 전`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}시간 전`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}일 전`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months}달 전`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years}년 전`;
    }
  };  

  // 광고 작업은 첫 페이지에만 표시
  const showAdJobs = currentPage === 1;

  const [showAdPopup, setShowAdPopup] = useState(false);

  const formatTitle = (job: Job) => {
    if (boardType === '4') {
      return (
        <span className={styles.titleText}>
          {job.title}
          {job.comment_count !== undefined && job.comment_count > 0 && (
            <span className={styles.commentCount}>
              [{job.comment_count}]
            </span>
          )}
        </span>
      );
    }
    return (
      <span className={styles.titleText}>
        {job.title}
        <span className={styles.locationText}>
          {` (${job['1depth_region']} ${job['2depth_region']})`}
        </span>
      </span>
    );
  };

  const formatSalary = (job: Job) => {
    if (boardType === '4' || boardType !== '0' || !job.salary_type || !job.salary_detail) return null;
    
    let formattedSalary = job.salary_detail;
    // DB에 콤마가 포함된 경우 제거 후 숫자로 변환
    const salaryNum = Number(job.salary_detail.replace(/,/g, ''));
    
    if (!isNaN(salaryNum)) {
      switch (job.salary_type) {
        case '시급':
          // 시급은 그대로 표시 (콤마 추가)
          formattedSalary = salaryNum.toLocaleString();
          break;
        case '일급':
          // 일급은 백원단위 절삭 (12만7천 형식)
          if (salaryNum >= 10000) {
            const man = Math.floor(salaryNum / 10000);
            const cheon = Math.floor((salaryNum % 10000) / 1000);
            if (cheon > 0) {
              formattedSalary = `${man}만${cheon}천`;
            } else {
              formattedSalary = `${man}만`;
            }
          } else if (salaryNum >= 1000) {
            formattedSalary = `${Math.floor(salaryNum / 1000)}천`;
          } else {
            formattedSalary = salaryNum.toLocaleString();
          }
          break;
        case '주급':
          // 주급도 일급과 동일하게 처리
          if (salaryNum >= 10000) {
            const man = Math.floor(salaryNum / 10000);
            const cheon = Math.floor((salaryNum % 10000) / 1000);
            if (cheon > 0) {
              formattedSalary = `${man}만${cheon}천`;
            } else {
              formattedSalary = `${man}만`;
            }
          } else if (salaryNum >= 1000) {
            formattedSalary = `${Math.floor(salaryNum / 1000)}천`;
          } else {
            formattedSalary = salaryNum.toLocaleString();
          }
          break;
        case '월급':
          // 월급은 천원단위 절삭 (313만 형식)
          if (salaryNum >= 10000) {
            formattedSalary = `${Math.floor(salaryNum / 10000)}만`;
          } else if (salaryNum >= 1000) {
            formattedSalary = `${Math.floor(salaryNum / 1000)}천`;
          } else {
            formattedSalary = salaryNum.toLocaleString();
          }
          break;
        default:
          formattedSalary = salaryNum.toLocaleString();
      }
    }

    // 급여 유형별 CSS 클래스 결정
    const getSalaryTypeClass = (salaryType: string) => {
      switch (salaryType) {
        case '시급': return styles.hourly;
        case '일급': return styles.daily;
        case '주급': return styles.weekly;
        case '월급': return styles.monthly;
        case '협의': return styles.negotiable;
        default: return '';
      }
    };
    
    return (
      <span className={styles.salaryInfo}>
        <span className={`${styles.salaryType} ${getSalaryTypeClass(job.salary_type)}`}>{job.salary_type}</span>
        {' '}
        <span className={styles.salaryDetail}>{formattedSalary}</span>
      </span>
    );
  };

  const formatJobDetails = (job: Job) => {
    const salary = formatSalary(job);
    
    return (
      <div className={styles.detailsContainer}>
        {salary && salary}
      </div>
    );
  };

  const handlePostClick = (postId: number) => {
    markAsRead(postId);
  };

  const handleAdGuideClick = (e: React.MouseEvent) => {
    e.preventDefault();
    event({
      action: 'click_ad_guide',
      category: 'job_list',
      label: 'top_ad_guide_button'
    });
    setShowAdPopup(true);
  };

  // CTA 다시 보지 않기
  const handleCloseResumeCta = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem('hideResumeCta', 'true');
    setHideResumeCta(true);
  };

  const handleBookmark = async (jobId: number) => {
    if (!isLoggedIn || !user) {
      setShowLoginPopup(true);
      return;
    }

    try {
      if (bookmarkedJobs.includes(jobId)) {
        // Remove bookmark
        const { error: deleteError } = await supabase
          .from('bookmark')
          .delete()
          .eq('users_id', user.id)
          .eq('jd_id', jobId);

        if (deleteError) throw deleteError;
        
        setBookmarkedJobs(prev => prev.filter(id => id !== jobId));
        setBookmarkCounts(prev => ({
          ...prev,
          [jobId]: (prev[jobId] || 1) - 1
        }));
        toast.success(currentLanguage === 'ko' 
          ? '북마크가 해제되었습니다.' 
          : 'Bookmark removed');
      } else {
        // Add bookmark
        const { data, error: insertError } = await supabase
          .from('bookmark')
          .insert([
            {
              users_id: user.id,
              jd_id: jobId
            }
          ])
          .select();

        if (insertError) throw insertError;
        
        if (data && data.length > 0) {
          setBookmarkedJobs(prev => [...prev, jobId]);
          setBookmarkCounts(prev => ({
            ...prev,
            [jobId]: (prev[jobId] || 0) + 1
          }));
          toast.success(currentLanguage === 'ko' 
            ? '북마크에 추가되었습니다.' 
            : 'Bookmark added');
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error(currentLanguage === 'ko' 
        ? '북마크 처리 중 오류가 발생했습니다.' 
        : 'Error processing bookmark');
    }
  };

  // 내용 미리보기 생성 (최대 50자)
  const getContentPreview = (contents?: string) => {
    if (!contents) return '';
    const cleaned = contents.replace(/\n/g, ' ').trim();
    return cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned;
  };

  // 이름 마스킹 (김민혁 -> 김**)
  const maskName = (name?: string) => {
    if (!name || name.length === 0) return '이름없음';
    if (name.length === 1) return name;
    return name[0] + '**';
  };

  // 만 나이 계산
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const [year, month, day] = birthDate.split('-').map(Number);
    if (!year) return null;
    
    const today = new Date();
    const birth = new Date(year, (month || 1) - 1, day || 1);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 경력 총 기간 계산
  const calculateTotalCareer = (careerHistory?: string) => {
    if (!careerHistory) return null;
    try {
      const careers = JSON.parse(careerHistory);
      if (!Array.isArray(careers) || careers.length === 0) return null;
      
      let totalMonths = 0;
      careers.forEach((career: any) => {
        const years = parseInt(career.duration_years) || 0;
        const months = parseInt(career.duration_months) || 0;
        totalMonths += (years * 12) + months;
      });
      
      if (totalMonths === 0) return null;
      
      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;
      
      if (years > 0 && months > 0) {
        return `${years}년 ${months}개월`;
      } else if (years > 0) {
        return `${years}년`;
      } else {
        return `${months}개월`;
      }
    } catch (e) {
      return null;
    }
  };

  // 희망지역 파싱
  const parseDesiredRegions = (regions?: string) => {
    if (!regions) return [];
    try {
      return JSON.parse(regions);
    } catch (e) {
      return [];
    }
  };

  // 희망근무조건 파싱
  const parseWorkConditions = (conditions?: string) => {
    if (!conditions) return [];
    try {
      return JSON.parse(conditions);
    } catch (e) {
      return [];
    }
  };

  // 구직정보 아이템 렌더링
  const renderJobSeekerItem = (job: Job) => {
    const age = calculateAge(job.birth_date);
    const totalCareer = calculateTotalCareer(job.career_history);
    const desiredRegions = parseDesiredRegions(job.desired_regions);
    const workConditions = parseWorkConditions(job.work_conditions);
    
    return (
      <li key={job.id} className={`${styles.jobSeekerItem} ${isRead(job.id) ? styles.readPost : ''}`}>
        <Link href={`/jd/${job.id}`} scroll={false} onClick={() => handlePostClick(job.id)}>
          <div className={styles.jobSeekerContent}>
            {/* 메인 정보 */}
            <div className={styles.jobSeekerMain}>
              {/* 타이틀 (제목) + 구직 태그 */}
              <h3 className={styles.jobSeekerTitle}>
                <span className={`${styles.communityTag} ${styles.jobSeekerTag}`}>구직</span>
                <span className={styles.jobSeekerTitleText}>{job.title}</span>
              </h3>
              
              {/* 상세내용 미리보기 */}
              {job.contents && (
                <p className={styles.jobSeekerPreview}>{getContentPreview(job.contents)}</p>
              )}
              
              {/* 1줄: 이름(마스킹) (국적, 성별, 나이) (비자) */}
              <div className={styles.jobSeekerLine1}>
                <span className={styles.jobSeekerName}>{maskName(job.korean_name)}</span>
                <span className={styles.jobSeekerBasicInfo}>
                  ({job.nationality || '한국'}, {job.seeker_gender === '남성' ? '남' : job.seeker_gender === '여성' ? '여' : '-'}{age ? `, 만 ${age}세` : ''})
                </span>
                {job.visa_status && job.visa_status !== '해당없음' && (
                  <span className={styles.jobSeekerVisa}>({job.visa_status})</span>
                )}
              </div>
              
              {/* 2줄: 희망업무 + 희망지역 */}
              <div className={styles.jobSeekerLine2}>
                {job['1depth_category'] && (
                  <span className={styles.jobSeekerCategory}>
                    <img src="/icons/category-icon.svg" alt="" className={styles.jobSeekerIcon} />
                    {job['1depth_category']}{job['2depth_category'] ? `, ${job['2depth_category']}` : ''}
                  </span>
                )}
                {desiredRegions.length > 0 && (
                  <span className={styles.jobSeekerRegion}>
                    <HiLocationMarker className={styles.jobSeekerIcon} />
                    {desiredRegions.slice(0, 2).join(', ')}{desiredRegions.length > 2 ? ` 외 ${desiredRegions.length - 2}곳` : ''}
                  </span>
                )}
              </div>
              
              {/* 3줄: 희망근무조건 (박스형태) + 게시시간 */}
              <div className={styles.jobSeekerLine3}>
                <div className={styles.jobSeekerConditions}>
                  {workConditions.slice(0, 5).map((condition: string, idx: number) => (
                    <span key={idx} className={styles.conditionTag}>{condition}</span>
                  ))}
                  {workConditions.length > 5 && (
                    <span className={styles.conditionMore}>+{workConditions.length - 5}</span>
                  )}
                </div>
                <span className={styles.jobSeekerTime}>{formatRelativeTime(job.updated_time)}</span>
              </div>
            </div>
          </div>
        </Link>
      </li>
    );
  };

  // 자유게시판용 아이템 렌더링
  const renderCommunityItem = (job: Job) => (
    <li key={job.id} className={`${styles.communityItem} ${isRead(job.id) ? styles.readPost : ''} ${job.community_tag === '공지' ? styles.noticeItem : ''}`}>
      <Link href={`/jd/${job.id}`} scroll={false} onClick={() => handlePostClick(job.id)}>
        <div className={styles.communityContent}>
          <h3 className={styles.communityTitle}>
            {boardType === '4' && (job.community_tag === '공지' || job.community_tag === '인기') && (
              <span className={`${styles.communityTag} ${job.community_tag === '공지' ? styles.noticeTag : styles.popularTag}`}>{job.community_tag}</span>
            )}
            {boardType === '4' && job.community_tag !== '공지' && job.community_tag !== '인기' && (
              <span className={`${styles.communityTag} ${styles.freeTag}`}>자유</span>
            )}
            <span className={styles.communityTitleText}>{job.title}</span>
          </h3>
          <p className={styles.communityPreview}>{getContentPreview(job.contents)}</p>
          <div className={styles.communityMeta}>
            <span className={styles.communityViews}>👁 {job.view_count || 0}</span>
            <span className={styles.communityComments}>💬 {job.comment_count || 0}</span>
            <span 
              className={`${styles.communityBookmark} ${bookmarkedJobs.includes(job.id) ? styles.bookmarked : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBookmark(job.id);
              }}
            >
              {bookmarkedJobs.includes(job.id) ? 
                <BsHeartFill className={styles.communityHeartIcon} /> : 
                <BsHeart className={styles.communityHeartIcon} />
              } {bookmarkCounts[job.id] || 0}
            </span>
            <span className={styles.communityTime}>
              {formatRelativeTime(job.updated_time)}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );

  // 일반 게시판용 아이템 렌더링
  const renderJobItem = (job: Job, isAd = false) => (
    <li key={`${isAd ? 'ad-' : ''}${job.id}`} className={`${styles.jobItem} ${isRead(job.id) ? styles.readPost : ''} ${!job.salary_type || !job.salary_detail ? 'no-salary' : ''} ${job.is_urgent ? styles.urgentItem : ''}`}>
      <span className={styles.time}>{formatDate(job.updated_time)}</span>
      <div className={styles.jobContent}>
        <p className={styles.title}>
          <Link href={`/jd/${job.id}`} scroll={false} onClick={() => handlePostClick(job.id)}>
            <span className={styles.titleText}>
              {boardType === '0' && job.is_urgent && (
                <span className={styles.urgentTag}>
                  <img src="/icons/urgent-fire.png" alt="긴급" className={styles.urgentIcon} />
                  긴급
                </span>
              )}
              {job.title}
              <span className={styles.locationText}>
                {` (${job['1depth_region']} ${job['2depth_region']})`}
              </span>
            </span>
          </Link>
        </p>
        <p className={styles.jobDetails}>
          {formatJobDetails(job)}
        </p>
      </div>
    </li>
  );

  // 인기글: 인기점수 기준 상위 3개 (공지 제외)
  const hotPosts = [...jobs]
    .filter(job => job.community_tag !== '공지')
    .sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0))
    .slice(0, 3);

  const sliderSettings = {
    dots: false,
    infinite: false,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    arrows: false,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1.3,
        }
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1.2,
        }
      }
    ]
  };

  // 모바일용 카드 형태
  const renderHotItem = (job: Job) => (
    <div key={job.id} className={styles.hotItem}>
      <Link href={`/jd/${job.id}`} scroll={false} onClick={() => handlePostClick(job.id)}>
        <div className={styles.hotContent}>
          <span className={styles.hotTag}>인기</span>
          <h3 className={styles.hotTitle}>
            {job.title}
          </h3>
          <p className={styles.hotPreview}>
            {job.contents ? job.contents.substring(0, 50) + (job.contents.length > 50 ? '...' : '') : '내용 없음'}
          </p>
          <div className={styles.hotFooter}>
            <span className={styles.hotViewCount}>👁 {job.view_count || 0}</span>
            <span className={styles.hotCommentCount}>💬 {job.comment_count || 0}</span>
            <span 
              className={`${styles.hotBookmarkCount} ${bookmarkedJobs.includes(job.id) ? styles.bookmarked : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBookmark(job.id);
              }}
            >
              {bookmarkedJobs.includes(job.id) ? 
                <BsHeartFill className={styles.hotHeartIcon} /> : 
                <BsHeart className={styles.hotHeartIcon} />
              } {bookmarkCounts[job.id] || 0}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );

  // PC용 리스트 형태
  const renderHotListItem = (job: Job) => (
    <li key={job.id} className={styles.hotListItem}>
      <Link href={`/jd/${job.id}`} scroll={false} onClick={() => handlePostClick(job.id)}>
        <div className={styles.hotListContent}>
          <div className={styles.hotListHeader}>
            <span className={styles.hotListTag}>인기</span>
            <h3 className={styles.hotListTitle}>{job.title}</h3>
          </div>
          <p className={styles.hotListPreview}>
            {job.contents ? job.contents.substring(0, 80) + (job.contents.length > 80 ? '...' : '') : '내용 없음'}
          </p>
          <div className={styles.hotListFooter}>
            <div className={styles.hotListStats}>
              <span>👁 {job.view_count || 0}</span>
              <span>💬 {job.comment_count || 0}</span>
              <span>
                {bookmarkedJobs.includes(job.id) ? 
                  <BsHeartFill style={{color: '#ff6b6b'}} /> : 
                  <BsHeart />
                } {bookmarkCounts[job.id] || 0}
              </span>
              <span>{formatRelativeTime(job.updated_time)}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );

  return (
    <div className={styles.layout} data-board-type={boardType}>
      {boardType === '4' && hotPosts.length > 0 && (
        <div className={styles.hotSection}>
          <h2 className={styles.hotSectionTitle}>
            <img src="/fire-icon.png" alt="불" className={styles.fireIcon} />
            실시간 인기글
          </h2>
          {/* PC용 리스트 */}
          <ul className={styles.hotListContainer}>
            {hotPosts.map(job => renderHotListItem(job))}
          </ul>
          {/* 모바일용 슬라이더 */}
          <div className={styles.hotContainer}>
            <Slider {...sliderSettings}>
              {hotPosts.map(job => renderHotItem(job))}
            </Slider>
          </div>
        </div>
      )}

      {(boardType === '4' || boardType === '1') && (
        <div className={styles.totalCountSection}>
          <div className={styles.totalCountLeft}>
            <span className={styles.totalCountLabel}>{boardType === '1' ? '최신 인재정보' : '전체'}</span>
            <span className={styles.totalCountNumber}>총 {totalCount.toLocaleString()} 건</span>
          </div>
          {boardType === '1' && !hasJobSeekerPost && (
            <div className={styles.resumeCtaWrap}>
              <Link href="/write?board_type=1" className={styles.resumeCta}>
                1분만에 이력서 작성하기
              </Link>
              <span className={styles.resumeCtaSub}>회사가 일자리를 직접 찾아줘요!</span>
            </div>
          )}
        </div>
      )}

      <section className={styles.mainList}>
        {showAdJobs && adJobs.length > 0 && (
          <ul className={`${styles.listWrap} ${styles.listText} ${styles.topArea}`}>
            <div className={styles.topDiv}>
              <span className={styles.topTitle}>TOP광고</span>
              <a href="#" onClick={handleAdGuideClick} className={styles.btnTop}>등록안내</a>
            </div>
            {adJobs.map(job => renderJobItem(job, true))}
          </ul>
        )}

        {boardType === '0' && currentPage === 1 && !hasJobSeekerPost && !hideResumeCta && (
          <div className={styles.resumeCtaBanner}>
            <button 
              className={styles.resumeCtaClose}
              onClick={handleCloseResumeCta}
              aria-label="다시 보지 않기"
            >
              ✕
            </button>
            <Link href="/write?board_type=1" className={styles.resumeCtaBannerBtn}>
              1분만에 이력서 작성하기
            </Link>
            <span className={styles.resumeCtaBannerSub}>회사가 일자리를 직접 찾아줘요!</span>
          </div>
        )}

        <ul className={`${styles.listWrap} ${styles.listText} ${boardType === '4' ? styles.communityList : ''} ${boardType === '1' ? styles.jobSeekerList : ''}`}>
          {boardType === '4'
            ? jobs.map(job => renderCommunityItem(job))
            : boardType === '1'
            ? jobs.map(job => renderJobSeekerItem(job))
            : jobs.map(job => renderJobItem(job))
          }
        </ul>
      </section>
      
      {/* Replace the existing pagination with the new Pagination component */}
      {!isLoading && jobs.length > 0 && totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          pageCount={totalPages}
          onPageChange={onPageChange}
        />
      )}

      {showAdPopup && <AdPopup onClose={() => setShowAdPopup(false)} />}
      {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
    </div>
  );
};

export default JobList;
