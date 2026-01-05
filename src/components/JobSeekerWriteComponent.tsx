import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/JobSeekerWrite.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CareerItem {
  id: string;
  company_name: string;
  work_status: '재직중' | '계약종료';
  start_date: string;
  end_date: string;
  job_duties: string[];
}

interface ResumeForm {
  id?: number;
  title: string;
  korean_name: string;
  english_name: string;
  gender: string;
  birth_date: string;
  nationality: string;
  visa_status: string;
  korean_ability: string;
  work_conditions: string[];
  '1depth_category': string;
  '2depth_category': string;
  desired_regions: string[];
  career_history: CareerItem[];
  contents: string;
}

// 국적 목록
const nationalities = [
  '중국', '베트남', '필리핀', '인도네시아', '태국', '미얀마', '캄보디아',
  '네팔', '스리랑카', '방글라데시', '파키스탄', '우즈베키스탄', '몽골',
  '러시아', '카자흐스탄', '키르기스스탄', '일본', '대만', '기타'
];

// 체류자격 목록
const visaStatuses = [
  '취업비자(E1-E7)', '방문취업(H-2)', '재외동포(F-4)', '영주(F-5)',
  '결혼이민(F-6)', '유학생(D2~D4)', '구직비자(D-10)', '기타'
];

// 한국어 능력
const koreanAbilities = [
  '대화가 가능해요', '기초 회화 가능', '의사소통 어려움', '몰라요'
];

// 희망 근무조건
const workConditionOptions = [
  '주간', '야간', '주야교대', '일당', '주급', '장기', '단기', '평일', '주말', '기숙사'
];

// 직무 카테고리
const jobCategories: { [key: string]: string[] } = {
  "제조/가공/조립": ["단순조립", "기계조작", "품질검사", "포장"],
  "기기부품제조": ["전자부품", "자동차부품", "기계부품"],
  "식품생산직": ["식품가공", "식품포장", "위생관리"],
  "지게차 운전": ["지게차", "물류운반"],
  "재단/재봉": ["재단", "재봉", "봉제"],
  "공사/건설현장": ["건설보조", "철근", "형틀", "용접"],
  "조선소": ["용접", "도장", "배관"],
  "운반/설치/철거": ["운반", "설치", "철거", "이사"],
  "금형/사출/프레스/사상": ["금형", "사출", "프레스", "사상"],
  "인테리어/보수공사": ["인테리어", "도배", "타일", "페인트"],
  "기타": ["기타"]
};

// 지역 목록
const regions: { [key: string]: string[] } = {
  서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"],
  경기: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "광명시", "김포시", "군포시", "광주시", "이천시", "양주시", "오산시", "구리시", "안성시", "포천시", "의왕시", "하남시", "여주시"],
  인천: ["중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
  부산: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
  대구: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"],
  광주: ["동구", "서구", "남구", "북구", "광산구"],
  대전: ["동구", "중구", "서구", "유성구", "대덕구"],
  울산: ["중구", "남구", "동구", "북구", "울주군"],
  세종: ["세종시"],
  강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시"],
  충북: ["청주시", "충주시", "제천시"],
  충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시"],
  전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시"],
  전남: ["목포시", "여수시", "순천시", "나주시", "광양시"],
  경북: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시"],
  경남: ["창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시"],
  제주: ["제주시", "서귀포시"]
};

const JobSeekerWriteComponent: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const auth = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCareerModal, setShowCareerModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [selectedRegion1, setSelectedRegion1] = useState('');
  
  const [formData, setFormData] = useState<ResumeForm>({
    title: '',
    korean_name: '',
    english_name: '',
    gender: '',
    birth_date: '',
    nationality: '',
    visa_status: '',
    korean_ability: '',
    work_conditions: [],
    '1depth_category': '',
    '2depth_category': '',
    desired_regions: [],
    career_history: [],
    contents: ''
  });

  const [newCareer, setNewCareer] = useState<CareerItem>({
    id: '',
    company_name: '',
    work_status: '계약종료',
    start_date: '',
    end_date: '',
    job_duties: []
  });

  // 이전 데이터 불러오기
  useEffect(() => {
    const loadPreviousData = async () => {
      if (!auth?.user) {
        setIsLoading(false);
        return;
      }

      try {
        // 수정 모드인 경우
        if (id) {
          setIsEditing(true);
          const { data, error } = await supabase
            .from('jd')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;
          if (data) {
            setFormData({
              ...data,
              work_conditions: data.work_conditions ? JSON.parse(data.work_conditions) : [],
              desired_regions: data.desired_regions ? JSON.parse(data.desired_regions) : [],
              career_history: data.career_history ? JSON.parse(data.career_history) : []
            });
          }
        } else {
          // 새 글 작성 시 이전 데이터 불러오기
          const { data, error } = await supabase
            .from('jd')
            .select('*')
            .eq('uploader_id', auth.user.id)
            .eq('board_type', '1')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (data && !error) {
            setFormData({
              ...data,
              id: undefined, // 새 글이므로 id 제거
              title: '', // 제목은 새로 입력
              contents: '', // 내용도 새로 입력
              work_conditions: data.work_conditions ? JSON.parse(data.work_conditions) : [],
              desired_regions: data.desired_regions ? JSON.parse(data.desired_regions) : [],
              career_history: data.career_history ? JSON.parse(data.career_history) : []
            });
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreviousData();
  }, [auth?.user, id]);

  // 나이 계산
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWorkConditionToggle = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      work_conditions: prev.work_conditions.includes(condition)
        ? prev.work_conditions.filter(c => c !== condition)
        : [...prev.work_conditions, condition]
    }));
  };

  const handleAddRegion = (region: string) => {
    if (formData.desired_regions.length >= 5) {
      alert('최대 5개까지 선택 가능합니다.');
      return;
    }
    if (!formData.desired_regions.includes(region)) {
      setFormData(prev => ({
        ...prev,
        desired_regions: [...prev.desired_regions, region]
      }));
    }
  };

  const handleRemoveRegion = (region: string) => {
    setFormData(prev => ({
      ...prev,
      desired_regions: prev.desired_regions.filter(r => r !== region)
    }));
  };

  const handleCategorySelect = (category: string, subCategory: string) => {
    setFormData(prev => ({
      ...prev,
      '1depth_category': category,
      '2depth_category': subCategory
    }));
    setShowCategoryModal(false);
  };

  const handleAddCareer = () => {
    if (!newCareer.company_name || !newCareer.start_date) {
      alert('업체명과 시작일을 입력해주세요.');
      return;
    }
    
    const careerWithId = {
      ...newCareer,
      id: Date.now().toString()
    };
    
    setFormData(prev => ({
      ...prev,
      career_history: [...prev.career_history, careerWithId]
    }));
    
    setNewCareer({
      id: '',
      company_name: '',
      work_status: '계약종료',
      start_date: '',
      end_date: '',
      job_duties: []
    });
    setShowCareerModal(false);
  };

  const handleRemoveCareer = (careerId: string) => {
    setFormData(prev => ({
      ...prev,
      career_history: prev.career_history.filter(c => c.id !== careerId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth?.user) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 필수 항목 검증
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!formData.gender) {
      alert('성별을 선택해주세요.');
      return;
    }
    if (!formData.birth_date) {
      alert('생년월일을 입력해주세요.');
      return;
    }
    if (!formData['1depth_category']) {
      alert('희망업무를 선택해주세요.');
      return;
    }
    if (!formData.nationality) {
      alert('국적을 선택해주세요.');
      return;
    }
    if (!formData.visa_status) {
      alert('체류자격을 선택해주세요.');
      return;
    }
    if (!formData.korean_ability) {
      alert('한국어 능력을 선택해주세요.');
      return;
    }
    if (formData.desired_regions.length === 0) {
      alert('희망 지역을 선택해주세요.');
      return;
    }

    try {
      const submissionData = {
        ...formData,
        board_type: '1',
        uploader_id: auth.user.id,
        work_conditions: JSON.stringify(formData.work_conditions),
        desired_regions: JSON.stringify(formData.desired_regions),
        career_history: JSON.stringify(formData.career_history),
        '1depth_region': formData.desired_regions[0]?.split(' ')[0] || '',
        '2depth_region': formData.desired_regions[0]?.split(' ')[1] || ''
      };

      let response;
      if (isEditing && id) {
        response = await supabase
          .from('jd')
          .update(submissionData)
          .eq('id', id);
      } else {
        response = await supabase
          .from('jd')
          .insert([submissionData]);
      }

      if (response.error) throw response.error;

      setShowSuccessPopup(true);
    } catch (error) {
      console.error('Error submitting:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit}>
        {/* 제목 */}
        <div className={styles.section}>
          <label className={styles.label}>제목 <span className={styles.required}>*</span></label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={styles.input}
            placeholder="제목을 입력해주세요"
            maxLength={40}
          />
        </div>

        {/* 기본 정보 */}
        <div className={styles.sectionTitle}>기본 정보</div>
        
        <div className={styles.row}>
          <div className={styles.halfField}>
            <label className={styles.label}>한글 이름</label>
            <input
              type="text"
              name="korean_name"
              value={formData.korean_name}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="홍길동"
            />
          </div>
          <div className={styles.halfField}>
            <label className={styles.label}>영문 이름</label>
            <input
              type="text"
              name="english_name"
              value={formData.english_name}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Hong Gil Dong"
            />
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>성별 <span className={styles.required}>*</span></label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="gender"
                value="남"
                checked={formData.gender === '남'}
                onChange={handleInputChange}
              />
              <span>남성</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="gender"
                value="여"
                checked={formData.gender === '여'}
                onChange={handleInputChange}
              />
              <span>여성</span>
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>
            생년월일 <span className={styles.required}>*</span>
            {formData.birth_date && (
              <span className={styles.ageDisplay}>(만 {calculateAge(formData.birth_date)}세)</span>
            )}
          </label>
          <input
            type="date"
            name="birth_date"
            value={formData.birth_date}
            onChange={handleInputChange}
            className={styles.input}
          />
        </div>

        <div className={styles.divider} />

        {/* 희망업무 */}
        <div className={styles.section}>
          <div className={styles.labelRow}>
            <label className={styles.label}>희망업무 <span className={styles.required}>*</span></label>
            <button 
              type="button" 
              className={styles.addButton}
              onClick={() => setShowCategoryModal(true)}
            >
              업무내용 추가하기 &gt;
            </button>
          </div>
          {formData['1depth_category'] && (
            <div className={styles.selectedTag}>
              {formData['1depth_category']}
              {formData['2depth_category'] && ` > ${formData['2depth_category']}`}
            </div>
          )}
        </div>

        {/* 국적 */}
        <div className={styles.section}>
          <label className={styles.label}>국적 <span className={styles.required}>*</span></label>
          <select
            name="nationality"
            value={formData.nationality}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">선택</option>
            {nationalities.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* 체류자격 */}
        <div className={styles.section}>
          <label className={styles.label}>체류자격 <span className={styles.required}>*</span></label>
          <select
            name="visa_status"
            value={formData.visa_status}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">선택</option>
            {visaStatuses.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* 한국어 능력 */}
        <div className={styles.section}>
          <label className={styles.label}>한국어 능력 <span className={styles.required}>*</span></label>
          <select
            name="korean_ability"
            value={formData.korean_ability}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">선택</option>
            {koreanAbilities.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* 희망 근무조건 */}
        <div className={styles.section}>
          <label className={styles.label}>희망 근무조건 <span className={styles.subLabel}>(중복선택이 가능해요)</span></label>
          <div className={styles.tagContainer}>
            {workConditionOptions.map(condition => (
              <button
                key={condition}
                type="button"
                className={`${styles.tag} ${formData.work_conditions.includes(condition) ? styles.tagSelected : ''}`}
                onClick={() => handleWorkConditionToggle(condition)}
              >
                {condition}
              </button>
            ))}
          </div>
        </div>

        {/* 희망 지역 */}
        <div className={styles.section}>
          <div className={styles.labelRow}>
            <label className={styles.label}>
              희망 지역 <span className={styles.required}>*</span>
              <span className={styles.subLabel}>(5곳 까지 입력할 수 있어요)</span>
            </label>
          </div>
          <button
            type="button"
            className={styles.regionSelectBtn}
            onClick={() => setShowRegionModal(true)}
          >
            지역 선택 &gt;
          </button>
          {formData.desired_regions.length > 0 && (
            <div className={styles.selectedRegions}>
              {formData.desired_regions.map(region => (
                <span key={region} className={styles.regionTag}>
                  {region}
                  <button 
                    type="button" 
                    className={styles.removeTag}
                    onClick={() => handleRemoveRegion(region)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* 경력 */}
        <div className={styles.section}>
          <label className={styles.label}>경력사항</label>
          {formData.career_history.map(career => (
            <div key={career.id} className={styles.careerCard}>
              <div className={styles.careerHeader}>
                <strong>{career.company_name}</strong>
                <div className={styles.careerActions}>
                  <button 
                    type="button" 
                    className={styles.deleteBtn}
                    onClick={() => handleRemoveCareer(career.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className={styles.careerInfo}>
                {career.job_duties.join(', ')}
              </div>
              <div className={styles.careerDate}>
                {career.start_date} ~ {career.end_date || '현재'}
                <span className={`${styles.statusBadge} ${career.work_status === '재직중' ? styles.working : ''}`}>
                  {career.work_status}
                </span>
              </div>
            </div>
          ))}
          <button
            type="button"
            className={styles.addCareerBtn}
            onClick={() => setShowCareerModal(true)}
          >
            경력 추가하기
          </button>
        </div>

        <div className={styles.divider} />

        {/* 사장님께 한마디 */}
        <div className={styles.section}>
          <label className={styles.label}>사장님께 한마디</label>
          <textarea
            name="contents"
            value={formData.contents}
            onChange={handleInputChange}
            className={styles.textarea}
            placeholder="자기소개나 특이사항을 입력해주세요"
            rows={5}
          />
        </div>

        {/* 등록 버튼 */}
        <div className={styles.submitArea}>
          <button type="submit" className={styles.submitButton}>
            {isEditing ? '수정하기' : '이력서 저장하기'}
          </button>
        </div>
      </form>

      {/* 희망업무 모달 */}
      {showCategoryModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCategoryModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>업무 목록</h3>
              <button className={styles.modalClose} onClick={() => setShowCategoryModal(false)}>×</button>
            </div>
            <p className={styles.modalSubtitle}>최대 3개 중복 선택이 가능해요</p>
            <div className={styles.categoryList}>
              {Object.keys(jobCategories).map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.categoryTag} ${formData['1depth_category'] === cat ? styles.categorySelected : ''}`}
                  onClick={() => handleCategorySelect(cat, '')}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <input
                type="text"
                placeholder="기타 업무를 입력해주세요"
                className={styles.otherInput}
              />
            </div>
            <button className={styles.modalSubmitBtn} onClick={() => setShowCategoryModal(false)}>
              추가하기
            </button>
          </div>
        </div>
      )}

      {/* 지역 선택 모달 */}
      {showRegionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRegionModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>지역 선택</h3>
              <button className={styles.modalClose} onClick={() => setShowRegionModal(false)}>×</button>
            </div>
            <div className={styles.regionSelector}>
              <div className={styles.regionColumn}>
                {Object.keys(regions).map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.regionItem} ${selectedRegion1 === r ? styles.regionSelected : ''}`}
                    onClick={() => setSelectedRegion1(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className={styles.regionColumn}>
                {selectedRegion1 && regions[selectedRegion1].map(r => (
                  <button
                    key={r}
                    type="button"
                    className={styles.regionItem}
                    onClick={() => {
                      handleAddRegion(`${selectedRegion1} ${r}`);
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 경력 추가 모달 */}
      {showCareerModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCareerModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>경력 추가하기</h3>
              <button className={styles.modalClose} onClick={() => setShowCareerModal(false)}>×</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>업체명</label>
                <input
                  type="text"
                  value={newCareer.company_name}
                  onChange={e => setNewCareer({...newCareer, company_name: e.target.value})}
                  placeholder="업체명을 입력해 주세요"
                  className={styles.input}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>근무상태</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={newCareer.work_status === '재직중'}
                      onChange={() => setNewCareer({...newCareer, work_status: '재직중'})}
                    />
                    <span>재직중</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={newCareer.work_status === '계약종료'}
                      onChange={() => setNewCareer({...newCareer, work_status: '계약종료'})}
                    />
                    <span>계약종료</span>
                  </label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>근무기간</label>
                <div className={styles.dateRange}>
                  <input
                    type="month"
                    value={newCareer.start_date}
                    onChange={e => setNewCareer({...newCareer, start_date: e.target.value})}
                    className={styles.dateInput}
                  />
                  <span>~</span>
                  <input
                    type="month"
                    value={newCareer.end_date}
                    onChange={e => setNewCareer({...newCareer, end_date: e.target.value})}
                    className={styles.dateInput}
                    disabled={newCareer.work_status === '재직중'}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>담당업무</label>
                <div className={styles.tagContainer}>
                  {Object.keys(jobCategories).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.tag} ${newCareer.job_duties.includes(cat) ? styles.tagSelected : ''}`}
                      onClick={() => {
                        setNewCareer(prev => ({
                          ...prev,
                          job_duties: prev.job_duties.includes(cat)
                            ? prev.job_duties.filter(d => d !== cat)
                            : [...prev.job_duties, cat]
                        }));
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className={styles.modalSubmitBtn} onClick={handleAddCareer}>
              추가하기
            </button>
          </div>
        </div>
      )}

      {/* 등록 완료 팝업 */}
      {showSuccessPopup && (
        <div className={styles.modalOverlay}>
          <div className={styles.successPopup}>
            <div className={styles.successIcon}>
              <img src="/icons/resume-complete-icon.svg" alt="" />
            </div>
            <h2>이력서 등록이 완료되었습니다</h2>
            <p>이제 편하게 일자리를 찾아보세요!</p>
            <div className={styles.successButtons}>
              <button 
                className={styles.successCloseBtn}
                onClick={() => {
                  setShowSuccessPopup(false);
                  router.push('/board?board_type=0');
                }}
              >
                닫기
              </button>
              <button 
                className={styles.successViewBtn}
                onClick={() => {
                  setShowSuccessPopup(false);
                  router.push('/my');
                }}
              >
                이력서 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobSeekerWriteComponent;

