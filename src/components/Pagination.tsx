import React from 'react';
import styles from '@/styles/Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (newPage: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, pageCount, onPageChange }) => {
  const pagesPerSet = 6;
  const currentSet = Math.ceil(currentPage / pagesPerSet);
  const lastPageInCurrentSet = currentSet * pagesPerSet;
  const firstPageInCurrentSet = lastPageInCurrentSet - pagesPerSet + 1;

  const pageNumbers = [];
  for (let i = firstPageInCurrentSet; i <= Math.min(lastPageInCurrentSet, pageCount); i++) {
    pageNumbers.push(i);
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pageCount) {
      onPageChange(newPage);
    }
  };

  return (
    <div className={styles.pager}>
      <div className={styles.pages}>
        {currentPage > 1 && (
          <a
            className={styles.first}
            onClick={() => handlePageChange(1)}
          >
            &lt;&lt;
          </a>
        )}

        {currentPage > pagesPerSet && (
          <a
            className={styles.prev}
            onClick={() => handlePageChange(firstPageInCurrentSet - 1)}
          >
            &lt;
          </a>
        )}

        {pageNumbers.map((number) => (
          <a
            key={number}
            className={number === currentPage ? styles.current : ''}
            onClick={() => handlePageChange(number)}
          >
            {number}
          </a>
        ))}

        {pageCount > lastPageInCurrentSet && (
          <a
            className={styles.next}
            onClick={() => handlePageChange(lastPageInCurrentSet + 1)}
          >
            &gt;
          </a>
        )}

        {currentPage < pageCount && (
          <a
            className={styles.last}
            onClick={() => handlePageChange(pageCount)}
          >
            &gt;&gt;
          </a>
        )}
      </div>
    </div>
  );
};

export default Pagination;
