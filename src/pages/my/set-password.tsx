import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import styles from '@/styles/SetPassword.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SetPasswordPage = () => {
  const router = useRouter();

  const [authUserId, setAuthUserId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');

  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }

      const { data } = await supabase
        .from('users')
        .select('user_id, email, company_name, number, password_set, user_type')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.password_set || !['business', 'both'].includes(data?.user_type ?? '')) {
        router.replace('/my');
        return;
      }

      setAuthUserId(user.id);
      setCompanyName(data?.company_name || '');
      setPhone(data?.number || '');
      // 이미 있는 경우 기본값으로 채우기
      setUserId(data?.user_id || '');
      setEmail(data?.email || '');
      setPageLoading(false);
    };
    init();
  }, [router]);

  const handleSubmit = async () => {
    if (!userId.trim()) { setError('사용할 아이디를 입력해주세요.'); return; }
    if (userId.trim().length < 4) { setError('아이디는 4자리 이상으로 입력해주세요.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('올바른 이메일을 입력해주세요.'); return; }
    if (!password || password.length < 8) { setError('비밀번호는 8자리 이상으로 입력해주세요.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup-business-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: authUserId,
          user_id: userId.trim(),
          email: email.trim(),
          password,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || '설정에 실패했습니다.');
        return;
      }
      router.push('/my?section=ads&welcome=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return null;

  const pwMatch = passwordConfirm && password === passwordConfirm;
  const pwMismatch = passwordConfirm && password !== passwordConfirm;

  return (
    <>
      <Head>
        <title>로그인 정보 설정 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.stepBadge}>마지막 단계</div>
              <h1 className={styles.title}>로그인 정보 설정</h1>
              <p className={styles.subtitle}>
                다음부터는 아이디와 비밀번호로<br />빠르게 로그인할 수 있습니다.
              </p>
            </div>

            {(companyName || phone) && (
              <div className={styles.accountInfo}>
                {companyName && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>회사명</span>
                    <span className={styles.infoValue}>{companyName}</span>
                  </div>
                )}
                {phone && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>휴대폰</span>
                    <span className={styles.infoValue}>{phone}</span>
                  </div>
                )}
              </div>
            )}

            <div className={styles.form}>
              {/* 아이디 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>아이디 <span className={styles.required}>*</span></label>
                <div className={styles.inputWrap}>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value.replace(/\s/g, ''))}
                    className={styles.input}
                    placeholder="영문, 숫자 4자 이상"
                    maxLength={30}
                  />
                </div>
                <p className={styles.hint}>로그인 시 사용할 아이디 (영문, 숫자, 특수문자 가능)</p>
              </div>

              {/* 이메일 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>이메일 <span className={styles.required}>*</span></label>
                <div className={styles.inputWrap}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.input}
                    placeholder="example@email.com"
                    maxLength={100}
                  />
                </div>
                <p className={styles.hint}>비밀번호 찾기 시 사용됩니다.</p>
              </div>

              {/* 비밀번호 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>비밀번호 <span className={styles.required}>*</span></label>
                <div className={styles.inputWrap}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input}
                    placeholder="8자리 이상"
                    maxLength={50}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className={styles.hint}>영문, 숫자, 특수문자 조합 8자 이상 권장</p>
              </div>

              {/* 비밀번호 확인 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>비밀번호 확인 <span className={styles.required}>*</span></label>
                <div className={styles.inputWrap}>
                  <input
                    type={showPwConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className={`${styles.input} ${pwMismatch ? styles.inputError : ''} ${pwMatch ? styles.inputOk : ''}`}
                    placeholder="비밀번호 재입력"
                    maxLength={50}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPwConfirm(!showPwConfirm)} tabIndex={-1}>
                    {showPwConfirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {pwMismatch && <p className={styles.errorHint}>비밀번호가 일치하지 않습니다.</p>}
                {pwMatch && <p className={styles.okHint}>비밀번호가 일치합니다.</p>}
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button className={styles.btnSubmit} onClick={handleSubmit} disabled={loading}>
                {loading ? '설정 중...' : '설정 완료'}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default SetPasswordPage;
