import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '@/styles/JobSeekerProfileForm.module.css';
import Modal from '@/components/Modal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobSeekerProfile {
  id?: string;
  korean_name: string;
  english_name: string;
  gender: string;
  birth_year: string;
  birth_month: string;
  birth_day: string;
  profile_image_url: string;
  desired_jobs: string[];
  nationality: string;
  visa_status: string;
  korean_ability: string;
  work_time_preference: string[];
  pay_type_preference: string[];
  work_duration_preference: string[];
  work_day_preference: string[];
  dormitory_needed: boolean;
  message_to_employer: string;
  zip_code: string;
  address: string;
  address_detail: string;
  preferred_regions: string[];
}

const JobSeekerProfileForm: React.FC = () => {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<JobSeekerProfile>({
    korean_name: '',
    english_name: '',
    gender: '',
    birth_year: '',
    birth_month: '',
    birth_day: '',
    profile_image_url: '',
    desired_jobs: [],
    nationality: '',
    visa_status: '',
    korean_ability: '',
    work_time_preference: [],
    pay_type_preference: [],
    work_duration_preference: [],
    work_day_preference: [],
    dormitory_needed: false,
    message_to_employer: '',
    zip_code: '',
    address: '',
    address_detail: '',
    preferred_regions: [],
  });

  // 선택 옵션들
  const nationalityOptions = [
    '중국', '베트남', '필리핀', '인도네시아', '태국', '캄보디아', 
    '미얀마', '네팔', '방글라데시', '스리랑카', '파키스탄', '우즈베키스탄',
    '러시아', '몽골', '일본', '기타'
  ];

  const visaStatusOptions = [
    '취업비자(E1-E7)', '취업비자(E9)', '취업비자(E10)', 
    '방문취업(H2)', '재외동포(F4)', '결혼이민(F6)', 
    '영주권(F5)', '거주(F2)', '유학(D2)', '기타'
  ];

  const koreanAbilityOptions = [
    '대화가 가능해요', '기초 수준이에요', '유창해요', '원어민 수준이에요'
  ];

  const jobCategories = [
    '식품생산직', '건설', '농업', '어업', '제조업', '서비스업',
    '요리/조리', '청소', '포장', '운전', '사무직', '기타'
  ];

  const workTimeOptions = ['주간', '야간', '주야교대'];
  const payTypeOptions = ['일당', '주급', '월급'];
  const workDurationOptions = ['장기', '단기'];
  const workDayOptions = ['평일', '주말'];

  const locations: { [key: string]: string[] } = {
    서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"],
    부산: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
    대구: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"],
    인천: ["중구", "동구", "남구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
    광주: ["동구", "서구", "남구", "북구", "광산구"],
    대전: ["동구", "중구", "서구", "유성구", "대덕구"],
    울산: ["중구", "남구", "동구", "북구", "울주군"],
    세종: ["세종시"],
    경기: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "광명시", "김포시", "군포시", "광주시", "이천시", "양주시", "오산시", "구리시", "안성시", "포천시", "의왕시", "하남시", "여주시"],
    강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시"],
    충북: ["청주시", "충주시", "제천시"],
    충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시"],
    전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시"],
    전남: ["목포시", "여수시", "순천시", "나주시", "광양시"],
    경북: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시"],
    경남: ["창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시"],
    제주: ["제주시", "서귀포시"]
  };

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  // 기존 프로필 불러오기
  useEffect(() => {
    if (auth?.user) {
      fetchExistingProfile();
    }
  }, [auth?.user]);

  const fetchExistingProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('job_seeker_profiles')
        .select('*')
        .eq('user_id', auth?.user?.id)
        .single();

      if (data) {
        setIsEditing(true);
        setFormData({
          id: data.id,
          korean_name: data.korean_name || '',
          english_name: data.english_name || '',
          gender: data.gender || '',
          birth_year: data.birth_year?.toString() || '',
          birth_month: data.birth_month?.toString() || '',
          birth_day: data.birth_day?.toString() || '',
          profile_image_url: data.profile_image_url || '',
          desired_jobs: data.desired_jobs || [],
          nationality: data.nationality || '',
          visa_status: data.visa_status || '',
          korean_ability: data.korean_ability || '',
          work_time_preference: data.work_time_preference || [],
          pay_type_preference: data.pay_type_preference || [],
          work_duration_preference: data.work_duration_preference || [],
          work_day_preference: data.work_day_preference || [],
          dormitory_needed: data.dormitory_needed || false,
          message_to_employer: data.message_to_employer || '',
          zip_code: data.zip_code || '',
          address: data.address || '',
          address_detail: data.address_detail || '',
          preferred_regions: data.preferred_regions || [],
        });
        if (data.profile_image_url) {
          setProfileImagePreview(data.profile_image_url);
        }
      }
    } catch (error) {
      // 프로필이 없는 경우 에러를 무시
      console.log('No existing profile found');
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMultiSelect = (field: keyof JobSeekerProfile, value: string) => {
    setFormData(prev => {
      const currentValues = prev[field] as string[];
      if (currentValues.includes(value)) {
        return { ...prev, [field]: currentValues.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...currentValues, value] };
      }
    });
  };

  const handleDesiredJobToggle = (job: string) => {
    handleMultiSelect('desired_jobs', job);
  };

  const handleAddRegion = () => {
    if (selectedCity && selectedDistrict) {
      const region = `${selectedCity} ${selectedDistrict}`;
      if (!formData.preferred_regions.includes(region) && formData.preferred_regions.length < 5) {
        setFormData(prev => ({
          ...prev,
          preferred_regions: [...prev.preferred_regions, region]
        }));
        setSelectedCity('');
        setSelectedDistrict('');
      }
    }
  };

  const handleRemoveRegion = (region: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_regions: prev.preferred_regions.filter(r => r !== region)
    }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('이미지 크기는 5MB 이하여야 합니다.');
      setIsModalOpen(true);
      return;
    }

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Supabase Storage에 업로드
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${auth?.user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Storage 버킷이 없는 경우에도 로컬 미리보기는 유지
        return;
      }

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, profile_image_url: urlData.publicUrl }));
    } catch (error) {
      console.error('Image upload failed:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth?.user) {
      setErrorMessage('로그인이 필요합니다.');
      setIsModalOpen(true);
      return;
    }

    // 필수 필드 검증
    if (!formData.korean_name.trim()) {
      setErrorMessage('한글 이름을 입력해주세요.');
      setIsModalOpen(true);
      return;
    }

    setIsLoading(true);

    try {
      const profileData = {
        user_id: auth.user.id,
        korean_name: formData.korean_name,
        english_name: formData.english_name || null,
        gender: formData.gender || null,
        birth_year: formData.birth_year ? parseInt(formData.birth_year) : null,
        birth_month: formData.birth_month ? parseInt(formData.birth_month) : null,
        birth_day: formData.birth_day ? parseInt(formData.birth_day) : null,
        profile_image_url: formData.profile_image_url || null,
        desired_jobs: formData.desired_jobs.length > 0 ? formData.desired_jobs : null,
        nationality: formData.nationality || null,
        visa_status: formData.visa_status || null,
        korean_ability: formData.korean_ability || null,
        work_time_preference: formData.work_time_preference.length > 0 ? formData.work_time_preference : null,
        pay_type_preference: formData.pay_type_preference.length > 0 ? formData.pay_type_preference : null,
        work_duration_preference: formData.work_duration_preference.length > 0 ? formData.work_duration_preference : null,
        work_day_preference: formData.work_day_preference.length > 0 ? formData.work_day_preference : null,
        dormitory_needed: formData.dormitory_needed,
        message_to_employer: formData.message_to_employer || null,
        zip_code: formData.zip_code || null,
        address: formData.address || null,
        address_detail: formData.address_detail || null,
        preferred_regions: formData.preferred_regions.length > 0 ? formData.preferred_regions : null,
      };

      let response;
      if (isEditing && formData.id) {
        response = await supabase
          .from('job_seeker_profiles')
          .update(profileData)
          .eq('id', formData.id);
      } else {
        response = await supabase
          .from('job_seeker_profiles')
          .insert([profileData]);
      }

      if (response.error) throw response.error;

      setErrorMessage(isEditing ? '이력서가 수정되었습니다.' : '이력서가 등록되었습니다.');
      setIsModalOpen(true);
      
      // 성공 후 목록 페이지로 이동
      setTimeout(() => {
        router.push('/board?board_type=1');
      }, 1500);

    } catch (error: any) {
      console.error('Error saving profile:', error);
      setErrorMessage('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 년도 옵션 생성 (1950 ~ 현재년도)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>
        {isEditing ? '이력서 수정하기' : '이력서 등록하기'}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 프로필 이미지 */}
        <div className={styles.profileImageSection}>
          <div className={styles.imageWrapper}>
            {profileImagePreview ? (
              <img src={profileImagePreview} alt="프로필" className={styles.profileImage} />
            ) : (
              <div className={styles.profileImagePlaceholder}>
                <span>사진</span>
              </div>
            )}
          </div>
          <input
            type="file"
            id="profile_image"
            accept="image/*"
            onChange={handleImageChange}
            className={styles.imageInput}
          />
          <label htmlFor="profile_image" className={styles.imageLabel}>
            사진 변경
          </label>
        </div>

        {/* 한글 이름 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            한글 이름 <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            name="korean_name"
            value={formData.korean_name}
            onChange={handleInputChange}
            placeholder="한글 이름을 입력하세요"
            className={styles.input}
          />
        </div>

        {/* 영문 이름 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>영문 이름</label>
          <input
            type="text"
            name="english_name"
            value={formData.english_name}
            onChange={handleInputChange}
            placeholder="영문 이름을 입력하세요"
            className={styles.input}
          />
        </div>

        {/* 성별 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>성별</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="gender"
                value="남성"
                checked={formData.gender === '남성'}
                onChange={handleInputChange}
              />
              <span>남성</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="gender"
                value="여성"
                checked={formData.gender === '여성'}
                onChange={handleInputChange}
              />
              <span>여성</span>
            </label>
          </div>
        </div>

        {/* 생년월일 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>생년월일</label>
          <div className={styles.dateSelectGroup}>
            <select
              name="birth_year"
              value={formData.birth_year}
              onChange={handleInputChange}
              className={styles.dateSelect}
            >
              <option value="">년</option>
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              name="birth_month"
              value={formData.birth_month}
              onChange={handleInputChange}
              className={styles.dateSelect}
            >
              <option value="">월</option>
              {monthOptions.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
            <select
              name="birth_day"
              value={formData.birth_day}
              onChange={handleInputChange}
              className={styles.dateSelect}
            >
              <option value="">일</option>
              {dayOptions.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* 희망업무 */}
        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>희망업무</label>
            <button type="button" className={styles.addButton}>
              업무내용 추가하기 &gt;
            </button>
          </div>
          <div className={styles.chipGroup}>
            {jobCategories.map(job => (
              <button
                key={job}
                type="button"
                className={`${styles.chip} ${formData.desired_jobs.includes(job) ? styles.chipSelected : ''}`}
                onClick={() => handleDesiredJobToggle(job)}
              >
                {job}
              </button>
            ))}
          </div>
        </div>

        {/* 국적 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>국적</label>
          <select
            name="nationality"
            value={formData.nationality}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">국적을 선택하세요</option>
            {nationalityOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* 체류자격 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>체류자격</label>
          <select
            name="visa_status"
            value={formData.visa_status}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">체류자격을 선택하세요</option>
            {visaStatusOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* 한국어 능력 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>한국어 능력</label>
          <select
            name="korean_ability"
            value={formData.korean_ability}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">한국어 능력을 선택하세요</option>
            {koreanAbilityOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* 희망근무조건 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            희망근무조건 <span className={styles.hint}>(중복선택이 가능해요)</span>
          </label>
          
          <div className={styles.conditionRow}>
            {workTimeOptions.map(option => (
              <button
                key={option}
                type="button"
                className={`${styles.conditionChip} ${formData.work_time_preference.includes(option) ? styles.chipSelected : ''}`}
                onClick={() => handleMultiSelect('work_time_preference', option)}
              >
                {option}
              </button>
            ))}
            {payTypeOptions.map(option => (
              <button
                key={option}
                type="button"
                className={`${styles.conditionChip} ${formData.pay_type_preference.includes(option) ? styles.chipSelected : ''}`}
                onClick={() => handleMultiSelect('pay_type_preference', option)}
              >
                {option}
              </button>
            ))}
          </div>
          
          <div className={styles.conditionRow}>
            {workDurationOptions.map(option => (
              <button
                key={option}
                type="button"
                className={`${styles.conditionChip} ${formData.work_duration_preference.includes(option) ? styles.chipSelected : ''}`}
                onClick={() => handleMultiSelect('work_duration_preference', option)}
              >
                {option}
              </button>
            ))}
            {workDayOptions.map(option => (
              <button
                key={option}
                type="button"
                className={`${styles.conditionChip} ${formData.work_day_preference.includes(option) ? styles.chipSelected : ''}`}
                onClick={() => handleMultiSelect('work_day_preference', option)}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.conditionChip} ${formData.dormitory_needed ? styles.chipSelected : ''}`}
              onClick={() => setFormData(prev => ({ ...prev, dormitory_needed: !prev.dormitory_needed }))}
            >
              기숙사
            </button>
          </div>
        </div>

        {/* 사장님께 한마디 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>사장님께 한마디</label>
          <textarea
            name="message_to_employer"
            value={formData.message_to_employer}
            onChange={handleInputChange}
            placeholder="사장님께 전하고 싶은 말을 입력하세요"
            className={styles.textarea}
            rows={4}
          />
        </div>

        {/* 거주지 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>거주지</label>
          <div className={styles.addressRow}>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleInputChange}
              placeholder="우편번호"
              className={`${styles.input} ${styles.zipCode}`}
            />
            <button type="button" className={styles.addressSearchBtn}>
              주소 검색
            </button>
          </div>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="주소"
            className={styles.input}
          />
          <input
            type="text"
            name="address_detail"
            value={formData.address_detail}
            onChange={handleInputChange}
            placeholder="상세 주소"
            className={styles.input}
          />
        </div>

        {/* 근무 희망 지역 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            근무 희망 지역 <span className={styles.hint}>(5곳 까지 입력할 수 있어요)</span>
          </label>
          <div className={styles.regionSelectRow}>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedDistrict('');
              }}
              className={styles.regionSelect}
            >
              <option value="">지역 선택</option>
              {Object.keys(locations).map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className={styles.regionSelect}
              disabled={!selectedCity}
            >
              <option value="">상세 지역</option>
              {selectedCity && locations[selectedCity]?.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddRegion}
              className={styles.addRegionBtn}
              disabled={!selectedCity || !selectedDistrict || formData.preferred_regions.length >= 5}
            >
              추가
            </button>
          </div>
          <div className={styles.selectedRegions}>
            {formData.preferred_regions.map(region => (
              <span key={region} className={styles.regionTag}>
                {region}
                <button
                  type="button"
                  onClick={() => handleRemoveRegion(region)}
                  className={styles.removeRegionBtn}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isLoading}
        >
          {isLoading ? '저장 중...' : (isEditing ? '이력서 수정하기' : '이력서 저장하기')}
        </button>
      </form>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p>{errorMessage}</p>
      </Modal>
    </div>
  );
};

export default JobSeekerProfileForm;

