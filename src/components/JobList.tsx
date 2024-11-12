import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '@/styles/JobList.module.css';
import { parseISO, format, subHours } from 'date-fns';
import Pagination from './Pagination';
import AdPopup from './AdPopup';
import { useReadPosts } from '@/hooks/useReadPosts';
import { useLanguage } from '@/hooks/useLanguage';
import { useRouter } from 'next/router';

interface Job {
  id: number;
  updated_time: string;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
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
}

// 번역 함수 타입 정의
type TranslateFunction = (text: string, targetLang: string) => Promise<string>;

const JobList: React.FC<JobListProps> = ({ jobs, adJobs, currentPage, totalPages, onPageChange }) => {
  const { currentLanguage } = useLanguage();
  const { markAsRead, isRead } = useReadPosts();
  const [translatedTitles, setTranslatedTitles] = useState<{ [key: number]: string }>({});
  const [translatedDetails, setTranslatedDetails] = useState<{ [key: number]: string }>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const previousJobsRef = useRef<string>('');
  const router = useRouter();

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

  // 언어 변경 시 번역 실행
  useEffect(() => {
    const currentJobsString = JSON.stringify([...jobs, ...adJobs]);
    
    if (
      currentLanguage === 'ko' || 
      isTranslating || 
      (currentJobsString === previousJobsRef.current && Object.keys(translatedTitles).length > 0)
    ) {
      return;
    }

    const translateAllPosts = async () => {
      setIsTranslating(true);
      console.log('Starting translation to:', currentLanguage); // 디버깅용
      
      try {
        const allJobs = [...(currentPage === 1 ? adJobs : []), ...jobs];
        const newTitles = { ...translatedTitles };
        const newDetails = { ...translatedDetails };
        
        // 아직 번역되지 않은 게시물만 번역
        const untranslatedJobs = allJobs.filter(job => !newTitles[job.id]);
        
        if (untranslatedJobs.length > 0) {
          console.log(`Translating ${untranslatedJobs.length} jobs`); // 디버깅용
          
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
          console.log('Translation completed'); // 디버깅용
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
    jobs,
    adJobs,
    currentPage,
    translate,
    isTranslating,
    translatedTitles,
    translatedDetails
  ]);

  const formatJobDetails = useCallback((job: Job) => {
    return `(${job['1depth_region']} ${job['2depth_region']}) - ${job['1depth_category']}`;
  }, []);

  const getDisplayText = useCallback((job: Job, type: 'title' | 'details') => {
    if (currentLanguage === 'ko') {
      return type === 'title' ? job.title : formatJobDetails(job);
    }
    return type === 'title' 
      ? translatedTitles[job.id] || job.title 
      : translatedDetails[job.id] || formatJobDetails(job);
  }, [currentLanguage, translatedTitles, translatedDetails, formatJobDetails]);

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
  };  

  // 광고 작업은 첫 페이지에만 표시
  const showAdJobs = currentPage === 1;

  const [showAdPopup, setShowAdPopup] = useState(false);

  const handlePostClick = (postId: number) => {
    markAsRead(postId);
  };

  return (
    <div className={styles.layout}>
      <section className={styles.mainList}>
        {showAdJobs && adJobs.length > 0 && (
          <ul className={`${styles.listWrap} ${styles.listText} ${styles.topArea}`}>
            <div className={styles.topDiv}>
              <span className={styles.topTitle}>TOP광고</span>
              <a href="#" onClick={() => setShowAdPopup(true)} className={styles.btnTop}>등록안내</a>
            </div>
            {adJobs.map(job => (
              <li key={`ad-${job.id}`} className={`${styles.jobItem} ${isRead(job.id) ? styles.readPost : ''}`}>
                <span className={styles.time}>{formatDate(job.updated_time)}</span>
                <div className={styles.jobContent}>
                  <p className={styles.title}>
                    <Link href={`/jd/${job.id}`} onClick={() => handlePostClick(job.id)}>
                      {getDisplayText(job, 'title')}
                    </Link>
                  </p>
                  <p className={styles.jobDetails}>
                    {getDisplayText(job, 'details')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ul className={`${styles.listWrap} ${styles.listText}`}>
          {jobs.map(job => (
            <li key={job.id} className={`${styles.jobItem} ${isRead(job.id) ? styles.readPost : ''}`}>
              <span className={styles.time}>{formatDate(job.updated_time)}</span>
              <div className={styles.jobContent}>
                <p className={styles.title}>
                  <Link href={`/jd/${job.id}`} onClick={() => handlePostClick(job.id)}>
                    {getDisplayText(job, 'title')}
                  </Link>
                </p>
                <p className={styles.jobDetails}>
                  {getDisplayText(job, 'details')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      
      {/* Replace the existing pagination with the new Pagination component */}
      <Pagination
        currentPage={currentPage}
        pageCount={totalPages}
        onPageChange={onPageChange}
      />

      {showAdPopup && <AdPopup onClose={() => setShowAdPopup(false)} />}
    </div>
  );
};

export default JobList;
