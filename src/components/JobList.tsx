import React from 'react';
import Link from 'next/link';
import styles from '@/styles/JobList.module.css';
import { parseISO, format, subHours } from 'date-fns';
import Pagination from './Pagination';

interface Job {
  id: number;
  created_at: string;
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

const JobList: React.FC<JobListProps> = ({ jobs, adJobs, currentPage, totalPages, onPageChange }) => {
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
  };  

  // 광고 작업은 첫 페이지에만 표시
  const showAdJobs = currentPage === 1;

  return (
    <div className={styles.layout}>
      <section className={styles.mainList}>
        {/* 광고 섹션 - 첫 페이지에만 표시 */}
        {showAdJobs && adJobs.length > 0 && (
          <ul className={`${styles.listWrap} ${styles.listText} ${styles.topArea}`}>
            <div className={styles.topDiv}>
              <span className={styles.topTitle}>TOP광고</span>
              <a href="javascript:popup('ad');" className={styles.btnTop}>등록안내</a>
            </div>
            {adJobs.map(job => (
              <li key={`ad-${job.id}`}>
                <span className={styles.time}>{formatDate(job.created_at)}</span>
                <p className={styles.title}>
                  <Link href={`/JobDetailPage/${job.id}`}>
                    {job.title}
                  </Link>
                  <em>({job['1depth_region']} {job['2depth_region']}) - {job['1depth_category']} {job['2depth_category']}</em>
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* 기존 일반 구인 리스트 */}
        <ul className={`${styles.listWrap} ${styles.listText}`}>
          {jobs.map(job => (
            <li key={job.id}>
              <span className={styles.time}>{formatDate(job.created_at)}</span>
              <p className={styles.title}>
                <Link href={`/JobDetailPage/${job.id}`}>
                  {job.title}
                </Link>
                <em>({job['1depth_region']} {job['2depth_region']}) - {job['1depth_category']} {job['2depth_category']}</em>
              </p>
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
    </div>
  );
};

export default JobList;
