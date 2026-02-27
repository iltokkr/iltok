import React, { useState, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import { HiOutlineUser, HiOutlineLockClosed, HiOutlineDeviceMobile } from 'react-icons/hi';
import styles from '@/styles/LoginPopup.module.css';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';

// Supabase 클라이언트 초기화
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface LoginPopupProps {
  onClose: () => void;
  initialUserType?: 'business' | 'jobseeker';
}

const SAVED_BUSINESS_ID_KEY = 'iltok_saved_business_id';

const LoginPopup: React.FC<LoginPopupProps> = ({ onClose, initialUserType = 'business' }) => {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const userProfile = useContext(UserContext);
  const [userType, setUserType] = useState<'business' | 'jobseeker'>(initialUserType);
  const [businessLoginMode, setBusinessLoginMode] = useState<'phone' | 'password'>('phone');
  const [loginId, setLoginId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SAVED_BUSINESS_ID_KEY) || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [authNum, setAuthNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [rememberId, setRememberId] = useState(false);

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

      if (data.user) {
        if (isNewUser) {
          // 신규 사용자: users 테이블에 행 생성 (앱에서 필수)
          const { error: upsertError } = await supabase
            .from('users')
            .upsert(
              {
                id: data.user.id,
                number: formattedPhone,
                user_type: userType,
                policy_term: true,
              },
              { onConflict: 'id' }
            );
          if (upsertError) {
            console.error('신규 사용자 users 생성 오류:', upsertError);
            throw upsertError;
          }
        } else {
          // 기존 사용자: user_type만 업데이트
          await supabase
            .from('users')
            .update({ user_type: userType })
            .eq('id', data.user.id);
        }
      }

      // UserProvider가 user_type 갱신 전에 조회할 수 있으므로, 업데이트 후 강제 리프레시
      userProfile?.refreshUser?.();

      // 기존 회원: both면 기업회원 화면으로
      let redirectPath = '/my';
      if (data.user && !isNewUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', data.user.id)
          .maybeSingle();
        if (userData?.user_type === 'both') {
          redirectPath = '/my?section=ads';
        }
      }
      // user_type 갱신 반영을 위해 refresh 쿼리 추가 (my 페이지에서 재조회 트리거)
      redirectPath += redirectPath.includes('?') ? '&refresh=1' : '?refresh=1';

      onClose();
      router.push(redirectPath);
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

      // 아이디로 로그인: API로 user_id → email 조회 (RLS 때문에 직접 조회 불가)
      if (!input.includes('@')) {
        const res = await fetch('/api/login-email-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: input }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const hint = json?.hint;
          if (res.status === 404) {
            setError(hint || '등록되지 않은 아이디입니다.');
          } else {
            setError(hint ? `오류: ${hint}` : '로그인 처리 중 오류가 발생했습니다.');
          }
          return;
        }
        if (json?.email) {
          emailToUse = json.email;
        } else {
          setError('등록되지 않은 아이디입니다.');
          return;
        }
      }

      await auth.signInWithPassword(emailToUse, password);

      if (rememberId && loginId.trim()) {
        localStorage.setItem(SAVED_BUSINESS_ID_KEY, loginId.trim());
      } else {
        localStorage.removeItem(SAVED_BUSINESS_ID_KEY);
      }

      onClose();
      router.push('/my');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid') || msg.includes('credentials')) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError(msg || '아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.popWrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.popbox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.tit}>로그인</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {/* 개인회원 | 기업회원 탭 */}
          <div className={styles.userTypeSelector}>
            <button
              type="button"
              className={`${styles.userTypeBtn} ${userType === 'jobseeker' ? styles.userTypeActive : ''}`}
              onClick={() => { setUserType('jobseeker'); setError(null); setBusinessLoginMode('phone'); }}
            >
              <img src="/images/jobseeker-icon.png" alt="" className={styles.userTypeIcon} aria-hidden />
              개인회원
            </button>
            <button
              type="button"
              className={`${styles.userTypeBtn} ${userType === 'business' ? styles.userTypeActive : ''}`}
              onClick={() => { setUserType('business'); setError(null); }}
            >
              <img src="/images/business-icon.png" alt="" className={styles.userTypeIcon} aria-hidden />
              기업회원
            </button>
          </div>

          {userType === 'jobseeker' ? (
            /* 개인회원: 휴대폰 인증만 */
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>휴대폰 번호</label>
                <div className={styles.inputRow}>
                  <div className={styles.inputWrap}>
                    <HiOutlineDeviceMobile className={styles.inputIcon} />
                    <input
                      type="tel"
                      name="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      className={styles.inputAuth}
                      placeholder="01012345678"
                      maxLength={11}
                    />
                  </div>
                  <button onClick={handlePhoneSubmit} className={styles.btnPhone} disabled={loading}>
                    {loading ? '처리 중...' : '인증번호'}
                  </button>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>인증번호</label>
                <div className={styles.inputRow}>
                  <div className={styles.inputWrap}>
                    <HiOutlineLockClosed className={styles.inputIcon} />
                    <input
                      type="text"
                      name="auth_num"
                      value={authNum}
                      onChange={(e) => setAuthNum(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={styles.inputAuth}
                      placeholder="인증번호 6자리"
                      maxLength={6}
                    />
                  </div>
                  <button onClick={handleAuthSubmit} className={styles.btnPhone} disabled={loading}>
                    {loading ? '처리 중...' : '확인'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* 기업회원: 휴대폰 인증만 (아이디/비밀번호 숨김) */
            <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>휴대폰 번호</label>
                    <div className={styles.inputRow}>
                      <div className={styles.inputWrap}>
                        <HiOutlineDeviceMobile className={styles.inputIcon} />
                        <input
                          type="tel"
                          name="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          className={styles.inputAuth}
                          placeholder="01012345678"
                          maxLength={11}
                        />
                      </div>
                      <button onClick={handlePhoneSubmit} className={styles.btnPhone} disabled={loading}>
                        {loading ? '처리 중...' : '인증번호'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>인증번호</label>
                    <div className={styles.inputRow}>
                      <div className={styles.inputWrap}>
                        <HiOutlineLockClosed className={styles.inputIcon} />
                        <input
                          type="text"
                          name="auth_num"
                          value={authNum}
                          onChange={(e) => setAuthNum(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className={styles.inputAuth}
                          placeholder="인증번호 6자리"
                          maxLength={6}
                        />
                      </div>
                      <button onClick={handleAuthSubmit} className={styles.btnPhone} disabled={loading}>
                        {loading ? '처리 중...' : '확인'}
                      </button>
                    </div>
                  </div>
            </>
          )}
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default LoginPopup;
