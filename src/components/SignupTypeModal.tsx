import React from 'react';
import Link from 'next/link';
import { FaChevronDown } from 'react-icons/fa';
import styles from '@/styles/SignupTypeModal.module.css';

export type SignupUserType = 'jobseeker' | 'business';

interface SignupTypeModalProps {
  onClose: () => void;
  onSelect: (type: SignupUserType) => void;
}

const SignupTypeModal: React.FC<SignupTypeModalProps> = ({ onClose, onSelect }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          ×
        </button>

        <div className={styles.logoSection}>
          <Link href="/board" className={styles.logo}>
            <span className={styles.logoChar} style={{ animationDelay: '0ms' }}>1</span>
            <span className={styles.logoChar} style={{ animationDelay: '50ms' }}>1</span>
            <span className={styles.logoChar} style={{ animationDelay: '100ms' }}>4</span>
            <span className={styles.logoChar} style={{ animationDelay: '150ms' }}>1</span>
            <span className={styles.logoChar} style={{ animationDelay: '200ms' }}>1</span>
            <span className={styles.logoChar} style={{ animationDelay: '250ms' }}>4</span>
            <span className={styles.logoSuffix}>KR</span>
            <span className={styles.logoDomain}>.com</span>
          </Link>
          <p className={styles.tagline}>외국인 특화 채용 플랫폼</p>
        </div>

        <p className={styles.subText}>
          <span>10초만에 빠르게 가입하기</span>
          <span className={styles.downIndicator} aria-hidden>
            <FaChevronDown />
          </span>
        </p>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.btnJobseeker}`}
            onClick={() => onSelect('jobseeker')}
          >
            <img src="/images/jobseeker-icon.png" alt="" className={styles.btnIcon} aria-hidden />
            개인회원으로 시작하기
          </button>
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.btnBusiness}`}
            onClick={() => onSelect('business')}
          >
            <img src="/images/business-icon.png" alt="" className={styles.btnIcon} aria-hidden />
            기업회원으로 시작하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignupTypeModal;
