import React, { useState, useEffect, useContext } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '@/styles/BusinessSignup.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [existingBizFile, setExistingBizFile] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userIdChecked, setUserIdChecked] = useState<boolean | null>(null);
  const [userIdCheckLoading, setUserIdCheckLoading] = useState(false);
  const [hasExistingUserId, setHasExistingUserId] = useState(false);

  const formatPhoneDisplay = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.startsWith('82') && numbers.length >= 10) {
      const rest = numbers.slice(2);
      return `0${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
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

  const checkUserIdDuplicate = async () => {
    const id = userId.trim();
    if (!id) {
      setFormErrors((prev) => ({ ...prev, userId: '아이디를 입력해주세요.' }));
      return;
    }
    setUserIdCheckLoading(true);
    setFormErrors((prev) => ({ ...prev, userId: '' }));
    setUserIdChecked(null);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', id)
        .maybeSingle();
      if (error) throw error;
      if (data && data.id !== auth?.user?.id) {
        setUserIdChecked(false);
        setFormErrors((prev) => ({ ...prev, userId: '이미 사용 중인 아이디입니다.' }));
      } else {
        setUserIdChecked(true);
      }
    } catch (err) {
      setFormErrors((prev) => ({ ...prev, userId: '중복 검사 중 오류가 발생했습니다.' }));
    } finally {
      setUserIdCheckLoading(false);
    }
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
          .select('user_id, email, number, company_name, name, business_number, business_address, biz_file, policy_term, auth_term')
          .eq('id', userId)
          .eq('user_type', 'business')
          .single();

        if (error || !data) {
          router.replace('/my');
          return;
        }

        setUserId(data.user_id || '');
        setHasExistingUserId(!!data.user_id);
        setEmail(data.email || '');
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
    const userIdEditable = !hasExistingUserId;
    if (userIdEditable) {
      if (!userId.trim()) err.userId = '아이디를 입력해주세요.';
      else if (userIdChecked !== true) err.userId = '아이디 중복 검사를 진행해주세요.';
    }
    if (password.trim() && password.length < 6) err.password = '비밀번호는 6자 이상이어야 합니다.';
    if (!email.trim()) err.email = '이메일을 입력해주세요.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = '올바른 이메일 형식을 입력해주세요.';
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !auth?.user?.id) return;

    setIsSubmitting(true);
    try {
      const updateData: Record<string, unknown> = {
        email: email.trim(),
      };

      if (!hasExistingUserId && userId.trim()) {
        updateData.user_id = userId.trim();
      }

      if (password.trim()) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          email: email.trim(),
          password: password,
        });
        if (authUpdateError) throw authUpdateError;
      } else {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (authUpdateError) throw authUpdateError;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', auth.user.id);

      if (updateError) throw updateError;

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
      } else if (msg.includes('different from the old password')) {
        setFormErrors((prev) => ({ ...prev, password: '이전 비밀번호와 다른 비밀번호를 입력해주세요.' }));
        alert('이전 비밀번호와 다른 비밀번호를 입력해주세요.');
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

  const userIdEditable = !hasExistingUserId;

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
              <h2 className={styles.sectionTitle}>약관동의 <span className={styles.required}>*</span> <span className={styles.disabledLabel}>(수정 불가)</span></h2>
              <div className={styles.termsGroup}>
                <label className={`${styles.checkboxLabel} ${styles.checkboxDisabled}`}>
                  <input type="checkbox" checked={termsAgreed} disabled />
                  <span>서비스 이용약관 동의 <span className={styles.required}>*</span></span>
                  <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className={styles.termsBtn}>
                    내용 보기
                  </Link>
                </label>
                <label className={`${styles.checkboxLabel} ${styles.checkboxDisabled}`}>
                  <input type="checkbox" checked={businessTermsAgreed} disabled />
                  <span>사업자등록정보 수집 및 이용 동의 <span className={styles.required}>*</span></span>
                  <button
                    type="button"
                    className={styles.termsBtn}
                    onClick={() => setShowBusinessTerms(!showBusinessTerms)}
                  >
                    내용 보기
                  </button>
                </label>
                {showBusinessTerms && (
                  <div className={styles.termsContent}>{BUSINESS_TERMS_CONTENT}</div>
                )}
              </div>
            </section>

            {/* 본인인증 - 비활성 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>본인인증 <span className={styles.required}>*</span> <span className={styles.disabledLabel}>(수정 불가)</span></h2>
              <div className={styles.authGroup}>
                <div className={styles.inputRow}>
                  <input
                    type="tel"
                    value={formatPhoneDisplay(phone)}
                    readOnly
                    className={`${styles.input} ${styles.inputReadonly}`}
                  />
                </div>
                <p className={styles.verified}>인증 완료</p>
              </div>
            </section>

            {/* 회원정보 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>회원정보</h2>
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>아이디 {userIdEditable ? <span className={styles.required}>*</span> : <span className={styles.disabledLabel}>(수정 불가)</span>}</label>
                  <div className={styles.idInputRow}>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => {
                        setUserId(e.target.value);
                        setUserIdChecked(null);
                        setFormErrors((prev) => ({ ...prev, userId: '' }));
                      }}
                      placeholder="아이디를 입력하세요"
                      className={`${styles.input} ${!userIdEditable ? styles.inputReadonly : ''}`}
                      readOnly={!userIdEditable}
                    />
                    {userIdEditable && (
                      <button
                        type="button"
                        className={styles.dupCheckBtn}
                        onClick={checkUserIdDuplicate}
                        disabled={userIdCheckLoading || !userId.trim()}
                      >
                        {userIdCheckLoading ? '확인 중...' : '중복 검사'}
                      </button>
                    )}
                  </div>
                  {userIdChecked === true && <span className={styles.fieldSuccess}>사용 가능한 아이디입니다.</span>}
                  {formErrors.userId && <span className={styles.fieldError}>{formErrors.userId}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>비밀번호 <span className={styles.optional}>(변경 시에만 입력)</span></label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="변경할 비밀번호 (6자 이상, 미입력 시 유지)"
                    className={styles.input}
                  />
                  {formErrors.password && <span className={styles.fieldError}>{formErrors.password}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>이메일 <span className={styles.required}>*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일을 입력하세요"
                    className={styles.input}
                  />
                  {formErrors.email && <span className={styles.fieldError}>{formErrors.email}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>사업자등록번호 <span className={styles.disabledLabel}>(수정 불가)</span></label>
                  <input
                    type="text"
                    value={formatBusinessNumber(businessNumber)}
                    readOnly
                    className={`${styles.input} ${styles.inputReadonly}`}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>회사/점포명 <span className={styles.disabledLabel}>(수정 불가)</span></label>
                  <input
                    type="text"
                    value={companyName}
                    readOnly
                    className={`${styles.input} ${styles.inputReadonly}`}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>대표자명 <span className={styles.disabledLabel}>(수정 불가)</span></label>
                  <input
                    type="text"
                    value={representativeName}
                    readOnly
                    className={`${styles.input} ${styles.inputReadonly}`}
                  />
                </div>

                <div className={styles.formGroup}>
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
                    <li>사업자등록번호, 회사명, 대표자명, 사업자등록증은 고객센터를 통해 문의해주세요.</li>
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
