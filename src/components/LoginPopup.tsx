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
  const [phone, setPhone] = useState('');
  const [authNum, setAuthNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<'business' | 'jobseeker'>('business');
  const [showResumePrompt, setShowResumePrompt] = useState(false);
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

  // 구직정보 작성 이력 확인
  const checkHasJobSeekerPost = async (userId: string) => {
    const { data, error } = await supabase
      .from('jd')
      .select('id')
      .eq('uploader_id', userId)
      .eq('board_type', '1')
      .limit(1);
    
    if (error) {
      console.error('Error checking job seeker posts:', error);
      return false;
    }
    return data && data.length > 0;
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

      if (isNewUser) {
        // 신규 사용자 처리
        await supabase.from('profiles').insert({ phone: formattedPhone });
      }

      console.log(isNewUser ? '회원가입 성공:' : '로그인 성공:', data);
      console.log('userType:', userType);
      console.log('data.user:', data.user);

      // 구직자 선택 시 팝업 표시 여부 결정
      if (userType === 'jobseeker') {
        console.log('구직자 선택됨');
        
        if (data.user) {
          // localStorage에서 "다시 보지 않기" 설정 확인
          const hideResumePrompt = localStorage.getItem('hideResumePrompt');
          console.log('hideResumePrompt:', hideResumePrompt);
          
          if (hideResumePrompt !== 'true') {
            // 이미 구직정보를 작성한 적이 있는지 확인
            const hasJobSeekerPost = await checkHasJobSeekerPost(data.user.id);
            console.log('hasJobSeekerPost:', hasJobSeekerPost);
            
            if (!hasJobSeekerPost) {
              console.log('이력서 작성 팝업 표시');
              setShowResumePrompt(true);
              setLoading(false);
              return; // 팝업 표시 후 onClose 호출하지 않음
            }
          }
        }
      }

      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  const handleResumePromptClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideResumePrompt', 'true');
    }
    setShowResumePrompt(false);
    onClose();
  };

  const handleWriteResume = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideResumePrompt', 'true');
    }
    setShowResumePrompt(false);
    onClose();
    router.push('/write?board_type=1');
  };

  // 이력서 작성 유도 팝업
  if (showResumePrompt) {
    return (
      <div className={styles.popWrap}>
        <div className={styles.resumePromptBox}>
          <div className={styles.resumePromptImage}>
            <img src="/images/resume-prompt-icon.svg" alt="인증 완료" />
          </div>
          <h2 className={styles.resumePromptTitle}>
            인증이 완료 되었어요.
          </h2>
          <div className={styles.resumePromptContent}>
            <p className={styles.resumePromptSubtitle}>
              지금 바로 이력서를 작성해보세요!
            </p>
            <p className={styles.resumePromptDesc}>
              이력서를 작성 한 구직자는 2배 많은 연락을 받아요.
            </p>
          </div>
          <div className={styles.resumePromptButtons}>
            <button 
              className={styles.resumePromptCloseBtn}
              onClick={handleResumePromptClose}
            >
              닫기
            </button>
            <button 
              className={styles.resumePromptWriteBtn}
              onClick={handleWriteResume}
            >
              이력서 작성
            </button>
          </div>
          <label className={styles.resumePromptCheckbox}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            다시 보지 않기
          </label>
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
            <a href="#" onClick={onClose}>X</a>
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
            className={`${styles.userTypeBtn} ${userType === 'jobseeker' ? styles.userTypeActive : ''}`}
            onClick={() => setUserType('jobseeker')}
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
