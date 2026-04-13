import React, { useState, useEffect, useContext } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import styles from '@/styles/SetPassword.module.css';
import changeStyles from '@/styles/ChangePassword.module.css';
import supabase from '@/lib/supabase';
import { AuthContext } from '@/contexts/AuthContext';

const ChangePasswordPage = () => {
  const router = useRouter();
  const auth = useContext(AuthContext);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  useEffect(() => {
    if (auth?.isLoading === false && !auth?.user) {
      router.replace('/');
    }
  }, [auth?.isLoading, auth?.user, router]);

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

      setDone(true);
      setTimeout(() => router.push('/my?section=info'), 2500);
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

  if (auth?.isLoading || !auth?.user) {
    return null;
  }

  const pwMatch = passwordConfirm.length > 0 && password === passwordConfirm;
  const pwMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  return (
    <>
      <Head>
        <title>비밀번호 변경 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu showMenuItems={true} currentSection="info" />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.stepBadge}>보안</div>
              <h1 className={styles.title}>비밀번호 변경</h1>
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
                    잠시 후 회원정보 페이지로 이동합니다...
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>새 비밀번호 <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={styles.input}
                        placeholder="8자리 이상 입력"
                        maxLength={50}
                        autoFocus
                      />
                      <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                        {showPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <p className={styles.hint}>영문, 숫자, 특수문자 조합 8자 이상 권장</p>
                  </div>

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
                    {loading ? '변경 중...' : '비밀번호 변경 완료'}
                  </button>

                  <div className={changeStyles.cancelRow}>
                    <Link href="/my?section=info" className={changeStyles.cancelLink}>
                      취소
                    </Link>
                  </div>
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

export default ChangePasswordPage;
