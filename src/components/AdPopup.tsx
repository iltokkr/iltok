import React, { useState, useContext } from 'react';
import styles from '@/styles/AdPopup.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';

// Supabase 클라이언트 초기화
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

interface AdPopupProps {
  onClose: () => void;
}

const AdPopup: React.FC<AdPopupProps> = ({ onClose }) => {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("AuthContext must be used within an AuthProvider");
  }

  const { user } = auth;

  const [vip, setVip] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 데이터베이스에 정보 저장
      const { data, error } = await supabase
        .from('ad')
        .insert([
          {
            name: vip,
            number: phone,
            user: user ? user.id : null,
          },
        ]);
      
      if (error) throw error;
      
      console.log('Data saved successfully:', data);
      onClose(); // 성공 시 팝업 닫기
    } catch (error) {
      console.error('Error submitting data:', error);
      // 에러 처리 로직 추가 (예: 사용자에게 알림)
    }
  };

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
                  <span className={styles.stepText}>카카오톡으로 공고번호 전송</span>
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

          <form onSubmit={handleSubmit} className={styles.formSection}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>입금자명</label>
              <input 
                type="text" 
                value={vip} 
                onChange={(e) => setVip(e.target.value)} 
                placeholder="입금자명을 입력하세요" 
                maxLength={20} 
                className={styles.textInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>휴대폰번호</label>
              <input 
                type="text" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="'-' 없이 입력하세요" 
                maxLength={11} 
                className={styles.textInput}
              />
            </div>

            <button type="submit" className={styles.submitBtn}>신청하기</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdPopup;
