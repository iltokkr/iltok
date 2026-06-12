import React from 'react';
import styles from '@/styles/AcceptApprovedModal.module.css';

interface AcceptApprovedModalProps {
  onClose: () => void;
}

const AcceptApprovedModal: React.FC<AcceptApprovedModalProps> = ({ onClose }) => {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.iconWrap}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className={styles.title}>사업자 인증이 완료되었습니다.</h2>
        <p className={styles.message}>이제 채용공고가 리스트에 무료로 공개됩니다.</p>
        <button type="button" className={styles.confirmButton} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
};

export default AcceptApprovedModal;
