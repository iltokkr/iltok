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

// 지역 목록 (JobFilter와 동일)
const locations: { [key: string]: string[] } = {
  서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"],
  부산: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
  대구: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"],
  인천: ["중구", "동구", "남구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
  광주: ["동구", "서구", "남구", "북구", "광산구"],
  대전: ["동구", "중구", "서구", "유성구", "대덕구"],
  울산: ["중구", "남구", "동구", "북구", "울주군"],
  세종: [""],
  경기: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "광명시", "김포시", "군포시", "광주시", "이천시", "양주시", "오산시", "구리시", "안성시", "포천시", "의왕시", "하남시", "여주시", "여주군", "양평군", "동두천시", "과천시", "가평군", "연천군"],
  강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"],
  충북: ["청주시", "충주시", "제천시", "청원군", "보은군", "옥천군", "영동군", "진천군", "괴산군", "음성군", "단양군", "증평군"],
  충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "당진군", "금산군", "연기군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
  전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
  전남: ["목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"],
  경북: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"],
  경남: ["창원시", "마산시", "진주시", "진해시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"],
  제주: ["제주시", "서귀포시", "북제주군", "남제주군"]
};

const nationalities = [
  '대한민국', '중국', '베트남', '필리핀', '인도네시아', '태국', '미얀마', '캄보디아',
  '네팔', '스리랑카', '방글라데시', '파키스탄', '우즈베키스탄', '몽골',
  '러시아', '카자흐스탄', '키르기스스탄', '일본', '대만', '기타'
];

const visaOptions = [
  'E1-E7', 'H-2', 'F-2', 'F-4', 'F-5', 'F-6', '유학', 'D-10', '기타'
];

const PersonalSignup = () => {
  const router = useRouter();

  const [ageAgreed, setAgeAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const [phone, setPhone] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [nationality, setNationality] = useState('');
  const [visa, setVisa] = useState('');
  const [region1, setRegion1] = useState('');
  const [region2, setRegion2] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPhoneForApi = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.startsWith('0')) return '+82' + numbers.slice(1);
    return '+' + numbers;
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
          if (existingUser.user_type === 'jobseeker') {
            await supabase.auth.signOut();
            setAuthError('이미 개인회원으로 가입된 번호입니다.');
            return;
          }
          if (existingUser.user_type === 'both') {
            await supabase.auth.signOut();
            setAuthError('이미 기업·개인 회원으로 가입된 번호입니다.');
            return;
          }
          if (existingUser.user_type === 'business') {
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
    const err: Record<string, string> = {};
    if (!ageAgreed || !termsAgreed) {
      alert('필수 약관에 모두 동의해주세요.');
      return false;
    }
    if (!isVerified) {
      alert('본인인증을 완료해주세요.');
      return false;
    }
    if (!name.trim()) err.name = '이름을 입력해주세요.';
    if (!gender) err.gender = '성별을 선택해주세요.';
    if (!birthYear || !birthMonth || !birthDay) err.birth = '생년월일을 입력해주세요.';
    if (!nationality) err.nationality = '국적을 선택해주세요.';
    if (!visa) err.visa = '비자를 선택해주세요.';
    if (!region1) err.region = '거주지(시/도)를 선택해주세요.';
    if (region1 && region1 !== '세종' && !region2) err.region = '거주지(시/군/구)를 선택해주세요.';

    // 만 15세 체크
    if (birthYear && birthMonth && birthDay) {
      const birth = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 15) {
        err.birth = '만 15세 이상만 가입 가능합니다.';
      }
    }

    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('본인인증이 만료되었습니다. 처음부터 다시 진행해주세요.');
      router.push('/signup/personal');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedPhone = formatPhoneForApi(phone);
      const residence = region2 ? `${region1} ${region2}` : region1;

      const { data: existingUser } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle();

      const newUserType = existingUser?.user_type === 'business' ? 'both' : 'jobseeker';
      const userData = {
        id: user.id,
        number: formattedPhone,
        name: name.trim(),
        user_type: newUserType,
        policy_term: termsAgreed,
      };

      const { error: userError } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'id' });

      if (userError) throw userError;

      const profileData = {
        user_id: user.id,
        korean_name: name.trim(),
        gender: gender,
        birth_year: parseInt(birthYear),
        birth_month: parseInt(birthMonth),
        birth_day: parseInt(birthDay),
        nationality,
        visa_status: visa,
        preferred_regions: [residence],
      };

      const { error: profileError } = await supabase
        .from('job_seeker_profiles')
        .upsert(profileData, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      alert('회원가입이 완료되었습니다.');
      router.push('/my');
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const region2Options = region1 ? (locations[region1] || []) : [];

  return (
    <>
      <Head>
        <title>개인 회원가입 | 114114KR</title>
      </Head>
      <Header />
      <MainMenu showMenuItems={false} />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>개인 회원가입</h1>

          <form onSubmit={handleSubmit}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>약관동의 <span className={styles.required}>*</span></h2>
              <div className={styles.termsGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={ageAgreed}
                    onChange={(e) => setAgeAgreed(e.target.checked)}
                  />
                  <span>(필수) 만 15세 이상입니다.</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  <span>(필수) 서비스 이용약관 동의</span>
                  <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className={styles.termsBtn}>
                    내용 보기
                  </Link>
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>번호인증 <span className={styles.required}>*</span></h2>
              <p className={styles.verified} style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                핸드폰 번호가 아이디입니다. 비밀번호 없이 해당 번호로 인증하면 로그인됩니다.
              </p>
              <div className={styles.authGroup}>
                <div className={styles.inputRow}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="전화번호 (01012345678)"
                    className={`${styles.input} ${isVerified ? styles.inputReadonly : ''}`}
                    readOnly={isVerified}
                  />
                  {!isVerified && (
                    <button type="button" className={styles.authBtn} onClick={handleSendOtp} disabled={authLoading}>
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
                      placeholder="인증번호 6자리"
                      className={styles.input}
                    />
                    <button type="button" className={styles.authBtn} onClick={handleVerifyOtp} disabled={authLoading}>
                      {authLoading ? '확인 중...' : '확인'}
                    </button>
                  </div>
                )}
                {isVerified && <p className={styles.verified}>인증 완료</p>}
                {authError && <p className={styles.error}>{authError}</p>}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>회원정보 <span className={styles.required}>*</span></h2>
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>이름 <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className={styles.input}
                    maxLength={50}
                  />
                  {formErrors.name && <span className={styles.fieldError}>{formErrors.name}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>성별 <span className={styles.required}>*</span></label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">선택</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                  {formErrors.gender && <span className={styles.fieldError}>{formErrors.gender}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>생년월일 <span className={styles.required}>*</span></label>
                  <div className={styles.inputRow}> 
                    <input
                      type="text"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="년"
                      className={styles.input}
                      maxLength={4}
                    />
                    <input
                      type="text"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="월"
                      className={styles.input}
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="일"
                      className={styles.input}
                      maxLength={2}
                    />
                  </div>
                  {formErrors.birth && <span className={styles.fieldError}>{formErrors.birth}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>국적 <span className={styles.required}>*</span></label>
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">선택</option>
                    {nationalities.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  {formErrors.nationality && <span className={styles.fieldError}>{formErrors.nationality}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>비자 <span className={styles.required}>*</span></label>
                  <select
                    value={visa}
                    onChange={(e) => setVisa(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">선택</option>
                    {visaOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  {formErrors.visa && <span className={styles.fieldError}>{formErrors.visa}</span>}
                </div>
                <div className={styles.formGroup}>
                  <label>거주지 <span className={styles.required}>*</span></label>
                  <div className={styles.inputRow}>
                    <select
                      value={region1}
                      onChange={(e) => { setRegion1(e.target.value); setRegion2(''); }}
                      className={styles.input}
                    >
                      <option value="">시/도 선택</option>
                      {Object.keys(locations).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <select
                      value={region2}
                      onChange={(e) => setRegion2(e.target.value)}
                      className={styles.input}
                      disabled={!region1 || region1 === '세종'}
                    >
                      <option value="">시/군/구 선택</option>
                      {region2Options.map((r) => (
                        <option key={r} value={r}>{r || '전체'}</option>
                      ))}
                    </select>
                  </div>
                  {formErrors.region && <span className={styles.fieldError}>{formErrors.region}</span>}
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

export default PersonalSignup;
