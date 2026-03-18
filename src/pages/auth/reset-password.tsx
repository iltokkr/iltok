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

const ResetPasswordPage = () => {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  useEffect(() => {
    // onAuthStateChange로 PASSWORD_RECOVERY 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
      }
    });

    // 타이밍 문제 대비: 이미 세션이 있으면 바로 활성화
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!password || password.length < 8) {
      setError('비밀번호는 8자리 이상으로 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users').update({ password_set: true }).eq('id', user.id);
      }

      setDone(true);
      setTimeout(() => router.push('/my'), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.toLowerCase().includes('different from the old password')
          ? '기존 비밀번호와 다른 비밀번호를 입력해주세요.'
          : msg || '비밀번호 변경에 실패했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>비밀번호 재설정 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.stepBadge}>비밀번호 재설정</div>
              <h1 className={styles.title}>새 비밀번호 설정</h1>
              <p className={styles.subtitle}>
                새로운 비밀번호를 입력해주세요.
              </p>
            </div>

            <div className={styles.form}>
              {done ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div className={styles.okHint} style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                    ✓ 비밀번호가 변경되었습니다
                  </div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                    잠시 후 마이페이지로 이동합니다...
                  </p>
                </div>
              ) : !ready ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  링크를 확인하는 중입니다...<br />
                  <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    이메일의 링크를 클릭해서 접속해주세요.
                  </span>
                </div>
              ) : (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>새 비밀번호</label>
                    <div className={styles.inputWrap}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={styles.input}
                        placeholder="8자리 이상 입력"
                        maxLength={50}
                      />
                      <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                        {showPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <p className={styles.hint}>영문, 숫자, 특수문자 조합 8자 이상 권장</p>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>비밀번호 확인</label>
                    <div className={styles.inputWrap}>
                      <input
                        type={showPwConfirm ? 'text' : 'password'}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className={`${styles.input} ${
                          passwordConfirm && password !== passwordConfirm ? styles.inputError : ''
                        } ${
                          passwordConfirm && password === passwordConfirm ? styles.inputOk : ''
                        }`}
                        placeholder="비밀번호 재입력"
                        maxLength={50}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      />
                      <button type="button" className={styles.eyeBtn} onClick={() => setShowPwConfirm(!showPwConfirm)} tabIndex={-1}>
                        {showPwConfirm ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {passwordConfirm && password !== passwordConfirm && (
                      <p className={styles.errorHint}>비밀번호가 일치하지 않습니다.</p>
                    )}
                    {passwordConfirm && password === passwordConfirm && (
                      <p className={styles.okHint}>비밀번호가 일치합니다.</p>
                    )}
                  </div>

                  {error && <div className={styles.error}>{error}</div>}

                  <button className={styles.btnSubmit} onClick={handleSubmit} disabled={loading}>
                    {loading ? '변경 중...' : '비밀번호 변경 완료'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default ResetPasswordPage;
