import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '@/styles/JobList.module.css';
import { parseISO, format, subHours } from 'date-fns';
import Pagination from './Pagination';
import AdPopup from './AdPopup';
import { useReadPosts } from '@/hooks/useReadPosts';
import { useLanguage } from '@/hooks/useLanguage';
import { useRouter } from 'next/router';
import { Job, AdJob } from '@/types/job';

interface JobListProps {
  jobs: Job[];
  adJobs: AdJob[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  getDisplayText: (job: Job, type: 'title' | 'details') => string;
}

const JobList: React.FC<JobListProps> = ({ jobs, adJobs, currentPage, totalPages, onPageChange, getDisplayText }) => {
  const { markAsRead, isRead } = useReadPosts();
  const router = useRouter();
  const [showAdPopup, setShowAdPopup] = useState(false);

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
  };

  const handlePostClick = (postId: number) => {
    markAsRead(postId);
  };

  // 광고 작업은 첫 페이지에만 표시
  const showAdJobs = currentPage === 1;

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
