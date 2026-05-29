import React, { useState, useEffect, useContext } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import { AuthContext } from '@/contexts/AuthContext';
import supabase from '@/lib/supabase';
import styles from '@/styles/BusinessSignup.module.css';

const CONFIRM_PHRASE = '회원탈퇴';

const WithdrawPage = () => {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const [confirmText, setConfirmText] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (auth?.isLoading === false && !auth?.user) {
      router.replace('/');
    }
  }, [auth?.isLoading, auth?.user, router]);

  const canSubmit = agreed && confirmText.trim() === CONFIRM_PHRASE && !submitting;

  const handleWithdraw = async () => {
    if (!canSubmit) return;
    setErrorMsg('');
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setErrorMsg('세션이 만료되었습니다. 다시 로그인 후 시도해주세요.');
        return;
      }
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(body?.error || '탈퇴 처리 중 오류가 발생했습니다.');
        return;
      }
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('iltok_active_login_type');
      }
      alert('회원탈퇴가 완료되었습니다.\n그동안 114114KR을 이용해 주셔서 감사합니다.');
      router.replace('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (auth?.isLoading || !auth?.user) {
    return (
      <div className={styles.main}>
        <div className={styles.container}>
          <p style={{ textAlign: 'center', padding: 40 }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>회원탈퇴 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu showMenuItems={true} currentSection="info" />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>회원탈퇴</h1>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>탈퇴 전 안내사항</h2>
            <ul style={{ margin: '12px 0 0 0', padding: '0 0 0 18px', color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
              <li>탈퇴 시 계정과 관련된 <strong style={{ color: 'var(--color-text)' }}>모든 데이터가 영구적으로 삭제</strong>됩니다.</li>
              <li>본인이 등록한 채용공고, 이력서, 댓글, 지원 내역이 모두 삭제됩니다.</li>
              <li>게재 중인 프리미엄 광고가 있는 경우 즉시 종료되며, 별도 환불은 고객센터로 문의해주세요.</li>
              <li>삭제된 데이터는 복구할 수 없습니다.</li>
              <li>탈퇴 후 동일한 휴대폰 번호/이메일로 재가입할 수 있습니다.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>탈퇴 확인</h2>

            <div className={styles.formGroup} style={{ marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span>위 안내사항을 모두 확인하였으며, 회원탈퇴에 동의합니다.</span>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label>
                탈퇴를 진행하려면 <strong style={{ color: 'var(--color-error)' }}>{CONFIRM_PHRASE}</strong>을(를) 입력해주세요.
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className={styles.input}
                autoComplete="off"
              />
            </div>

            {errorMsg && <p className={styles.fieldError} style={{ marginBottom: 12 }}>{errorMsg}</p>}

            <div className={styles.buttonRow}>
              <Link href="/my?section=info" className={styles.cancelBtn}>
                취소
              </Link>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={!canSubmit}
                className={styles.submitBtn}
                style={{
                  background: canSubmit ? 'var(--color-error)' : undefined,
                  opacity: canSubmit ? 1 : 0.5,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting ? '탈퇴 처리 중...' : '회원탈퇴'}
              </button>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default WithdrawPage;
