import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import styles from '@/styles/BusinessSignup.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUSINESS_TERMS_CONTENT = `(주)일톡에서 국세청 사업자등록정보 진위확인 및 상태조회 서비스를 통해 조회한 정보를 대조하기 위해 입력한 사업자등록증 정보를 수집 및 이용하는 것에 동의하며, 이에 필요한 일체의 권한을 (주)일톡에 위임합니다.`;

const BusinessSignup = () => {
  const router = useRouter();

  // 약관
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [businessTermsAgreed, setBusinessTermsAgreed] = useState(false);
  const [showBusinessTerms, setShowBusinessTerms] = useState(false);

  // 본인인증
  const [phone, setPhone] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // 회원정보
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [bizFile, setBizFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userIdChecked, setUserIdChecked] = useState<boolean | null>(null);
  const [userIdCheckLoading, setUserIdCheckLoading] = useState(false);

  const formatPhoneForApi = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.startsWith('0')) return '+82' + numbers.slice(1);
    return '+' + numbers;
  };

  const formatBusinessNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`;
  };

  const isValidBusinessNumber = (value: string) => /^\d{3}-\d{2}-\d{5}$/.test(value);

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
      if (data) {
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

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setAuthError('전화번호를 입력해주세요.');
      return;
    }
    const formatted = formatPhoneForApi(phone);
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
      if (error) throw error;
      alert('인증번호가 전송되었습니다.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '인증번호 전송에 실패했습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!authCode.trim()) {
      setAuthError('인증번호를 입력해주세요.');
      return;
    }
    const formatted = formatPhoneForApi(phone);
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formatted,
        token: authCode,
        type: 'sms',
      });
      if (error) throw error;
      if (data.user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, user_type')
          .eq('number', formatted)
          .maybeSingle();
        if (existingUser) {
          if (existingUser.user_type === 'business') {
            await supabase.auth.signOut();
            setAuthError('이미 기업회원으로 가입된 번호입니다.');
            return;
          }
          if (existingUser.user_type === 'both') {
            await supabase.auth.signOut();
            setAuthError('이미 기업·개인 회원으로 가입된 번호입니다.');
            return;
          }
          if (existingUser.user_type === 'jobseeker') {
            setIsVerified(true);
            return;
          }
        }
        setIsVerified(true);
      }
    } catch (err) {
      setAuthError('인증번호가 틀렸습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  const validateForm = () => {
    if (!termsAgreed || !businessTermsAgreed) {
      alert('필수 약관에 모두 동의해주세요.');
      return false;
    }
    if (!isVerified) {
      alert('본인인증을 완료해주세요.');
      return false;
    }
    const err: Record<string, string> = {};
    if (!userId.trim()) err.userId = '아이디를 입력해주세요.';
    else if (userIdChecked !== true) err.userId = '아이디 중복 검사를 진행해주세요.';
    if (!password.trim()) err.password = '비밀번호를 입력해주세요.';
    else if (password.length < 6) err.password = '비밀번호는 6자 이상이어야 합니다.';
    if (!email.trim()) err.email = '이메일을 입력해주세요.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = '올바른 이메일 형식을 입력해주세요.';
    if (!businessNumber.trim()) err.businessNumber = '사업자등록번호를 입력해주세요.';
    else if (!isValidBusinessNumber(businessNumber)) err.businessNumber = '사업자등록번호 형식이 올바르지 않습니다. (000-00-00000)';
    if (!companyName.trim()) err.companyName = '회사/점포명을 입력해주세요.';
    if (!representativeName.trim()) err.representativeName = '대표자명을 입력해주세요.';
    if (!bizFile) err.bizFile = '사업자등록증을 첨부해주세요.';
    setFormErrors(err);
    if (Object.keys(err).length > 0) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!termsAgreed || !businessTermsAgreed || !isVerified) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('본인인증이 만료되었습니다. 처음부터 다시 진행해주세요.');
      router.push('/signup/business');
      return;
    }

    setIsSubmitting(true);
    try {
      const fileExt = bizFile!.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('auth_file')
        .upload(fileName, bizFile!);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('auth_file')
        .getPublicUrl(fileName);

      const formattedPhone = formatPhoneForApi(phone);

      const { data: existingUser } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle();

      const newUserType = existingUser?.user_type === 'jobseeker' ? 'both' : 'business';

      // Supabase Auth에 이메일/비밀번호 추가 (아이디/비밀번호 로그인용)
      const { error: authUpdateError } = await supabase.auth.updateUser({
        email: email.trim(),
        password: password,
      });
      if (authUpdateError) throw authUpdateError;

      const userData = {
        id: user.id,
        number: formattedPhone,
        email: email.trim(),
        user_id: userId.trim(),
        company_name: companyName,
        name: representativeName,
        business_number: businessNumber,
        business_address: '',
        biz_file: urlData.publicUrl,
        policy_term: termsAgreed,
        auth_term: businessTermsAgreed,
        user_type: newUserType,
        is_accept: false,
      };

      const { error: updateError } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'id' });

      if (updateError) throw updateError;

      alert('회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
      router.push('/my');
    } catch (err: unknown) {
      console.error(err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : '';
      const isEmailEmpty = msg.includes('"" is invalid') || msg.includes('" is invalid');
      if (isEmailEmpty) {
        setFormErrors((prev) => ({ ...prev, email: '이메일을 입력해주세요.' }));
        alert('이메일을 입력해주세요.');
      } else if (msg.includes('already registered') || msg.includes('already in use')) {
        setFormErrors((prev) => ({ ...prev, email: '이미 사용 중인 이메일입니다.' }));
        alert('이미 사용 중인 이메일입니다.');
      } else if (msg.includes('different from the old password')) {
        setFormErrors((prev) => ({ ...prev, password: '이전 비밀번호와 다른 비밀번호를 입력해주세요.' }));
        alert('이전 비밀번호와 다른 비밀번호를 입력해주세요.');
      } else {
        alert(msg || '회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>기업 회원가입 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu showMenuItems={false} />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>기업 회원가입</h1>

          <form onSubmit={handleSubmit}>
            {/* 약관동의 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>약관동의 <span className={styles.required}>*</span></h2>
              <div className={styles.termsGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  <span>서비스 이용약관 동의 <span className={styles.required}>*</span></span>
                  <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className={styles.termsBtn}>
                    내용 보기
                  </Link>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={businessTermsAgreed}
                    onChange={(e) => setBusinessTermsAgreed(e.target.checked)}
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
                {showBusinessTerms && (
                  <div className={styles.termsContent}>
                    {BUSINESS_TERMS_CONTENT}
                  </div>
                )}
              </div>
            </section>

            {/* 본인인증 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>본인인증 <span className={styles.required}>*</span></h2>
              <div className={styles.authGroup}>
                <div className={styles.inputRow}>
                  <input
                    type="tel"
                    value={isVerified && phone.length >= 10 ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}` : phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="전화번호를 입력하세요"
                    className={`${styles.input} ${isVerified ? styles.inputReadonly : ''}`}
                    readOnly={isVerified}
                  />
                  {!isVerified && (
                    <button
                      type="button"
                      className={styles.authBtn}
                      onClick={handleSendOtp}
                      disabled={authLoading}
                    >
                      {authLoading ? '전송 중...' : '인증번호'}
                    </button>
                  )}
                </div>
                {!isVerified && (
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="인증번호를 입력하세요"
                      className={styles.input}
                    />
                    <button
                      type="button"
                      className={styles.authBtn}
                      onClick={handleVerifyOtp}
                      disabled={authLoading}
                    >
                      {authLoading ? '확인 중...' : '확인'}
                    </button>
                  </div>
                )}
                {isVerified && <p className={styles.verified}>인증 완료</p>}
                {authError && <p className={styles.error}>{authError}</p>}
              </div>
            </section>

            {/* 회원정보 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>회원정보 <span className={styles.required}>*</span></h2>
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>아이디 <span className={styles.required}>*</span></label>
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
                      className={styles.input}
                    />
                    <button
                      type="button"
                      className={styles.dupCheckBtn}
                      onClick={checkUserIdDuplicate}
                      disabled={userIdCheckLoading || !userId.trim()}
                    >
                      {userIdCheckLoading ? '확인 중...' : '중복 검사'}
                    </button>
                  </div>
                  {userIdChecked === true && <span className={styles.fieldSuccess}>사용 가능한 아이디입니다.</span>}
                  {formErrors.userId && <span className={styles.fieldError}>{formErrors.userId}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>비밀번호 <span className={styles.required}>*</span></label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요 (6자 이상)"
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
                  <label>사업자등록번호 <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={businessNumber}
                    onChange={(e) => setBusinessNumber(formatBusinessNumber(e.target.value))}
                    placeholder="000-00-00000"
                    maxLength={12}
                    className={styles.input}
                  />
                  {formErrors.businessNumber && <span className={styles.fieldError}>{formErrors.businessNumber}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>회사/점포명 <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="회사 또는 점포명을 입력하세요"
                    maxLength={50}
                    className={styles.input}
                  />
                  {formErrors.companyName && <span className={styles.fieldError}>{formErrors.companyName}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>대표자명 <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="대표자명을 입력하세요"
                    maxLength={20}
                    className={styles.input}
                  />
                  {formErrors.representativeName && <span className={styles.fieldError}>{formErrors.representativeName}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>사업자등록증 <span className={styles.required}>*</span></label>
                  <div className={styles.fileWrapper}>
                    <label className={styles.fileLabel}>
                      <span className={styles.fileBtn}>파일 선택</span>
                      <span className={styles.fileName}>
                        {bizFile ? bizFile.name : '사업자등록증 이미지를 첨부해주세요.'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setBizFile(e.target.files?.[0] || null)}
                        className={styles.fileInput}
                      />
                    </label>
                  </div>
                  {formErrors.bizFile && <span className={styles.fieldError}>{formErrors.bizFile}</span>}
                </div>

                <div className={styles.footer}>
                  <h4>사업자 인증이 실패하는 경우</h4>
                  <ul>
                    <li>등록한 사업자 등록증 사진이 뚜렷하게 보이지 않는 경우</li>
                    <li>최신이 아닌 사업자 등록정보 또는 휴/폐업 사업자의 경우</li>
                  </ul>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? '가입 중...' : '가입하기'}
                </button>
              </div>
            </section>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default BusinessSignup;
