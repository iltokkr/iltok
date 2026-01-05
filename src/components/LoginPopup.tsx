import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import styles from '@/styles/LoginPopup.module.css';

// Supabase 클라이언트 초기화
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface LoginPopupProps {
  onClose: () => void;
}

const LoginPopup: React.FC<LoginPopupProps> = ({ onClose }) => {
  const router = useRouter();
  const [userType, setUserType] = useState<'business' | 'individual'>('business');
  const [phone, setPhone] = useState('');
  const [authNum, setAuthNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [showResumePopup, setShowResumePopup] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const formatPhoneNumber = (phoneNumber: string) => {
    // 한국 번호 형식으로 변환 (예: 01012345678 -> +821012345678)
    if (phoneNumber.startsWith('0')) {
      return '+82' + phoneNumber.slice(1);
    }
    return phoneNumber;
  };

  const checkUserExists = async (formattedPhone: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('number')
      .eq('number', formattedPhone)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return !!data;
  };

  const handlePhoneSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const userExists = await checkUserExists(formattedPhone);
      setIsNewUser(!userExists);

      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      
      alert(userExists ? '로그인을 위한 인증번호가 전송되었습니다.' : '회원가입을 위한 인증번호가 전송되었습니다.');
    } catch (error) {
      console.error('OTP 요청 오류:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const { error, data } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: authNum,
        type: 'sms'
      });
      if (error) throw error;

      if (isNewUser && data.user) {
        // 신규 사용자 처리 - user_type 저장
        await supabase.from('users').upsert({
          id: data.user.id,
          number: formattedPhone,
          user_type: userType
        });
      }

      console.log(isNewUser ? '회원가입 성공:' : '로그인 성공:', data);
      
      // 구직자이고 신규 사용자인 경우 이력서 작성 팝업 표시
      if (userType === 'individual' && isNewUser) {
        // "다시 보지 않기" 체크 여부 확인
        const { data: userData } = await supabase
          .from('users')
          .select('hide_resume_popup')
          .eq('id', data.user?.id)
          .single();
        
        if (!userData?.hide_resume_popup) {
          setShowResumePopup(true);
          return;
        }
      }
      
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResumePopupClose = async () => {
    if (dontShowAgain) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .update({ hide_resume_popup: true })
          .eq('id', user.id);
      }
    }
    setShowResumePopup(false);
    onClose();
  };

  const handleWriteResume = async () => {
    if (dontShowAgain) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .update({ hide_resume_popup: true })
          .eq('id', user.id);
      }
    }
    setShowResumePopup(false);
    onClose();
    router.push('/write?board_type=1');
  };

  // 이력서 작성 권유 팝업
  if (showResumePopup) {
    return (
      <div className={styles.popWrap}>
        <div className={styles.resumePopbox}>
          <div className={styles.resumePopupContent}>
            <div className={styles.resumePopupIcon}>
              <img src="/icons/resume-complete-icon.svg" alt="" />
            </div>
            <h2 className={styles.resumePopupTitle}>사용자 인증이 완료 되었어요!</h2>
            <p className={styles.resumePopupText}>
              지금 바로 이력서를 작성하면,<br />
              기업들의 제안을 받아보세요
            </p>
            <div className={styles.resumePopupButtons}>
              <button className={styles.resumePopupCloseBtn} onClick={handleResumePopupClose}>
                닫기
              </button>
              <button className={styles.resumePopupWriteBtn} onClick={handleWriteResume}>
                이력서 작성
              </button>
            </div>
            <label className={styles.dontShowAgain}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span>다시 보지 않기</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.popWrap}>
      <div className={styles.popbox}>
        <input type="hidden" name="veri_num" id="veri_num" value="" />
        <div className={styles.title}>
          <div className={styles.tit}>휴대폰 인증</div>
          <div className={styles.close}>
            <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }}>X</a>
          </div>
        </div>
        
        {/* 회원 유형 선택 */}
        <div className={styles.userTypeSelector}>
          <button
            type="button"
            className={`${styles.userTypeBtn} ${userType === 'business' ? styles.userTypeActive : ''}`}
            onClick={() => setUserType('business')}
          >
            기업회원
          </button>
          <button
            type="button"
            className={`${styles.userTypeBtn} ${userType === 'individual' ? styles.userTypeActive : ''}`}
            onClick={() => setUserType('individual')}
          >
            구직자
          </button>
        </div>
        
        <div className={styles.notice}>
          <input
            type="tel"
            name="phone"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={styles.inputAuth}
            placeholder="전화번호를 입력해주세요"
            maxLength={11}
          />
          <button onClick={handlePhoneSubmit} className={styles.btnPhone} disabled={loading}>
            {loading ? '처리 중...' : '인증번호'}
          </button>
        </div>
        <div className={styles.notice}>
          <input
            type="number"
            name="auth_num"
            id="auth_num"
            value={authNum}
            onChange={(e) => setAuthNum(e.target.value)}
            className={styles.inputAuth}
            placeholder="인증번호를 입력해주세요"
            maxLength={6}
          />
          <button onClick={handleAuthSubmit} className={styles.btnAuthNum} disabled={loading}>
            {loading ? '처리 중...' : '확인'}
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
};

export default LoginPopup;
