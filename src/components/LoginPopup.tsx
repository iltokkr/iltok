import React, { useState, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import {
  HiOutlineUser,
  HiOutlineLockClosed,
  HiOutlineDeviceMobile,
  HiArrowLeft,
  HiOutlineMail,
  HiEye,
  HiEyeOff,
} from 'react-icons/hi';
import styles from '@/styles/LoginPopup.module.css';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface LoginPopupProps {
  onClose: () => void;
  initialUserType?: 'business' | 'jobseeker';
}

const SAVED_BUSINESS_ID_KEY = 'iltok_saved_business_id';
const ACTIVE_LOGIN_TYPE_KEY = 'iltok_active_login_type';

// 기업회원 로그인 단계
// password: 아이디/비번 로그인 (기본)
// phone:    휴대폰 OTP 입력 단계
// setup:    OTP 완료 후 아이디/이메일/비번 설정 단계
// forgot:   비밀번호 찾기
type BusinessMode = 'password' | 'phone' | 'setup' | 'forgot';

const LoginPopup: React.FC<LoginPopupProps> = ({ onClose, initialUserType = 'business' }) => {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const userProfile = useContext(UserContext);

  const [userType, setUserType] = useState<'business' | 'jobseeker'>(initialUserType);
  const [businessMode, setBusinessMode] = useState<BusinessMode>('password');

  // 아이디/비밀번호 로그인
  const [loginId, setLoginId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(SAVED_BUSINESS_ID_KEY) || '' : ''
  );
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(SAVED_BUSINESS_ID_KEY) : false
  );

  // 휴대폰 OTP
  const [phone, setPhone] = useState('');
  const [authNum, setAuthNum] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState(''); // OTP 인증 후 auth user id

  // 계정 설정 (setup 단계)
  const [setupUserId, setSetupUserId] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [showSetupPw, setShowSetupPw] = useState(false);
  const [showSetupPwConfirm, setShowSetupPwConfirm] = useState(false);

  // 비밀번호 찾기
  const [forgotInput, setForgotInput] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (p: string) =>
    p.startsWith('0') ? '+82' + p.slice(1) : p;

  const switchUserType = (type: 'business' | 'jobseeker') => {
    setUserType(type);
    setBusinessMode('password');
    setError(null);
    setOtpSent(false);
    setPhone('');
    setAuthNum('');
  };

  const switchBusinessMode = (mode: BusinessMode) => {
    setBusinessMode(mode);
    setError(null);
    setOtpSent(false);
    setPhone('');
    setAuthNum('');
    setForgotInput('');
    setForgotSent(false);
  };

  const headerTitle = () => {
    if (businessMode === 'forgot') return '비밀번호 찾기';
    if (businessMode === 'setup') return '로그인 정보 설정';
    if (businessMode === 'phone') return '휴대폰 인증';
    return '로그인';
  };

  // ─── 기업: 아이디/비밀번호 로그인 ────────────────────────────────
  const handlePasswordLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    if (!auth?.signInWithPassword) return;
    setLoading(true);
    setError(null);
    try {
      let emailToUse = loginId.trim();
      if (!emailToUse.includes('@')) {
        const res = await fetch('/api/login-email-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: emailToUse }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(res.status === 404 ? '등록되지 않은 아이디입니다.' : '로그인 처리 중 오류가 발생했습니다.');
          return;
        }
        if (!json?.email) { setError('등록되지 않은 아이디입니다.'); return; }
        emailToUse = json.email;
      }

      await auth.signInWithPassword(emailToUse, password);

      if (rememberId) localStorage.setItem(SAVED_BUSINESS_ID_KEY, loginId.trim());
      else localStorage.removeItem(SAVED_BUSINESS_ID_KEY);
      localStorage.setItem(ACTIVE_LOGIN_TYPE_KEY, 'business');

      onClose();
      router.push('/my');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('Invalid login') || msg.includes('invalid') || msg.includes('credentials')
          ? '아이디 또는 비밀번호가 올바르지 않습니다.'
          : msg || '로그인에 실패했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── 휴대폰 OTP 발송 ─────────────────────────────────────────────
  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);

      // 기업회원: 전환 완료 계정이면 OTP 차단
      if (userType === 'business') {
        const res = await fetch('/api/check-business-transition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formattedPhone }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
        if (json.isTransitioned) {
          setError('이 계정은 아이디 로그인으로 전환되었습니다.\n비밀번호를 모르시면 비밀번호 찾기를 이용해주세요.');
          return;
        }
      }

      const { data: existing } = await supabase
        .from('users').select('number').eq('number', formattedPhone).single();
      setIsNewUser(!existing);

      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP 인증 확인 ────────────────────────────────────────────────
  const handleAuthSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const { error, data } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: authNum,
        type: 'sms',
      });
      if (error) throw error;

      if (data.user) {
        if (isNewUser) {
          await supabase.from('users').upsert(
            { id: data.user.id, number: formattedPhone, user_type: userType, policy_term: true },
            { onConflict: 'id' }
          );
        }
      }

      userProfile?.refreshUser?.();

      // 기업회원: password_set 확인 → 미설정이면 setup 단계로
      if (userType === 'business' && data.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('password_set')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!userData?.password_set) {
          setVerifiedUserId(data.user.id);
          setBusinessMode('setup');
          setLoading(false);
          return;
        }
      }

      // 개인회원 or 이미 전환된 기업회원
      localStorage.setItem(ACTIVE_LOGIN_TYPE_KEY, userType === 'business' ? 'business' : 'jobseeker');
      // 개인 탭 로그인 → 항상 지원공고 섹션으로, 기업 탭 both 계정 → 공고관리 섹션으로
      let redirectPath = userType === 'jobseeker' ? '/my?section=applications' : '/my';
      if (userType === 'business' && data.user && !isNewUser) {
        const { data: userData } = await supabase
          .from('users').select('user_type').eq('id', data.user.id).maybeSingle();
        if (userData?.user_type === 'both') {
          redirectPath = '/my?section=ads';
        }
      }
      redirectPath += redirectPath.includes('?') ? '&refresh=1' : '?refresh=1';
      onClose();
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증에 실패했습니다.');
      setLoading(false);
    }
  };

  // ─── 계정 설정 완료 (아이디/이메일/비밀번호) ─────────────────────
  const handleSetupSubmit = async () => {
    if (!setupUserId.trim() || setupUserId.trim().length < 4) {
      setError('아이디는 4자리 이상으로 입력해주세요.');
      return;
    }
    if (!setupEmail.trim() || !setupEmail.includes('@')) {
      setError('올바른 이메일을 입력해주세요.');
      return;
    }
    if (!setupPassword || setupPassword.length < 8) {
      setError('비밀번호는 8자리 이상으로 입력해주세요.');
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup-business-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: verifiedUserId,
          user_id: setupUserId.trim(),
          email: setupEmail.trim(),
          password: setupPassword,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || '설정에 실패했습니다.');
        return;
      }
      onClose();
      router.push('/my?section=ads&welcome=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─── 비밀번호 찾기 ────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!forgotInput.trim()) {
      setError('아이디 또는 이메일을 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isEmail = forgotInput.includes('@');
      const res = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEmail ? { email: forgotInput.trim() } : { user_id: forgotInput.trim() }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || '오류가 발생했습니다.'); return; }
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const pwMatch = !!setupPasswordConfirm && setupPassword === setupPasswordConfirm;
  const pwMismatch = !!setupPasswordConfirm && setupPassword !== setupPasswordConfirm;

  // 비밀번호 유효성 체크
  const pwHas8 = setupPassword.length >= 8 && /[a-zA-Z]/.test(setupPassword) && /[0-9]/.test(setupPassword);
  const pwHasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(setupPassword);

  return (
    <div className={styles.popWrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.popbox} onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className={styles.header}>
          {userType === 'business' && businessMode !== 'password' && businessMode !== 'setup' ? (
            <button className={styles.backBtn} onClick={() => switchBusinessMode('password')}>
              <HiArrowLeft />
            </button>
          ) : <div style={{ width: 36 }} />}
          <h2 className={styles.tit}>{headerTitle()}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className={styles.body}>

          {/* 회원 유형 탭 - password 모드일 때만 표시 */}
          {businessMode === 'password' && (
            <div className={styles.userTypeSelector}>
              <button
                type="button"
                className={`${styles.userTypeBtn} ${userType === 'jobseeker' ? styles.userTypeActive : ''}`}
                onClick={() => switchUserType('jobseeker')}
              >
                <span className={styles.userTypMain}>
                  <img src="/images/jobseeker-icon.png" alt="" className={styles.userTypeIcon} aria-hidden />
                  개인회원
                </span>
                <span className={styles.userTypeEn}>job seeker(求职者)</span>
              </button>
              <button
                type="button"
                className={`${styles.userTypeBtn} ${userType === 'business' ? styles.userTypeActive : ''}`}
                onClick={() => switchUserType('business')}
              >
                <span className={styles.userTypMain}>
                  <img src="/images/business-icon.png" alt="" className={styles.userTypeIcon} aria-hidden />
                  기업회원
                </span>
                <span className={styles.userTypeEn}>employer(招聘方)</span>
              </button>
            </div>
          )}

          {/* ── 개인회원: 휴대폰 OTP ── */}
          {userType === 'jobseeker' && (
            <PhoneOtpForm
              phone={phone} authNum={authNum} otpSent={otpSent} loading={loading}
              onPhoneChange={setPhone} onAuthNumChange={setAuthNum}
              onSend={handlePhoneSubmit} onVerify={handleAuthSubmit}
              styles={styles}
            />
          )}

          {/* ── 기업: 아이디/비밀번호 로그인 (기본) ── */}
          {userType === 'business' && businessMode === 'password' && (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>아이디 또는 이메일</label>
                <div className={styles.inputWrap}>
                  <HiOutlineUser className={styles.inputIcon} />
                  <input
                    type="text" value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className={styles.inputAuth} placeholder="아이디 또는 이메일 입력"
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                  />
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>비밀번호</label>
                <div className={styles.inputWrap}>
                  <HiOutlineLockClosed className={styles.inputIcon} />
                  <input
                    type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.inputAuth} placeholder="비밀번호 입력"
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                  />
                </div>
              </div>
              <div className={styles.checkboxRow}>
                <input type="checkbox" id="rememberIdChk" checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)} />
                <label htmlFor="rememberIdChk">아이디 저장</label>
                <button type="button" className={styles.forgotLink}
                  onClick={() => switchBusinessMode('forgot')}>
                  비밀번호 찾기
                </button>
              </div>
              <button className={styles.btnLogin} onClick={handlePasswordLogin} disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </button>
              <div className={styles.divider}><span>또는</span></div>
              <button type="button" className={styles.phoneLoginLink}
                onClick={() => switchBusinessMode('phone')}>
                <HiOutlineDeviceMobile />
                기존 회원이신가요? 휴대폰 인증으로 시작
              </button>
              <button type="button" className={styles.signupLink}
                onClick={() => { onClose(); router.push('/signup/business'); }}>
                아직 회원이 아니신가요? 회원가입
              </button>
            </>
          )}

          {/* ── 기업: 휴대폰 인증 (처음 로그인) ── */}
          {userType === 'business' && businessMode === 'phone' && (
            <>
              <div className={styles.infoBox}>
                <span className={styles.infoIcon}>📱</span>
                <p>가입 시 등록한 휴대폰 번호로 인증 후 아이디/비밀번호를 설정합니다.</p>
              </div>
              <PhoneOtpForm
                phone={phone} authNum={authNum} otpSent={otpSent} loading={loading}
                onPhoneChange={setPhone} onAuthNumChange={setAuthNum}
                onSend={handlePhoneSubmit} onVerify={handleAuthSubmit}
                styles={styles}
              />
            </>
          )}

          {/* ── 기업: 아이디/이메일/비밀번호 설정 (OTP 인증 직후) ── */}
          {userType === 'business' && businessMode === 'setup' && (
            <>
              {/* 휴대폰 인증 완료 배너 */}
              <div className={styles.setupInfoBox}>
                <div className={styles.setupInfoTop}>
                  <span className={styles.setupStep}>✓ 휴대폰 인증 완료</span>
                  <p>아래 정보를 설정하면 다음부터 아이디로 로그인할 수 있습니다.</p>
                </div>
                <div className={styles.setupPhoneWrap}>
                  <HiOutlineDeviceMobile className={styles.setupPhoneIcon} />
                  <input
                    type="text"
                    value={phone}
                    disabled
                    className={styles.setupPhoneInput}
                    readOnly
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  아이디 <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <HiOutlineUser className={styles.inputIcon} />
                  <input
                    type="text" value={setupUserId}
                    onChange={(e) => setSetupUserId(e.target.value.replace(/\s/g, ''))}
                    className={styles.inputAuth} placeholder="영문, 숫자 4자 이상"
                    maxLength={30}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  이메일 <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <HiOutlineMail className={styles.inputIcon} />
                  <input
                    type="email" value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className={styles.inputAuth} placeholder="비밀번호 찾기에 사용됩니다"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  비밀번호 <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <HiOutlineLockClosed className={styles.inputIcon} />
                  <input
                    type={showSetupPw ? 'text' : 'password'} value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className={styles.inputAuth} placeholder="8자리 이상"
                    maxLength={50}
                  />
                  <button type="button" className={styles.eyeToggle}
                    onClick={() => setShowSetupPw(!showSetupPw)} tabIndex={-1}>
                    {showSetupPw ? <HiEyeOff /> : <HiEye />}
                  </button>
                </div>
                {/* 비밀번호 유효성 체크리스트 */}
                {setupPassword && (
                  <ul className={styles.pwChecklist}>
                    <li className={pwHas8 ? styles.pwCheckOk : styles.pwCheckNo}>
                      {pwHas8 ? '✓' : '✗'} 영문+숫자 조합 8자 이상
                    </li>
                    <li className={pwHasSpecial ? styles.pwCheckOk : styles.pwCheckNo}>
                      {pwHasSpecial ? '✓' : '✗'} 특수문자 포함
                    </li>
                  </ul>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  비밀번호 확인 <span className={styles.required}>*</span>
                </label>
                <div className={`${styles.inputWrap} ${pwMismatch ? styles.inputWrapError : ''} ${pwMatch ? styles.inputWrapOk : ''}`}>
                  <HiOutlineLockClosed className={styles.inputIcon} />
                  <input
                    type={showSetupPwConfirm ? 'text' : 'password'} value={setupPasswordConfirm}
                    onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                    className={styles.inputAuth} placeholder="비밀번호 재입력"
                    maxLength={50}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetupSubmit()}
                  />
                  <button type="button" className={styles.eyeToggle}
                    onClick={() => setShowSetupPwConfirm(!showSetupPwConfirm)} tabIndex={-1}>
                    {showSetupPwConfirm ? <HiEyeOff /> : <HiEye />}
                  </button>
                </div>
                {pwMismatch && <p className={styles.hintError}>✗ 비밀번호가 일치하지 않습니다.</p>}
                {pwMatch && <p className={styles.hintOk}>✓ 비밀번호가 일치합니다.</p>}
              </div>

              <button className={styles.btnLogin} onClick={handleSetupSubmit} disabled={loading}>
                {loading ? '설정 중...' : '설정 완료 후 시작하기'}
              </button>
            </>
          )}

          {/* ── 기업: 비밀번호 찾기 ── */}
          {userType === 'business' && businessMode === 'forgot' && (
            <>
              {forgotSent ? (
                <div className={styles.successBox}>
                  <div className={styles.successIcon}>✓</div>
                  <p className={styles.successTitle}>이메일을 발송했습니다</p>
                  <p className={styles.successDesc}>
                    등록된 이메일로 비밀번호 재설정 링크를 보냈습니다.<br />
                    메일함을 확인해주세요. (스팸함도 확인)
                  </p>
                  <button className={styles.btnLogin} style={{ marginTop: 20 }}
                    onClick={() => switchBusinessMode('password')}>
                    로그인으로 돌아가기
                  </button>
                </div>
              ) : (
                <>
                  <p className={styles.forgotDesc}>
                    아이디 또는 이메일을 입력하시면<br />비밀번호 재설정 링크를 보내드립니다.
                  </p>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>아이디 또는 이메일</label>
                    <div className={styles.inputWrap}>
                      <HiOutlineMail className={styles.inputIcon} />
                      <input
                        type="text" value={forgotInput}
                        onChange={(e) => setForgotInput(e.target.value)}
                        className={styles.inputAuth} placeholder="아이디 또는 이메일 입력"
                        onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                      />
                    </div>
                  </div>
                  <button className={styles.btnLogin} onClick={handleForgotPassword} disabled={loading}>
                    {loading ? '발송 중...' : '재설정 링크 받기'}
                  </button>
                </>
              )}
            </>
          )}

          {error && (
            <div className={styles.error} style={{ whiteSpace: 'pre-line' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 휴대폰 OTP 공통 컴포넌트 ────────────────────────────────────────
interface PhoneOtpFormProps {
  phone: string; authNum: string; otpSent: boolean; loading: boolean;
  onPhoneChange: (v: string) => void; onAuthNumChange: (v: string) => void;
  onSend: () => void; onVerify: () => void;
  styles: Record<string, string>;
}

const PhoneOtpForm: React.FC<PhoneOtpFormProps> = ({
  phone, authNum, otpSent, loading,
  onPhoneChange, onAuthNumChange, onSend, onVerify, styles,
}) => (
  <>
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>휴대폰 번호</label>
      <div className={styles.inputRow}>
        <div className={styles.inputWrap}>
          <HiOutlineDeviceMobile className={styles.inputIcon} />
          <input
            type="tel" value={phone}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
            className={styles.inputAuth} placeholder="01012345678" maxLength={11}
          />
        </div>
        <button onClick={onSend} className={styles.btnPhone} disabled={loading}>
          {loading && !otpSent ? '처리 중...' : otpSent ? '재발송' : '인증번호'}
        </button>
      </div>
    </div>
    {otpSent && (
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>인증번호</label>
        <div className={styles.inputRow}>
          <div className={styles.inputWrap}>
            <HiOutlineLockClosed className={styles.inputIcon} />
            <input
              type="text" value={authNum}
              onChange={(e) => onAuthNumChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={styles.inputAuth} placeholder="인증번호 6자리" maxLength={6}
            />
          </div>
          <button onClick={onVerify} className={styles.btnPhone} disabled={loading}>
            {loading ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    )}
  </>
);

export default LoginPopup;
