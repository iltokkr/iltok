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

      // user_type을 DB에 저장 (구직자로 선택한 경우)
      if (data.user && userType === 'jobseeker') {
        await supabase
          .from('users')
          .update({ user_type: 'jobseeker' })
          .eq('id', data.user.id);
      }

      // 구직자 선택 시 팝업 표시 여부 결정
      if (userType === 'jobseeker' && data.user) {
        // 이미 구직정보를 작성한 적이 있는지 확인
        const hasJobSeekerPost = await checkHasJobSeekerPost(data.user.id);
        
        if (!hasJobSeekerPost) {
          setShowResumePrompt(true);
          setLoading(false);
          return; // 팝업 표시 후 onClose 호출하지 않음
        }
      }

      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  const handleResumePromptClose = () => {
    setShowResumePrompt(false);
    onClose();
  };

  const handleWriteResume = () => {
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
            <img src="/images/resume-prompt-icon.png" alt="인증 완료" />
          </div>
          <h2 className={styles.resumePromptTitle}>
            이력서 작성을 시작해보세요!
          </h2>
          <div className={styles.resumePromptContent}>
            <p className={styles.resumePromptDesc}>
              이력서가 있으면 <strong className={styles.highlight}>2배</strong> 많은 연락을 받아요!
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
              이력서 작성하기
            </button>
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
