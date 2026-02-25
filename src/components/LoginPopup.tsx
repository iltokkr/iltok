import React, { useState, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import styles from '@/styles/LoginPopup.module.css';
import { AuthContext } from '@/contexts/AuthContext';

// Supabase 클라이언트 초기화
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface LoginPopupProps {
  onClose: () => void;
  initialUserType?: 'business' | 'jobseeker';
}

const LoginPopup: React.FC<LoginPopupProps> = ({ onClose, initialUserType = 'business' }) => {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const [loginMode, setLoginMode] = useState<'phone' | 'password'>('password');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [authNum, setAuthNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<'business' | 'jobseeker'>(initialUserType);
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

      // user_type을 DB에 저장 (기업/구직자 선택에 따라)
      if (data.user) {
        await supabase
          .from('users')
          .update({ user_type: userType })
          .eq('id', data.user.id);
      }

      onClose();
      router.push('/my');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    if (!auth?.signInWithPassword) {
      setError('로그인 기능을 사용할 수 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const input = loginId.trim();
      let emailToUse = input;

      // 아이디로 로그인: users 테이블에서 user_id로 조회 후 email 사용 (Supabase Auth는 email 기반)
      if (!input.includes('@')) {
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('user_id', input)
          .maybeSingle();
        if (userData?.email) {
          emailToUse = userData.email;
        }
      }

      await auth.signInWithPassword(emailToUse, password);
      onClose();
      router.push('/my');
    } catch (err) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.popWrap}>
      <div className={styles.popbox}>
        <div className={styles.title}>
          <div className={styles.tit}>로그인</div>
          <div className={styles.close}>
            <a href="#" onClick={onClose}>X</a>
          </div>
        </div>

        {/* 로그인 방식 선택 */}
        <div className={styles.userTypeSelector}>
          <button
            type="button"
            className={`${styles.userTypeBtn} ${loginMode === 'password' ? styles.userTypeActive : ''}`}
            onClick={() => { setLoginMode('password'); setError(null); }}
          >
            아이디/비밀번호
          </button>
          <button
            type="button"
            className={`${styles.userTypeBtn} ${loginMode === 'phone' ? styles.userTypeActive : ''}`}
            onClick={() => { setLoginMode('phone'); setError(null); }}
          >
            휴대폰 인증
          </button>
        </div>

        {loginMode === 'password' ? (
          <>
            <div className={styles.notice}>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className={styles.inputAuth}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
              />
            </div>
            <div className={styles.notice}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.inputAuth}
                placeholder="비밀번호를 입력하세요"
              />
            </div>
            <button onClick={handlePasswordLogin} className={styles.btnAuthNum} disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </>
        ) : (
          <>
            <div className={styles.userTypeSelector} style={{ marginBottom: '10px' }}>
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
                type="text"
                name="auth_num"
                value={authNum}
                onChange={(e) => setAuthNum(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={styles.inputAuth}
            placeholder="인증번호를 입력해주세요"
            maxLength={6}
          />
          <button onClick={handleAuthSubmit} className={styles.btnAuthNum} disabled={loading}>
            {loading ? '처리 중...' : '확인'}
          </button>
            </div>
          </>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
};

export default LoginPopup;
