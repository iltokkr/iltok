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
  community_tag?: string;
}

interface AdJob extends Job {
  ad: true;
}

interface JobListProps {
  jobs: Job[];
  adJobs: AdJob[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  boardType: string;
}

const JobList: React.FC<JobListProps> = ({ jobs, adJobs, currentPage, totalPages, onPageChange, boardType }) => {
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

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
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
    if (!isNaN(Number(job.salary_detail))) {
      const salaryNum = Number(job.salary_detail);
      if (salaryNum >= 100000) {
        formattedSalary = `${Math.floor(salaryNum / 10000)}만`;
      }
    }
    
    return (
      <span className={styles.salaryInfo}>
        <span className={styles.salaryType}>{job.salary_type}</span>
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

  const renderJobItem = (job: Job, isAd = false) => (
    <li key={`${isAd ? 'ad-' : ''}${job.id}`} className={`${styles.jobItem} ${isRead(job.id) ? styles.readPost : ''} ${!job.salary_type || !job.salary_detail ? 'no-salary' : ''}`}>
      <span className={styles.time}>{formatDate(job.updated_time)}</span>
      <div 
        className={styles.bookmarkContainer}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleBookmark(job.id);
        }}
      >
        {bookmarkedJobs.includes(job.id) ? 
          <BsHeartFill className={styles.filledBookmark} /> : 
          <BsHeart className={styles.emptyBookmark} />
        }
        <span className={styles.bookmarkCount}>
          {bookmarkCounts[job.id] || 0}
        </span>
      </div>
      <div className={styles.jobContent}>
        <p className={styles.title}>
          <Link href={`/jd/${job.id}`} onClick={() => handlePostClick(job.id)}>
            {formatTitle(job)}
          </Link>
        </p>
        <p className={styles.jobDetails}>
          {formatJobDetails(job)}
        </p>
      </div>
    </li>
  );

  const sliderSettings = {
    dots: false,
    infinite: false,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
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
          slidesToShow: 1,
        }
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
        }
      }
    ]
  };

  const renderHotItem = (job: Job) => (
    <div key={job.id} className={styles.hotItem}>
      <div className={styles.hotTag}>{job.community_tag || '공지'}</div>
      <Link href={`/jd/${job.id}`} onClick={() => handlePostClick(job.id)}>
        <div className={styles.hotContent}>
          <h3 className={styles.hotTitle}>
            {job.title}
          </h3>
          <div className={styles.hotFooter}>
            <span className={styles.time}>{formatDate(job.updated_time)}</span>
            <div 
              className={styles.bookmarkContainer}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBookmark(job.id);
              }}
            >
              {bookmarkedJobs.includes(job.id) ? 
                <BsHeartFill className={styles.filledBookmark} /> : 
                <BsHeart className={styles.emptyBookmark} />
              }
              <span className={styles.bookmarkCount}>
                {bookmarkCounts[job.id] || 0}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );

  return (
    <div className={styles.layout} data-board-type={boardType}>
      {boardType === '4' && (
        <div className={styles.hotSection}>
          <h2 className={styles.hotSectionTitle}>실시간 HOT 게시글</h2>
          <div className={styles.hotContainer}>
            <Slider {...sliderSettings}>
              {jobs
                .filter(job => job.community_tag)
                .slice(0, 8)
                .map(job => renderHotItem(job))}
            </Slider>
          </div>
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

        <ul className={`${styles.listWrap} ${styles.listText}`}>
          {jobs.map(job => renderJobItem(job))}
        </ul>
      </section>
      
      {/* Replace the existing pagination with the new Pagination component */}
      <Pagination
        currentPage={currentPage}
        pageCount={totalPages}
        onPageChange={onPageChange}
      />

      {showAdPopup && <AdPopup onClose={() => setShowAdPopup(false)} />}
      {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
    </div>
  );
};

export default JobList;
