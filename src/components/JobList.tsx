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

const JobList: React.FC<JobListProps> = ({ jobs, adJobs, currentPage, totalPages, onPageChange }) => {
  const { currentLanguage } = useTranslation();
  const { markAsRead, isRead } = useReadPosts();
  const previousJobsRef = useRef<string>('');
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
  };  

  // 광고 작업은 첫 페이지에만 표시
  const showAdJobs = currentPage === 1;

  const [showAdPopup, setShowAdPopup] = useState(false);

  const formatTitle = (job: Job) => {
    return (
      <>
        {job.title}
        <span className={styles.locationText}>
          ({job['1depth_region']} {job['2depth_region']})
        </span>
      </>
    );
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_type || !job.salary_detail) return null;
    
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

  return (
    <div className={styles.layout}>
      {/* 언어 선택 버튼 추가 */}

      <section className={styles.mainList}>
        {showAdJobs && adJobs.length > 0 && (
          <ul className={`${styles.listWrap} ${styles.listText} ${styles.topArea}`}>
            <div className={styles.topDiv}>
              <span className={styles.topTitle}>TOP광고</span>
              <a href="#" onClick={() => setShowAdPopup(true)} className={styles.btnTop}>등록안내</a>
            </div>
            {adJobs.map(job => (
              <li key={`ad-${job.id}`} className={`${styles.jobItem} ${isRead(job.id) ? styles.readPost : ''} ${!job.salary_type || !job.salary_detail ? 'no-salary' : ''}`}>
                <span className={styles.time}>{formatDate(job.updated_time)}</span>
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
            ))}
          </ul>
        )}

        <ul className={`${styles.listWrap} ${styles.listText}`}>
          {jobs.map(job => (
            <li key={job.id} className={`${styles.jobItem} ${isRead(job.id) ? styles.readPost : ''} ${!job.salary_type || !job.salary_detail ? 'no-salary' : ''}`}>
              <span className={styles.time}>{formatDate(job.updated_time)}</span>
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
