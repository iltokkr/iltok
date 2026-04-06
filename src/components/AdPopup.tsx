import React from 'react';
import styles from '@/styles/AdPopup.module.css';

interface AdPopupProps {
  onClose: () => void;
}

const AdPopup: React.FC<AdPopupProps> = ({ onClose }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popWrap} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popbox}>
          <div className={styles.header}>
            <h2 className={styles.title}>프리미엄 채용정보 등록 안내</h2>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
          
          <div className={styles.infoSection}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>상품내용</span>
              <span className={styles.infoValue}><strong>프리미엄 채용정보 영역 게시글 상위 노출</strong></span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>상품금액</span>
              <span className={styles.infoValue}>30일 / 22만원 (VAT포함)</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>계좌번호</span>
              <span className={styles.infoValue}>국민은행 630301-01-270341</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>입금자명</span>
              <span className={styles.infoValue}>주식회사 일톡</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>등록절차</span>
              <div className={styles.stepFlow}>
                <div className={styles.stepItem}>
                  <span className={styles.stepBadge}>①</span>
                  <span className={styles.stepText}>공고 등록</span>
                </div>
                <span className={styles.stepArrow}>→</span>
                <div className={styles.stepItem}>
                  <span className={styles.stepBadge}>②</span>
                  <span className={styles.stepText}>입금</span>
                </div>
                <span className={styles.stepArrow}>→</span>
                <div className={styles.stepItem}>
                  <span className={styles.stepBadge}>③</span>
                  <span className={styles.stepText}>카카오톡으로 공고번호 · 이메일(계산서) 전송</span>
                </div>
              </div>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>등록문의</span>
              <a href="http://pf.kakao.com/_ywaMn" target="_blank" rel="noopener noreferrer" className={styles.linkValue}>
                카카오톡 문의하기
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdPopup;
