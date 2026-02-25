import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import styles from '@/styles/Mylist.module.css';
import filterStyles from '@/styles/JobFilter.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import SelectDropdown from './SelectDropdown';

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
const visaOptions = ['E1-E7', 'H-2', 'F-2', 'F-4', 'F-5', 'F-6', '유학', 'D-10', '기타'];

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
      setProfile(data);
      setEditForm(data);
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

  const handleRemoveApplication = async (jdId: number) => {
    if (!auth?.user?.id) return;
    if (!confirm('지원을 취소하시겠습니까?')) return;
    const { error } = await supabase.from('bookmark').delete().eq('users_id', auth.user.id).eq('jd_id', jdId);
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
                        onClick={() => handleRemoveApplication(job.id)}
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

        {/* 지원 취소 완료 팝업 */}
        {showCancelSuccessPopup && (
          <div className={styles.cancelSuccessOverlay} onClick={() => setShowCancelSuccessPopup(false)}>
            <div className={styles.cancelSuccessPopup} onClick={(e) => e.stopPropagation()}>
              <div className={styles.cancelSuccessIcon}>✓</div>
              <p className={styles.cancelSuccessText}>지원이 취소되었습니다</p>
              <button className={styles.cancelSuccessBtn} onClick={() => setShowCancelSuccessPopup(false)}>
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
    const r1 = parts[0] || '';
    const r2 = parts[1] || '';
    const region1 = r1;
    const region2 = r2;

    return (
      <div className={styles.layout}>
        <div className={styles.infoSection}>
          <p className={styles.infoSectionDesc}>회원 정보를 수정할 수 있습니다.</p>
          <div className={styles.profileForm}>
            <div className={styles.profileFormSection}>
              <span className={filterStyles.sectionLabel}>이름</span>
              <input
                type="text"
                className={styles.profileFormInput}
                value={editForm.korean_name}
                onChange={(e) => setEditForm({ ...editForm, korean_name: e.target.value })}
              />
              {formErrors.korean_name && <span className={styles.profileFormError}>{formErrors.korean_name}</span>}
            </div>
            <div className={styles.profileFormSection}>
              <span className={filterStyles.sectionLabel}>성별</span>
              <SelectDropdown
                placeholder="선택"
                value={editForm.gender}
                options={[
                  { value: '', label: '선택' },
                  { value: '남성', label: '남성' },
                  { value: '여성', label: '여성' }
                ]}
                onSelect={(v) => setEditForm({ ...editForm, gender: v })}
              />
              {formErrors.gender && <span className={styles.profileFormError}>{formErrors.gender}</span>}
            </div>
            <div className={styles.profileFormSection}>
              <span className={filterStyles.sectionLabel}>생년월일</span>
              <div className={styles.profileFormRow}>
                <input
                  type="text"
                  className={styles.profileFormInput}
                  value={editForm.birth_year || ''}
                  onChange={(e) => setEditForm({ ...editForm, birth_year: parseInt(e.target.value) || 0 })}
                  placeholder="년"
                />
                <input
                  type="text"
                  className={styles.profileFormInput}
                  value={editForm.birth_month || ''}
                  onChange={(e) => setEditForm({ ...editForm, birth_month: parseInt(e.target.value) || 0 })}
                  placeholder="월"
                />
                <input
                  type="text"
                  className={styles.profileFormInput}
                  value={editForm.birth_day || ''}
                  onChange={(e) => setEditForm({ ...editForm, birth_day: parseInt(e.target.value) || 0 })}
                  placeholder="일"
                />
              </div>
            </div>
            <div className={styles.profileFormSection}>
              <span className={filterStyles.sectionLabel}>국적</span>
              <SelectDropdown
                placeholder="선택"
                value={editForm.nationality}
                options={[
                  { value: '', label: '선택' },
                  ...nationalities.map((n) => ({ value: n, label: n }))
                ]}
                onSelect={(v) => setEditForm({ ...editForm, nationality: v })}
              />
              {formErrors.nationality && <span className={styles.profileFormError}>{formErrors.nationality}</span>}
            </div>
            <div className={styles.profileFormSection}>
              <span className={filterStyles.sectionLabel}>비자</span>
              <SelectDropdown
                placeholder="선택"
                value={editForm.visa_status}
                options={[
                  { value: '', label: '선택' },
                  ...visaOptions.map((v) => ({ value: v, label: v }))
                ]}
                onSelect={(v) => setEditForm({ ...editForm, visa_status: v })}
              />
              {formErrors.visa_status && <span className={styles.profileFormError}>{formErrors.visa_status}</span>}
            </div>
            <div className={styles.profileFormSection}>
              <span className={filterStyles.sectionLabel}>거주지</span>
              <div className={styles.profileFormRow}>
                <SelectDropdown
                  placeholder="시/도"
                  value={region1}
                  options={[
                    { value: '', label: '시/도' },
                    ...Object.keys(locations).map((r) => ({ value: r, label: r }))
                  ]}
                  onSelect={(v) => setEditForm({ ...editForm, preferred_regions: v ? [v] : [] })}
                />
                <SelectDropdown
                  placeholder="시/군/구"
                  value={region2}
                  options={[
                    { value: '', label: '시/군/구' },
                    ...(locations[region1] || []).map((r) => ({ value: r, label: r || '전체' }))
                  ]}
                  onSelect={(v) => setEditForm({ ...editForm, preferred_regions: region1 ? [`${region1} ${v}`.trim()] : [] })}
                  disabled={!region1 || region1 === '세종'}
                />
              </div>
            </div>
            <button
              type="button"
              className={`${styles.infoEditBtn} ${styles.profileFormBtn}`}
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PersonalService;
