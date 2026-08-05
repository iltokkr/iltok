import React, { useState } from 'react';
import styles from '@/styles/AdPopup.module.css';

interface AdPopupProps {
  onClose: () => void;
}

type AdProduct = 'premium' | 'banner';

const AdPopup: React.FC<AdPopupProps> = ({ onClose }) => {
  const [product, setProduct] = useState<AdProduct>('premium');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popWrap} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popbox}>
          <div className={styles.header}>
            <h2 className={styles.title}>광고 등록 안내</h2>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>

          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={product === 'premium'}
              className={`${styles.tab} ${product === 'premium' ? styles.tabActive : ''}`}
              onClick={() => setProduct('premium')}
            >
              프리미엄 채용정보관
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={product === 'banner'}
              className={`${styles.tab} ${product === 'banner' ? styles.tabActive : ''}`}
              onClick={() => setProduct('banner')}
            >
              최상단 배너
            </button>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>상품내용</span>
              <span className={styles.infoValue}>
                {product === 'premium' ? (
                  <strong>프리미엄 채용정보 영역 게시글 상위 노출</strong>
                ) : (
                  <strong>메인 화면 최상단 배너 노출</strong>
                )}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>혜택</span>
              <span className={styles.infoValue}>
                {product === 'banner' && (
                  <span className={styles.benefitItem}>프리미엄 채용정보관 노출 포함</span>
                )}
                <span className={styles.benefitItem}>채용정보 상세 이미지 등록 가능</span>
                <span className={styles.infoNote}>
                  프리미엄 적용 후 공고 수정 화면에서 직접 올리실 수 있습니다.
                </span>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>상품금액</span>
              <span className={styles.infoValue}>
                {product === 'premium' ? '30일 / 22만원 (VAT포함)' : '30일 / 88만원 (VAT포함)'}
              </span>
            </div>
            {product === 'banner' && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>배너규격</span>
                <span className={styles.infoValue}>
                  PC 1281 × 231 · 모바일 1000 × 420
                  <span className={styles.infoNote}>
                    JPG · PNG, 2종 모두 필요합니다. 이미지를 보내주시면 등록해드립니다.
                  </span>
                </span>
              </div>
            )}
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
                {product === 'premium' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>①</span>
                      <span className={styles.stepText}>입금</span>
                    </div>
                    <span className={styles.stepArrow}>→</span>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>②</span>
                      <span className={styles.stepText}>카카오톡으로 배너 이미지 · 연결할 공고번호 · 이메일(계산서) 전송</span>
                    </div>
                    <span className={styles.stepArrow}>→</span>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>③</span>
                      <span className={styles.stepText}>확인 후 게시</span>
                    </div>
                  </>
                )}
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
