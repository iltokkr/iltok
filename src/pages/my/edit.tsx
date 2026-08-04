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

const BUSINESS_TERMS_CONTENT = `(주)일톡에서 국세청 사업자등록정보 진위확인 및 상태조회 서비스를 통해 조회한 정보를 대조하기 위해 입력한 사업자등록증 정보를 수집 및 이용하는 것에 동의하며, 이에 필요한 일체의 권한을 (주)일톡에 위임합니다.`;

const BusinessEditPage = () => {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);

  // 약관 (비활성, 표시만)
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [businessTermsAgreed, setBusinessTermsAgreed] = useState(true);
  const [showBusinessTerms, setShowBusinessTerms] = useState(false);

  // 본인인증 (비활성, 표시만)
  const [phone, setPhone] = useState('');

  // 회원정보
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [existingBizFile, setExistingBizFile] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 관리자는 일반 회원에게 잠겨 있는 항목(아이디·전화번호·사업자 정보)까지 고칠 수 있다.
  const [isAdmin, setIsAdmin] = useState(false);

  /** 잠긴 입력에 붙일 props. 관리자면 잠금을 풀고 onChange 를 살린다. */
  const lockedInput = (setter: (v: string) => void) =>
    isAdmin
      ? { onChange: (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value), className: styles.input }
      : { readOnly: true, className: `${styles.input} ${styles.inputReadonly}` };

  /** 라벨 옆 "(수정 불가)" 배지 — 관리자에게는 표시하지 않는다. */
  const lockBadge = isAdmin ? null : <span className={styles.disabledLabel}>(수정 불가)</span>;

  const formatPhoneDisplay = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.startsWith('82') && numbers.length >= 11) {
      const local = '0' + numbers.slice(2);
      return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    }
    if (numbers.length >= 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    return value;
  };

  const formatBusinessNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`;
  };

  useEffect(() => {
    if (auth?.isLoading === false && !auth?.user) {
      router.replace('/');
      return;
    }
    const userId = auth?.user?.id;
    if (!userId) return;
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('user_id, email, number, company_name, name, business_number, business_address, biz_file, policy_term, auth_term, user_type, is_admin')
          .eq('id', userId)
          .single();

        if (error || !data) {
          router.replace('/my');
          return;
        }

        // 'both'(개인+기업 겸용) 계정도 기업 정보 수정 대상이다.
        // 'business'만 통과시키면 both 계정은 여기서 되튕겨 버튼이 안 먹는 것처럼 보인다.
        // 관리자는 회원유형과 무관하게 언제나 들어올 수 있다.
        if (!data.is_admin && !['business', 'both'].includes(data.user_type ?? '')) {
          router.replace('/my');
          return;
        }

        setIsAdmin(!!data.is_admin);
        setUserId(data.user_id || '');
        setEmail(data.email || '');
        setOriginalEmail(data.email || '');
        setPhone(data.number || '');
        setCompanyName(data.company_name || '');
        setRepresentativeName(data.name || '');
        setBusinessNumber(data.business_number || '');
        setTermsAgreed(!!data.policy_term);
        setBusinessTermsAgreed(!!data.auth_term);
        setExistingBizFile(data.biz_file || null);
      } catch (err) {
        console.error(err);
        router.replace('/my');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [auth?.user?.id, router]);

  const validateForm = () => {
    const err: Record<string, string> = {};
    if (!email.trim()) err.email = '이메일을 입력해주세요.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = '올바른 이메일 형식을 입력해주세요.';
    if (!businessTermsAgreed) err.businessTerms = '사업자등록정보 수집 및 이용 동의에 체크해주세요.';
    // 관리자만 고칠 수 있는 항목들 — 빈 값으로 저장하면 로그인이 막힌다.
    if (isAdmin) {
      if (!userId.trim()) err.userId = '아이디를 입력해주세요.';
      if (phone.replace(/[^0-9]/g, '').length < 10) err.phone = '올바른 전화번호를 입력해주세요.';
    }
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !auth?.user?.id) return;

    setIsSubmitting(true);
    try {
      if (isAdmin) {
        // 관리자는 전화번호·아이디까지 바꾸므로 auth.users 도 함께 손봐야 한다.
        // service role 이 필요해 서버 라우트를 거친다.
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');

        const res = await fetch('/api/admin/update-self-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: userId.trim(),
            email: email.trim(),
            number: phone.trim(),
            business_number: businessNumber.replace(/[^0-9]/g, ''),
            company_name: companyName.trim(),
            name: representativeName.trim(),
            auth_term: businessTermsAgreed,
            policy_term: termsAgreed,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || '수정 중 오류가 발생했습니다.');
      } else {
        const updateData: Record<string, unknown> = {
          email: email.trim(),
          auth_term: businessTermsAgreed,
        };

        if (email.trim() !== originalEmail) {
          const { error: authUpdateError } = await supabase.auth.updateUser({ email: email.trim() });
          if (authUpdateError) throw authUpdateError;
        }

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', auth.user.id);

        if (updateError) throw updateError;
      }

      alert('회원정보가 수정되었습니다.');
      router.push('/my?section=info');
    } catch (err: unknown) {
      console.error(err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : '';
      if (msg.includes('already registered') || msg.includes('already in use')) {
        setFormErrors((prev) => ({ ...prev, email: '이미 사용 중인 이메일입니다.' }));
        alert('이미 사용 중인 이메일입니다.');
      } else {
        alert(msg || '수정 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auth?.isLoading || isLoading || !auth?.user) {
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
        <title>회원정보 수정 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu showMenuItems={true} currentSection="info" />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>회원정보 수정</h1>

          <form onSubmit={handleSubmit}>
            {/* 약관동의 - 비활성 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>약관동의 <span className={styles.required}>*</span> {lockBadge}</h2>
              <div className={styles.termsGroup}>
                <label className={`${styles.checkboxLabel} ${isAdmin ? '' : styles.checkboxDisabled}`}>
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    disabled={!isAdmin}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  <span>서비스 이용약관 동의 <span className={styles.required}>*</span></span>
                  <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className={styles.termsBtn}>
                    내용 보기
                  </Link>
                </label>
                <label className={`${styles.checkboxLabel} ${businessTermsAgreed && !isAdmin ? styles.checkboxDisabled : ''}`}>
                  <input
                    type="checkbox"
                    checked={businessTermsAgreed}
                    disabled={businessTermsAgreed && !isAdmin}
                    onChange={(e) => {
                      setBusinessTermsAgreed(e.target.checked);
                      setFormErrors((prev) => ({ ...prev, businessTerms: '' }));
                    }}
                  />
                  <span>사업자등록정보 수집 및 이용 동의 <span className={styles.required}>*</span></span>
                  <button
                    type="button"
                    className={styles.termsBtn}
                    onClick={() => setShowBusinessTerms(!showBusinessTerms)}
                  >
                    내용 보기
                  </button>
                </label>
                {formErrors.businessTerms && <span className={styles.fieldError}>{formErrors.businessTerms}</span>}
                {showBusinessTerms && (
                  <div className={styles.termsContent}>{BUSINESS_TERMS_CONTENT}</div>
                )}
              </div>
            </section>

            {/* 본인인증 - 비활성 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>본인인증 <span className={styles.required}>*</span> {lockBadge}</h2>
              <div className={styles.authGroup}>
                <div className={styles.inputRow}>
                  <input
                    type="tel"
                    value={isAdmin ? phone : formatPhoneDisplay(phone)}
                    {...lockedInput(setPhone)}
                  />
                </div>
                {formErrors.phone && <span className={styles.fieldError}>{formErrors.phone}</span>}
                {!isAdmin && <p className={styles.verified}>인증 완료</p>}
                <p className={styles.authNotice}>
                  {isAdmin
                    ? '이 번호가 로그인 계정입니다. 바꾸면 다음 로그인부터 새 번호를 써야 합니다.'
                    : '연락처(전화번호)가 아이디로 사용되며, 해당 번호로 로그인할 수 있습니다.'}
                </p>
              </div>
            </section>

            {/* 회원정보 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>회원정보</h2>
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>아이디 {lockBadge}</label>
                  <input
                    type="text"
                    value={isAdmin ? userId : userId || '미설정'}
                    placeholder={isAdmin ? '아이디를 입력하세요' : undefined}
                    {...lockedInput(setUserId)}
                  />
                  {formErrors.userId && <span className={styles.fieldError}>{formErrors.userId}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>비밀번호</label>
                  <div className={styles.inputRow}>
                    <input
                      type="password"
                      value="••••••••"
                      readOnly
                      className={`${styles.input} ${styles.inputReadonly}`}
                    />
                    <button
                      type="button"
                      className={styles.changePasswordBtn}
                      onClick={() => router.push('/my/change-password')}
                    >
                      변경
                    </button>
                  </div>
                  <p className={styles.fieldHint}>비밀번호는 사이트 내에서 바로 변경할 수 있습니다.</p>
                </div>

                <div className={styles.formGroup}>
                  <label>이메일 <span className={styles.required}>*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="이메일을 입력하세요"
                    className={styles.input}
                  />
                  {formErrors.email && <span className={styles.fieldError}>{formErrors.email}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>사업자등록번호 {lockBadge}</label>
                  <input
                    type="text"
                    value={formatBusinessNumber(businessNumber)}
                    {...lockedInput(setBusinessNumber)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>회사/점포명 {lockBadge}</label>
                  <input
                    type="text"
                    value={companyName}
                    {...lockedInput(setCompanyName)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>대표자명 {lockBadge}</label>
                  <input
                    type="text"
                    value={representativeName}
                    {...lockedInput(setRepresentativeName)}
                  />
                </div>

                <div className={styles.formGroup}>
                  {/* 파일 교체는 업로드 UI가 있는 "사업자 정보 수정하기" 모달에서만 한다. */}
                  <label>사업자등록증 <span className={styles.disabledLabel}>(수정 불가)</span></label>
                  <div className={styles.fileWrapper}>
                    <span className={styles.fileName}>
                      {existingBizFile ? '등록된 파일 있음' : '등록된 파일 없음'}
                    </span>
                  </div>
                </div>

                <div className={styles.footer}>
                  <h4>사업자 정보 수정이 필요한 경우</h4>
                  <ul>
                    {isAdmin ? (
                      <li>관리자 계정이라 잠금이 풀려 있습니다. 사업자등록증 파일 교체는 회원정보 화면의 &ldquo;사업자 정보 수정하기&rdquo;에서 하세요.</li>
                    ) : (
                      <li>사업자등록번호, 회사명, 대표자명, 사업자등록증은 고객센터를 통해 문의해주세요.</li>
                    )}
                  </ul>
                </div>

                <div className={styles.buttonRow}>
                  <Link href="/my?section=info" className={styles.cancelBtn}>
                    취소
                  </Link>
                  <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                    {isSubmitting ? '수정 중...' : '수정하기'}
                  </button>
                </div>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <Link
                    href="/my/withdraw"
                    style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'underline' }}
                  >
                    회원탈퇴
                  </Link>
                </div>
              </div>
            </section>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default BusinessEditPage;
