import React from 'react';
import styles from '@/styles/Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (newPage: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, pageCount, onPageChange }) => {
  const pageNumbers = [];
  for (let i = 1; i <= pageCount; i++) {
    pageNumbers.push(i);
  }

  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.pager}>
      <div className={styles.pages}>
        {pageNumbers.map((number) => (
          <a
            key={number}
            className={number === currentPage ? styles.current : ''}
            onClick={() => handlePageChange(number)}
          >
            {number}
          </a>
        ))}
        {currentPage < pageCount && (
          <a
            className={styles.next}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            &gt;
          </a>
        )}
      </div>
    </div>
  );
};

export default Pagination;
