import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import style from '@/styles/WriteComponent.module.css';
import { createClient } from '@supabase/supabase-js';
import Modal from '@/components/Modal';
import { addHours, format, subHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import BusinessVerificationModal from '@/components/BusinessVerificationModal';
import LoginPopup from '@/components/LoginPopup';
import { AuthContext } from '@/contexts/AuthContext';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobForm {
  id?: number;
  title: string;
  board_type: string;
  // 채용조건
  experience: string;
  gender: string;
  education: string;
  age_limit: string;
  // 급여
  salary_type: string;
  salary_detail: string;
  // 근무정보
  '1depth_category': string;
  '2depth_category': string;
  '1depth_region': string;
  '2depth_region': string;
  work_location_detail: string;
  work_start_time: string;
  work_end_time: string;
  // 상세내용
  contents: string;
}

interface FormErrors {
  title: boolean;
  '1depth_category': boolean;
  '2depth_category': boolean;
  '1depth_region': boolean;
  '2depth_region': boolean;
  work_location_detail: boolean;
  contents: boolean;
}

const WritePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState<JobForm>({
    title: '',
    board_type: '0',
    experience: '무관',
    gender: '무관',
    education: '무관',
    age_limit: '무관',
    salary_type: '시급',
    salary_detail: '10320',
    '1depth_category': '',
    '2depth_category': '',
    '1depth_region': '',
    '2depth_region': '',
    work_location_detail: '',
    work_start_time: '08:00',
    work_end_time: '17:00',
    contents: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showBusinessVerificationModal, setShowBusinessVerificationModal] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    title: false,
    '1depth_category': false,
    '2depth_category': false,
    '1depth_region': false,
    '2depth_region': false,
    work_location_detail: false,
    contents: false
  });
  const auth = useContext(AuthContext);

  useEffect(() => {
    if (auth?.user) {
      setCurrentUserId(auth.user.id);
      setShowLoginPopup(false);
    } else if (auth?.user === null) {
      setShowLoginPopup(true);
    }
  }, [auth?.user]);

  useEffect(() => {
    if (id && currentUserId) {
      setIsEditing(true);
      console.log('Editing mode activated. ID:', id);
      fetchJobData(Number(id));
    }
  }, [id, currentUserId]);

  const fetchJobData = async (jobId: number) => {
    try {
      console.log('Fetching job data for ID:', jobId);
      const { data, error } = await supabase
        .from('jd')
        .select('*, uploader_id')
        .eq('id', jobId);

      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMessage('게시글을 찾을 수 없습니다.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }

      const jobData = data[0];

      if (jobData.uploader_id === null) {
        setErrorMessage('이 게시글의 작성자 정보가 없습니다. 관리자에게 문의해주세요.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }
      
      if (jobData.uploader_id !== currentUserId) {
        setErrorMessage('자신이 작성한 글만 수정할 수 있습니다.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }

      setFormData(jobData);
      console.log('Form data set:', jobData);
    } catch (error) {
      console.error('Error fetching job data:', error);
      setErrorMessage('데이터를 불러오는 중 오류가 발생했습니다.');
      setIsModalOpen(true);
    }
  };

  const validateForm = (): boolean => {
    if (formData.board_type === '4') {
      const newErrors = {
        title: formData.title.trim() === '',
        '1depth_category': false,
        '2depth_category': false,
        '1depth_region': false,
        '2depth_region': false,
        work_location_detail: false,
        contents: formData.contents.trim() === ''
      };
      setErrors(newErrors);
      return !newErrors.title && !newErrors.contents;
    } else {
      const newErrors = {
        title: formData.title.trim() === '',
        '1depth_category': formData['1depth_category'] === '',
        '2depth_category': formData['2depth_category'] === '',
        '1depth_region': formData['1depth_region'] === '',
        '2depth_region': formData['2depth_region'] === '',
        work_location_detail: formData.work_location_detail.trim() === '',
        contents: formData.contents.trim() === ''
      };
      setErrors(newErrors);
      return !Object.values(newErrors).some(error => error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 시급 유효성 검사 추가
    if (formData.board_type === '0' && formData.salary_type === '시급') {
      const hourlyWage = parseInt(formData.salary_detail);
      if (!isNaN(hourlyWage) && hourlyWage < 10320) {
        setErrorMessage('최저임금(10,320원)보다 적은 금액을 입력할 수 없습니다.');
        setIsModalOpen(true);
        return;
      }
    }

    if (!validateForm()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('로그인이 필요합니다.');
        setIsModalOpen(true);
        return;
      }

      // 자유게시판이 아닐 때만 비즈니스 인증 체크
      if (formData.board_type !== '4') {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('is_accept, is_upload')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) throw userError;

        if (!userData) {
          setErrorMessage('사용자 정보를 찾을 수 없습니다.');
          setIsModalOpen(true);
          return;
        }

        if (!isEditing && userData.is_upload) {
          setErrorMessage('공고는 하루에 하나만 올릴 수 있습니다.');
          setIsModalOpen(true);
          return;
        }
      }

      const submissionData = {
        ...formData,
        uploader_id: user.id,
        ad: false,
      };

      let response;
      if (isEditing) {
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

      // 자유게시판이거나 비즈니스 인증이 된 경우 board 페이지로 이동
      if (formData.board_type === '4') {
        router.push('/board?board_type=4');
      } else {
        const { data: userData } = await supabase
          .from('users')
          .select('is_accept')
          .eq('id', user.id)
          .single();

        if (userData?.is_accept) {
          router.push('/board');
        } else {
          setShowBusinessVerificationModal(true);
        }
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      setErrorMessage('게시글 등록에 실패했습니다. 다시 시도해주세요.');
      setIsModalOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const locations: { [key: string]: string[] } = {
    서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구","강동구"],
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

  const categories: { [key: string]: string[] } = {
    "교육·강사": ["학습지교사", "학원강사", "방과후교사", "전문강사"],
    "사무직": ["일반사무", "경리", "회계", "인사"],
    "판매·영업": ["매장관리", "판매", "영업", "텔레마케터"],
    "생산·건설": ["생산직", "건설", "기술직", "노무직"],
    "서비스직·음식": ["서빙", "요리", "미용", "숙박"],
    "IT·디자인": ["웹개발", "앱개발", "그래픽디자인", "UI/UX"],
    "운전": ["택시", "버스", "화물", "배달"]
  };

  const getInputClassName = (fieldName: string, baseClass: string) => {
    return `${baseClass} ${errors[fieldName as keyof FormErrors] ? style.errorInput : ''}`;
  };

  return (
    <div className={style.layout}>
      <form onSubmit={handleSubmit}>
        {/* 제목 및 게시판 선택 */}
        <div className={style.subSection}>
          <div className={style.formRow}>
            <div className={style.formLabel}>게시판 <span className={style.required}>*</span></div>
            <div className={style.formInput}>
              <select
                name="board_type"
                value={formData.board_type}
                onChange={handleInputChange}
                className={getInputClassName('board_type', `${style.select} ${style.boardSelect}`)}
              >
                <option value="0">구인정보</option>
                <option value="1">구직정보</option>
                <option value="2">중고시장</option>
                <option value="3">부동산정보</option>
                <option value="4">자유게시판</option>
              </select>
              <input
                name="title"
                type="text"
                className={getInputClassName('title', `${style.input} ${style.titleField}`)}
                placeholder="제목을 입력해주세요 (최대 50자)"
                value={formData.title}
                onChange={handleInputChange}
                maxLength={50}
              />
              {errors.title && <div className={style.errorText}>제목을 입력해주세요</div>}
            </div>
          </div>
        </div>

        {/* 자유게시판이 아닐 때만 추가 필드들 표시 */}
        {formData.board_type !== '4' && (
          <>
            {/* 구인정보일 때 보이는 섹션들 */}
            {formData.board_type === '0' && (
              <>
                {/* 채용 조건 */}
                <h2 className={style.sectionTitle}>채용 조건</h2>
                <div className={style.subSection}>
                  <div className={style.formRow}>
                    <div className={style.formLabel}>조건</div>
                    <div className={style.conditionFormInput}>
                      <select name="experience" value={formData.experience} onChange={handleInputChange} className={style.select}>
                        <option value="무관">경력 무관</option>
                        <option value="1년이상">1년 이상</option>
                        <option value="3년이상">3년 이상</option>
                        <option value="5년이상">5년 이상</option>
                        <option value="10년이상">10년 이상</option>
                      </select>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} className={style.select}>
                        <option value="무관">성별 무관</option>
                        <option value="남자">남자</option>
                        <option value="여자">여자</option>
                      </select>
                      <select name="education" value={formData.education} onChange={handleInputChange} className={style.select}>
                        <option value="무관">학력 무관</option>
                        <option value="고졸이상">고졸이상</option>
                        <option value="초대졸이상">초대졸이상</option>
                        <option value="대졸이상">대졸이상</option>
                      </select>
                      <select name="age_limit" value={formData.age_limit} onChange={handleInputChange} className={style.select}>
                        <option value="무관">나이 무관</option>
                        <option value="55세이하">55세 이하</option>
                        <option value="50세이하">50세 이하</option>
                        <option value="45세이하">45세 이하</option>
                        <option value="40세이하">40세 이하</option>
                        <option value="35세이하">35세 이하</option>
                      </select>
                    </div>
                  </div>
                  <div className={style.warningText}>
                    ⚠️ 성별 제한 시 남녀고용평등법 위반으로 500만 원 이하의 벌금이 부과될 수 있습니다.<br/>
                    ⚠️ 연령 제한 시 연령차별금지법 위반으로 500만 원 이하의 벌금이 부과될 수 있습니다.
                  </div>
                </div>

                {/* 급여 정보와 근무시간 */}
                <h2 className={style.sectionTitle}>급여 및 근무시간</h2>
                <div className={style.subSection}>
                  <div className={style.formGrid}>
                    <div className={style.formRow}>
                      <div className={style.formLabel}>급여</div>
                      <div className={style.formInput}>
                        <select name="salary_type" value={formData.salary_type} onChange={handleInputChange} className={style.select}>
                          <option value="시급">시급</option>
                          <option value="일급">일급</option>
                          <option value="주급">주급</option>
                          <option value="월급">월급</option>
                          <option value="협의">협의</option>
                        </select>
                        <input
                          type="text"
                          name="salary_detail"
                          value={formData.salary_detail}
                          onChange={handleInputChange}
                          className={style.input}
                          placeholder="급여 상세 정보"
                        />
                      </div>
                    </div>
                    <div className={style.formRow}>
                      <div className={style.formLabel}>근무시간</div>
                      <div className={style.formInput}>
                        <input type="time" name="work_start_time" value={formData.work_start_time} onChange={handleInputChange} className={style.timeInput} />
                        <span>~</span>
                        <input type="time" name="work_end_time" value={formData.work_end_time} onChange={handleInputChange} className={style.timeInput} />
                      </div>
                    </div>
                  </div>
                  <div className={style.warningText}>
                    ⚠️ 최저임금(10,320원)에 미달하는 급여는 법적 처벌 대상이 될 수 있습니다.<br/>
                    ⚠️ 최저임금법 위반 시 3년 이하의 징역 또는 2천만 원 이하의 벌금이 부과될 수 있습니다.
                  </div>
                </div>
              </>
            )}

            {/* 기본 정보 (게시판 타입에 따라 제목 변경) */}
            <h2 className={style.sectionTitle}>
              {formData.board_type === '0' ? '근무 정보' : '기본 정보'}
            </h2>
            <div className={style.subSection}>
              <div className={style.formRow}>
                <div className={style.formLabel}>
                  {formData.board_type === '0' ? '직무' : '카테고리'} <span className={style.required}>*</span>
                </div>
                <div className={style.formInput}>
                  <select 
                    name="1depth_category" 
                    value={formData['1depth_category']} 
                    onChange={handleInputChange} 
                    className={getInputClassName('1depth_category', style.select)}
                  >
                    <option value="">1차 분류</option>
                    {Object.keys(categories).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <select 
                    name="2depth_category" 
                    value={formData['2depth_category']} 
                    onChange={handleInputChange} 
                    className={getInputClassName('2depth_category', style.select)}
                  >
                    <option value="">2차 분류</option>
                    {formData['1depth_category'] && categories[formData['1depth_category']].map(subCategory => (
                      <option key={subCategory} value={subCategory}>{subCategory}</option>
                    ))}
                  </select>
                  {(errors['1depth_category'] || errors['2depth_category']) && 
                    <div className={style.errorText}>카테고리를 선택해주세요</div>}
                </div>
              </div>
              <div className={style.formRow}>
                <div className={style.formLabel}>
                  {formData.board_type === '0' ? '근무지' : '지역'} <span className={style.required}>*</span>
                </div>
                <div className={style.formInput}>
                  <div className={style.locationSelects}>
                    <select 
                      name="1depth_region" 
                      value={formData['1depth_region']} 
                      onChange={handleInputChange} 
                      className={getInputClassName('1depth_region', style.select)}
                    >
                      <option value="">시/도</option>
                      {Object.keys(locations).map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <select 
                      name="2depth_region" 
                      value={formData['2depth_region']} 
                      onChange={handleInputChange} 
                      className={getInputClassName('2depth_region', style.select)}
                    >
                      <option value="">시/구/군</option>
                      {formData['1depth_region'] && locations[formData['1depth_region']].map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    name="work_location_detail"
                    value={formData.work_location_detail}
                    onChange={handleInputChange}
                    className={getInputClassName('work_location_detail', style.input)}
                    placeholder="상세 주소"
                  />
                  {(errors['1depth_region'] || errors['2depth_region'] || errors.work_location_detail) && 
                    <div className={style.errorText}>지역 정보를 모두 입력해주세요</div>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 상세 내용 */}
        <h2 className={style.sectionTitle}>상세 내용</h2>
        <div className={style.subSection}>
          <textarea
            name="contents"
            className={getInputClassName('contents', style.textarea)}
            placeholder="상세 내용을 입력해주세요"
            value={formData.contents}
            onChange={handleInputChange}
          ></textarea>
          {errors.contents && <div className={style.errorText}>상세 내용을 입력해주세요</div>}
        </div>

        {/* 법적 경고 문구 */}
        {formData.board_type !== '4' && (
          <div className={style.legalWarning}>
            <p>⚠️ 성매매 알선 등 행위의 처벌에 관한 법률 제4조에 해당되는 내용이 포함된 구인 광고 관련 법령에 따라 성매매를 알선한 경우, 3년 이하의 징역형 또는 3천만 원 이하의 벌금에 처해질 수 있습니다.</p>
            <p>⚠️ 노래방 종업원 및 BAR 종업원등 유흥업소에 대한 공고는 게시가 제한됩니다.</p>
            <p>⚠️ 1개의 공고에 여러 회사의 공고를 업로드할 경우 게시가 제한됩니다.</p>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className={`${style.formGroup} ${style.ft}`}>
          <button type="submit" className={style.submitButton}>
            {isEditing ? '수정하기' : '등록하기'}
          </button>
        </div>
      </form>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p>{errorMessage}</p>
      </Modal>
      {showBusinessVerificationModal && (
        <BusinessVerificationModal onClose={() => {
          setShowBusinessVerificationModal(false);
          router.push('/board');
        }} />
      )}
      {showLoginPopup && (
        <LoginPopup onClose={() => {
          setShowLoginPopup(false);
        }} />
      )}
    </div>
  );
};

export default WritePage;
