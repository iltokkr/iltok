import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import styles from '@/styles/Mylist.module.css';
import signupStyles from '@/styles/BusinessSignup.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const nationalities = ['대한민국', '중국', '베트남', '필리핀', '인도네시아', '태국', '미얀마', '캄보디아', '네팔', '스리랑카', '방글라데시', '파키스탄', '우즈베키스탄', '몽골', '러시아', '카자흐스탄', '키르기스스탄', '일본', '대만', '기타'];
// 이력서(job_seeker_profiles)와 동일한 형식
const visaOptions = ['취업비자(E1-E7)', '취업비자(E9)', '취업비자(E10)', '방문취업(H2)', '재외동포(F4)', '결혼이민(F6)', '영주권(F5)', '거주(F2)', '유학(D2)', '구직비자(D-10)', '기타'];

const mapVisaFromProfile = (v: string | null): string => {
  if (!v) return '';
  const map: Record<string, string> = {
    'E1-E7': '취업비자(E1-E7)', 'H-2': '방문취업(H2)', 'F-2': '거주(F2)', 'F-4': '재외동포(F4)',
    'F-5': '영주권(F5)', 'F-6': '결혼이민(F6)', '유학': '유학(D2)', 'D-10': '구직비자(D-10)',
  };
  return map[v] ?? v;
};

interface AppliedJob {
  id: number;
  title: string;
  updated_time: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
}

interface ProfileData {
  korean_name: string;
  gender: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  nationality: string;
  visa_status: string;
  preferred_regions: string[] | null;
}

interface PersonalServiceProps {
  activeSection: 'applications' | 'info';
}

const PersonalService: React.FC<PersonalServiceProps> = ({ activeSection }) => {
  const auth = useContext(AuthContext);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [showCancelSuccessPopup, setShowCancelSuccessPopup] = useState(false);
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState<{ jdId: number; title: string } | null>(null);
  const [editForm, setEditForm] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (auth?.user?.id && activeSection === 'applications') {
      fetchAppliedJobs();
    }
  }, [auth?.user?.id, activeSection]);

  useEffect(() => {
    if (auth?.user?.id && activeSection === 'info') {
      fetchProfile();
    }
  }, [auth?.user?.id, activeSection]);

  const fetchAppliedJobs = async () => {
    if (!auth?.user?.id) return;
    const { data: bookmarks } = await supabase
      .from('bookmark')
      .select('jd_id')
      .eq('users_id', auth.user.id);
    const jdIds = (bookmarks || []).map((b: { jd_id: number }) => b.jd_id);
    if (jdIds.length === 0) {
      setAppliedJobs([]);
      return;
    }
    const { data } = await supabase
      .from('jd')
      .select('id, title, updated_time, 1depth_region, 2depth_region, 1depth_category, 2depth_category')
      .in('id', jdIds)
      .order('updated_time', { ascending: false });
    setAppliedJobs(data || []);
  };

  const fetchProfile = async () => {
    if (!auth?.user?.id) return;
    const { data } = await supabase
      .from('job_seeker_profiles')
      .select('korean_name, gender, birth_year, birth_month, birth_day, nationality, visa_status, preferred_regions')
      .eq('user_id', auth.user.id)
      .single();
    if (data) {
      const mapped = {
        ...data,
        visa_status: mapVisaFromProfile(data.visa_status) || data.visa_status || '',
      };
      setProfile(mapped);
      setEditForm(mapped);
    } else {
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', auth.user.id)
        .single();
      const base = {
        korean_name: userData?.name || '',
        gender: '',
        birth_year: 0,
        birth_month: 0,
        birth_day: 0,
        nationality: '',
        visa_status: '',
        preferred_regions: [] as string[],
      };
      setProfile(base);
      setEditForm(base);
    }
  };

  const handleRemoveApplicationClick = (job: AppliedJob) => {
    setCancelConfirmTarget({ jdId: job.id, title: job.title });
  };

  const handleRemoveApplicationConfirm = async () => {
    if (!auth?.user?.id || !cancelConfirmTarget) return;
    const { error } = await supabase.from('bookmark').delete().eq('users_id', auth.user.id).eq('jd_id', cancelConfirmTarget.jdId);
    setCancelConfirmTarget(null);
    if (!error) {
      setShowCancelSuccessPopup(true);
      fetchAppliedJobs();
    }
  };

  const handleSaveProfile = async () => {
    if (!auth?.user?.id || !editForm) return;
    const err: Record<string, string> = {};
    if (!editForm.korean_name?.trim()) err.korean_name = '이름을 입력해주세요.';
    if (!editForm.gender) err.gender = '성별을 선택해주세요.';
    if (!editForm.nationality) err.nationality = '국적을 선택해주세요.';
    if (!editForm.visa_status) err.visa_status = '비자를 선택해주세요.';
    const r1 = (editForm.preferred_regions?.[0] || '').split(' ')[0];
    if (!r1) err.preferred_regions = '거주지(시/도)를 선택해주세요.';
    else if (r1 !== '세종') {
      const r2 = (editForm.preferred_regions?.[0] || '').split(' ')[1];
      if (!r2) err.preferred_regions = '거주지(시/군/구)를 선택해주세요.';
    }
    setFormErrors(err);
    if (Object.keys(err).length > 0) return;

    setSaving(true);
    try {
      await supabase.from('users').update({ name: editForm.korean_name.trim() }).eq('id', auth.user.id);
      await supabase.from('job_seeker_profiles').upsert({
        user_id: auth.user.id,
        korean_name: editForm.korean_name.trim(),
        gender: editForm.gender,
        birth_year: editForm.birth_year || null,
        birth_month: editForm.birth_month || null,
        birth_day: editForm.birth_day || null,
        nationality: editForm.nationality,
        visa_status: editForm.visa_status,
        preferred_regions: editForm.preferred_regions?.length ? editForm.preferred_regions : null,
      }, { onConflict: 'user_id' });
      setProfile(editForm);
      alert('회원정보가 수정되었습니다.');
    } catch (e) {
      console.error(e);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const calculateAge = (year: number, month: number, day: number): number | null => {
    if (!year || !month || !day) return null;
    const birth = new Date(year, month - 1, day);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  };

  if (activeSection === 'applications') {
    return (
      <div className={styles.layout}>
        <div className={styles.guideCard}>
          <div className={styles.guideItem}>
            <span className={styles.guideCheck} aria-hidden>✓</span>
            <span className={styles.guideText}>지원한 공고 목록입니다. 공고를 클릭하면 상세 페이지로 이동합니다.</span>
          </div>
        </div>
        <div className={`${styles.tableWrap} ${styles.appliedTableWrap}`}>
          <table className={styles.adsTable}>
            <thead>
              <tr>
                <th>지원일</th>
                <th>공고</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {appliedJobs.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
                    지원한 공고가 없습니다.
                  </td>
                </tr>
              ) : (
                appliedJobs.map((job) => (
                  <tr key={job.id}>
                    <td className={styles.colDate}>{formatDate(job.updated_time)}</td>
                    <td className={styles.colAd}>
                      <div className={styles.adInfo}>
                        <Link href={`/jd/${job.id}`} className={styles.postItemTitle}>
                          {job.title}
                        </Link>
                        <span className={styles.adMeta}>
                          {job['1depth_region']} {job['2depth_region']} | {job['1depth_category']} {job['2depth_category']}
                        </span>
                      </div>
                    </td>
                    <td className={styles.colManage}>
                      <button
                        type="button"
                        className={styles.manageBtn}
                        onClick={() => handleRemoveApplicationClick(job)}
                      >
                        지원취소
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 지원 취소 확인 팝업 */}
        {cancelConfirmTarget && (
          <div className={styles.cancelSuccessOverlay} onClick={() => setCancelConfirmTarget(null)}>
            <div className={styles.cancelSuccessPopup} onClick={(e) => e.stopPropagation()}>
              <p className={styles.cancelSuccessText}>지원을 취소하시겠습니까?</p>
              {cancelConfirmTarget.title?.trim() && (
                <p className={styles.cancelSuccessSubtext}>「{cancelConfirmTarget.title}」</p>
              )}
              <div className={styles.cancelSuccessButtonRow}>
                <button
                  type="button"
                  className={styles.cancelSuccessBtnSecondary}
                  onClick={() => setCancelConfirmTarget(null)}
                >
                  아니오
                </button>
                <button
                  type="button"
                  className={styles.cancelSuccessBtn}
                  onClick={handleRemoveApplicationConfirm}
                >
                  예
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 지원 취소 완료 팝업 */}
        {showCancelSuccessPopup && (
          <div className={styles.cancelSuccessOverlay} onClick={() => setShowCancelSuccessPopup(false)}>
            <div className={styles.cancelSuccessPopup} onClick={(e) => e.stopPropagation()}>
              <div className={styles.cancelDoneIcon}>✓</div>
              <p className={styles.cancelSuccessText}>지원이 취소되었습니다</p>
              <button className={styles.cancelDoneBtn} onClick={() => setShowCancelSuccessPopup(false)}>
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'info' && editForm) {
    const regionStr = (editForm.preferred_regions && editForm.preferred_regions[0]) || '';
    const parts = regionStr.split(' ');
    const region1 = parts[0] || '';
    const region2 = parts[1] || '';
    const region2Options = region1 ? (locations[region1] || []) : [];

    return (
      <div className={signupStyles.editMain}>
        <div className={signupStyles.container}>
          <h1 className={signupStyles.title}>회원정보 수정</h1>

          <section className={signupStyles.section}>
            <h2 className={signupStyles.sectionTitle}>회원정보 <span className={signupStyles.required}>*</span></h2>
            <div className={signupStyles.form}>
              <div className={signupStyles.formGroup}>
                <label>이름 <span className={signupStyles.required}>*</span></label>
                <input
                  type="text"
                  value={editForm.korean_name}
                  onChange={(e) => setEditForm({ ...editForm, korean_name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  className={signupStyles.input}
                  maxLength={50}
                />
                {formErrors.korean_name && <span className={signupStyles.fieldError}>{formErrors.korean_name}</span>}
              </div>
              <div className={signupStyles.formGroup}>
                <label>성별 <span className={signupStyles.required}>*</span></label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className={signupStyles.input}
                >
                  <option value="">선택</option>
                  <option value="남성">남성</option>
                  <option value="여성">여성</option>
                </select>
                {formErrors.gender && <span className={signupStyles.fieldError}>{formErrors.gender}</span>}
              </div>
              <div className={signupStyles.formGroup}>
                <label>
                  생년월일
                  {(() => {
                    const age = calculateAge(editForm.birth_year || 0, editForm.birth_month || 0, editForm.birth_day || 0);
                    return age !== null ? <span className={signupStyles.optional}> (만 {age}세)</span> : null;
                  })()}
                </label>
                <div className={signupStyles.inputRow}>
                  <input
                    type="text"
                    value={editForm.birth_year || ''}
                    onChange={(e) => setEditForm({ ...editForm, birth_year: parseInt(e.target.value.replace(/\D/g, '')) || 0 })}
                    placeholder="년"
                    className={signupStyles.input}
                    maxLength={4}
                  />
                  <input
                    type="text"
                    value={editForm.birth_month || ''}
                    onChange={(e) => setEditForm({ ...editForm, birth_month: parseInt(e.target.value.replace(/\D/g, '')) || 0 })}
                    placeholder="월"
                    className={signupStyles.input}
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={editForm.birth_day || ''}
                    onChange={(e) => setEditForm({ ...editForm, birth_day: parseInt(e.target.value.replace(/\D/g, '')) || 0 })}
                    placeholder="일"
                    className={signupStyles.input}
                    maxLength={2}
                  />
                </div>
              </div>
              <div className={signupStyles.formGroup}>
                <label>국적 <span className={signupStyles.required}>*</span></label>
                <select
                  value={editForm.nationality}
                  onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                  className={signupStyles.input}
                >
                  <option value="">선택</option>
                  {nationalities.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                {formErrors.nationality && <span className={signupStyles.fieldError}>{formErrors.nationality}</span>}
              </div>
              <div className={signupStyles.formGroup}>
                <label>비자 <span className={signupStyles.required}>*</span></label>
                <select
                  value={editForm.visa_status}
                  onChange={(e) => setEditForm({ ...editForm, visa_status: e.target.value })}
                  className={signupStyles.input}
                >
                  <option value="">선택</option>
                  {visaOptions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                {formErrors.visa_status && <span className={signupStyles.fieldError}>{formErrors.visa_status}</span>}
              </div>
              <div className={signupStyles.formGroup}>
                <label>거주지 <span className={signupStyles.required}>*</span></label>
                <div className={signupStyles.inputRow}>
                  <select
                    value={region1}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditForm({ ...editForm, preferred_regions: v ? [v] : [] });
                    }}
                    className={signupStyles.input}
                  >
                    <option value="">시/도 선택</option>
                    {Object.keys(locations).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={region2}
                    onChange={(e) => setEditForm({ ...editForm, preferred_regions: region1 ? [`${region1} ${e.target.value}`.trim()] : [] })}
                    className={signupStyles.input}
                    disabled={!region1 || region1 === '세종'}
                  >
                    <option value="">시/군/구 선택</option>
                    {region2Options.map((r) => (
                      <option key={r} value={r}>{r || '전체'}</option>
                    ))}
                  </select>
                </div>
                {formErrors.preferred_regions && <span className={signupStyles.fieldError}>{formErrors.preferred_regions}</span>}
              </div>

              <div className={signupStyles.buttonRow}>
                <Link href="/my?section=applications" className={signupStyles.cancelBtn}>
                  취소
                </Link>
                <button
                  type="button"
                  className={signupStyles.submitBtn}
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '수정하기'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return null;
};

export default PersonalService;
