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

// Supabase ?�라?�언???�정
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
  // 근무?�보
  '1depth_category': string;
  '2depth_category': string;
  '1depth_region': string;
  '2depth_region': string;
  work_location_detail: string;
  work_start_time: string;
  work_end_time: string;
  // ?�세?�용
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
  const { id } = router.query; // URL?�서 id ?�라미터 가?�오�?
  const [formData, setFormData] = useState<JobForm>({
    title: '',
    board_type: '0',
    experience: '무�?',
    gender: '무�?',
    education: '무�?',
    age_limit: '무�?',
    salary_type: '?�급',
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
      setShowLoginPopup(false); // 로그?�된 ?�태�??�업 ?��?
    }
  }, [auth?.user]);

  useEffect(() => {
    if (id && currentUserId) {
      setIsEditing(true);
      console.log('Editing mode activated. ID:', id);
      fetchJobData(Number(id));
    }
  }, [id, currentUserId]);

  const checkLoginStatus = async () => {
    if (!auth?.user) {
      setShowLoginPopup(true);
    }
  };

  const handleLoginPopupClose = () => {
    if (auth?.user) {
      setShowLoginPopup(false);
      setCurrentUserId(auth.user.id);
    }
  };

  const fetchJobData = async (jobId: number) => {
    try {
      console.log('Fetching job data for ID:', jobId);
      const { data, error } = await supabase
        .from('jd')
        .select('*, uploader_id')
        .eq('id', jobId);

      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMessage('게시글??찾을 ???�습?�다.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }

      const jobData = data[0]; // Get the first row

      if (jobData.uploader_id === null) {
        setErrorMessage('??게시글???�성???�보가 ?�습?�다. 관리자?�게 문의?�주?�요.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }
      
      if (jobData.uploader_id !== currentUserId) {
        setErrorMessage('?�신???�성??글�??�정?????�습?�다.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }

      setFormData(jobData);
      console.log('Form data set:', jobData);
    } catch (error) {
      console.error('Error fetching job data:', error);
      setErrorMessage('?�이?��? 불러?�는  ?�류가 발생?�습?�다.');
      setIsModalOpen(true);
    }
  };

  const validateForm = (): boolean => {
    if (formData.board_type === '4') {
      // ?�유게시?�일 ?�는 ?�목�??�용�?검??
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
      // ?�른 게시?�일 ?�는 기존 검???��?
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

    // ?�급 ?�효??검??추�?
    if (formData.board_type === '0' && formData.salary_type === '?�급') {
      const hourlyWage = parseInt(formData.salary_detail);
      if (!isNaN(hourlyWage) && hourlyWage < 10320) {
        setErrorMessage('최�??�금(10,320??보다 ?��? 금액???�력?????�습?�다.');
        setIsModalOpen(true);
        return;
      }
    }

    if (!validateForm()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('로그?�이 ?�요?�니??');
        setIsModalOpen(true);
        return;
      }

      // ?�유게시?�이 ?�닐 ?�만 비즈?�스 ?�증 체크
      if (formData.board_type !== '4') {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('is_accept, is_upload')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) throw userError;

        if (!userData) {
          setErrorMessage('?�용???�보�?찾을 ???�습?�다.');
          setIsModalOpen(true);
          return;
        }

        if (!isEditing && userData.is_upload) {
          setErrorMessage('공고???�루???�나�??�릴 ???�습?�다.');
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

      // ?�유게시?�이거나 비즈?�스 ?�증????경우 board ?�이지�??�동
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
      setErrorMessage('게시글 ?�록???�패?�습?�다. ?�시 ?�도?�주?�요.');
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
    ?�울: ["종로�?, "중구", "?�산�?, "?�동�?, "광진�?, "?��?문구", "중랑�?, "?�북�?, "강북�?, "?�봉�?, "?�원�?, "?�?�구", "?��?문구", "마포�?, "?�천�?, "강서�?, "구로�?, "금천�?, "?�등?�구", "?�작�?, "관?�구", "?�초�?, "강남�?, "?�파�?,"강동�?],
    부?? ["중구", "?�구", "?�구", "?�도�?, "부?�진�?, "?�래�?, "?�구", "북구", "?�운?��?, "?�하�?, "금정�?, "강서�?, "?�제�?, "?�영�?, "?�상�?, "기장�?],
    ?��? ["중구", "?�구", "?�구", "?�구", "북구", "?�성�?, "?�서�?, "?�성�?],
    ?�천: ["중구", "?�구", "?�구", "미추?��?, "?�수�?, "?�동�?, "부?�구", "계양�?, "?�구", "강화�?, "?�진�?],
    광주: ["?�구", "?�구", "?�구", "북구", "광산�?],
    ?�?? ["?�구", "중구", "?�구", "?�성�?, "?�?�구"],
    ?�산: ["중구", "?�구", "?�구", "북구", "?�주�?],
    ?�종: [""],
    경기: ["?�원??, "?�남??, "고양??, "?�인??, "부천시", "?�산??, "?�양??, "?�양주시", "?�성??, "?�택??, "?�정부??, "?�흥??, "?�주??, "광명??, "김?�시", "군포??, "광주??, "?�천??, "?�주??, "?�산??, "구리??, "?�성??, "?�천??, "?�왕??, "?�남??, "?�주??, "?�주�?, "?�평�?, "?�두천시", "과천??, "가?�군", "?�천�?],
    강원: ["춘천??, "?�주??, "강릉??, "?�해??, "?�백??, "?�초??, "?�척??, "?�천�?, "?�성�?, "?�월�?, "?�창�?, "?�선�?, "철원�?, "?�천�?, "?�구�?, "?�군", "고성�?, "?�양�?],
    충북: ["�?��??, "충주??, "?�천??, "�?���?, "보�?�?, "?�천�?, "?�군", "진천�?, "괴산�?, "?�성�?, "?�양�?, "증군"],
    충남: ["천안??, "공주??, "보령??, "?�산??, "?�산??, "?�산??, "계룡??, "?�진??, "?�진�?, "금산�?, "?�기�?, "부?�군", "?�천�?, "�?���?, "?�성�?, "?�산�?, "?�안�?],
    ?�북: ["?�주??, "군산??, "?�산??, "?�읍??, "?�원??, "김??, "?�주�?, "진안�?, "무주�?, "?�수�?, "?�실�?, "?�창�?, "고창�?, "부?�군"],
    ?�남: ["목포??, "?�수??, "?�천??, "?�주", "광양??, "?�양�?, "곡성�?, "구�?�?, "고흥�?, "보성�?, "?�순�?, "?�흥�?, "강진�?, "?�남�?, "?�암�?, "무안�?, "?�평�?, "?�광�?, "?�성�?, "?�도�?, "진도�?, "?�안�?],
    경북: ["?�항??, "경주??, "김천시", "?�동??, "구�???, "?�주??, "?�천??, "?�주??, "문경??, "경산??, "군위�?, "?�성�?, "�?���?, "?�양�?, "?�덕�?, "�?���?, "고령�?, "?�주�?, "칠곡�?, "?�천�?, "봉화�?, "?�진�?, "?�릉�?],
    경남: ["창원??, "마산??, "진주??, "진해??, "?�영??, "?�천??, "김?�시", "밀?�시", "거제??, "?�산??, "?�령�?, "?�안�?, "창녕�?, "고성�?, "?�해�?, "?�동�?, "?�청�?, "?�양�?, "거창�?, "?�천�?],
    ?�주: ["?�주??, "?��??�시", "북제주군", "?�제주군"]
  };

  const categories: { [key: string]: string[] } = {
    "교육·강사": ["?�습지교사", "?�원강사", "방과?�교??, "?�문강사"],
    "?�무�?: ["?�반?�무", "경리", "?�계", "?�사"],
    "?�매·?�업": ["매장관�?, "?�매", "?�업", "?�레마�???],
    "?�산·건설": ["?�산�?, "건설", "기술�?, "?�무�?],
    "?�비?�직·?�식": ["?�빙", "?�리", "미용", "?�박"],
    "IT·?�자??: ["?�개�?, "?�개�?, "그래?�디?�인", "UI/UX"],
    "?�전": ["?�시", "버스", "?�물", "배달"]
  };

  const getInputClassName = (fieldName: string, baseClass: string) => {
    return `${baseClass} ${errors[fieldName as keyof FormErrors] ? style.errorInput : ''}`;
  };

  return (
    <div className={style.layout}>
      <form onSubmit={handleSubmit}>
        {/* ?�목 �?게시???�택 */}
        <div className={style.subSection}>
          <div className={style.formRow}>
            <div className={style.formLabel}>게시??<span className={style.required}>*</span></div>
            <div className={style.formInput}>
              <select
                name="board_type"
                value={formData.board_type}
                onChange={handleInputChange}
                className={getInputClassName('board_type', `${style.select} ${style.boardSelect}`)}
              >
                <option value="0">구인?�보</option>
                <option value="1">구직?�보</option>
                <option value="2">중고?�장</option>
                <option value="3">부?�산?�보</option>
                <option value="4">?�유게시??/option>
              </select>
              <input
                name="title"
                type="text"
                className={getInputClassName('title', `${style.input} ${style.titleField}`)}
                placeholder="?�목???�력?�주?�요 (최�? 50??"
                value={formData.title}
                onChange={handleInputChange}
                maxLength={50}
              />
              {errors.title && <div className={style.errorText}>?�목???�력?�주?�요</div>}
            </div>
          </div>
        </div>

        {/* ?�유게시?�이 ?�닐 ?�만 추�? ?�드???�시 */}
        {formData.board_type !== '4' && (
          <>
            {/* 구인?�보????보이???�션??*/}
            {formData.board_type === '0' && (
              <>
                {/* 채용 조건 */}
                <h2 className={style.sectionTitle}>채용 조건</h2>
                <div className={style.subSection}>
                  <div className={style.formRow}>
                    <div className={style.formLabel}>조건</div>
                    <div className={style.conditionFormInput}>
                      <select name="experience" value={formData.experience} onChange={handleInputChange} className={style.select}>
                        <option value="무�?">경력 무�?</option>
                        <option value="1?�이??>1???�상</option>
                        <option value="3?�이??>3???�상</option>
                        <option value="5?�이??>5???�상</option>
                        <option value="10?�이??>10???�상</option>
                      </select>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} className={style.select}>
                        <option value="무�?">?�별 무�?</option>
                        <option value="?�자">?�자</option>
                        <option value="?�자">?�자</option>
                      </select>
                      <select name="education" value={formData.education} onChange={handleInputChange} className={style.select}>
                        <option value="무�?">?�력 무�?</option>
                        <option value="고졸?�상">고졸?�상</option>
                        <option value="초�?졸이??>초�?졸이??/option>
                        <option value="?�졸이??>?�졸이??/option>
                      </select>
                      <select name="age_limit" value={formData.age_limit} onChange={handleInputChange} className={style.select}>
                        <option value="무�?">?�이 무�?</option>
                        <option value="55?�이??>55???�하</option>
                        <option value="50?�이??>50???�하</option>
                        <option value="45?�이??>45???�하</option>
                        <option value="40?�이??>40???�하</option>
                        <option value="35?�이??>35???�하</option>
                      </select>
                    </div>
                  </div>
                  <div className={style.warningText}>
                    ?�️ ?�별 ?�한 ???��?고용?�등�??�반?�로 500�????�하??벌금??부과될 ???�습?�다.<br/>
                    ?�️ ?�령 ?�한 ???�령차별금�?�??�반?�로 500�????�하??벌금??부과될 ???�습?�다.
                  </div>
                </div>

                {/* 급여 ?�보?� 근무?�간 */}
                <h2 className={style.sectionTitle}>급여 �?근무?�간</h2>
                <div className={style.subSection}>
                  <div className={style.formGrid}>
                    <div className={style.formRow}>
                      <div className={style.formLabel}>급여</div>
                      <div className={style.formInput}>
                        <select name="salary_type" value={formData.salary_type} onChange={handleInputChange} className={style.select}>
                          <option value="?�급">?�급</option>
                          <option value="?�급">?�급</option>
                          <option value="주급">주급</option>
                          <option value="?�급">?�급</option>
                          <option value="?�의">?�의</option>
                        </select>
                        <input
                          type="text"
                          name="salary_detail"
                          value={formData.salary_detail}
                          onChange={handleInputChange}
                          className={style.input}
                          placeholder="급여 ?�세 ?�보"
                        />
                      </div>
                    </div>
                    <div className={style.formRow}>
                      <div className={style.formLabel}>근무?�간</div>
                      <div className={style.formInput}>
                        <input type="time" name="work_start_time" value={formData.work_start_time} onChange={handleInputChange} className={style.timeInput} />
                        <span>~</span>
                        <input type="time" name="work_end_time" value={formData.work_end_time} onChange={handleInputChange} className={style.timeInput} />
                      </div>
                    </div>
                  </div>
                  <div className={style.warningText}>
                    ?�️ 최�??�금(10,320????미달?�는 급여??법적 처벌 ?�?�이 ?????�습?�다.<br/>
                    ?�️ 최�??�금�??�반 ??3???�하??징역 ?�는 2천만 ???�하??벌금??부과될 ???�습?�다.
                  </div>
                </div>
              </>
            )}

            {/* 기본 ?�보 (게시???�?�에 ?�라 ?�목 변�? */}
            <h2 className={style.sectionTitle}>
              {formData.board_type === '0' ? '근무 ?�보' : '기본 ?�보'}
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
                    <option value="">1�?분류</option>
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
                    <option value="">2�?분류</option>
                    {formData['1depth_category'] && categories[formData['1depth_category']].map(subCategory => (
                      <option key={subCategory} value={subCategory}>{subCategory}</option>
                    ))}
                  </select>
                  {(errors['1depth_category'] || errors['2depth_category']) && 
                    <div className={style.errorText}>카테고리�??�택?�주?�요</div>}
                </div>
              </div>
              <div className={style.formRow}>
                <div className={style.formLabel}>
                  {formData.board_type === '0' ? '근무지' : '지??} <span className={style.required}>*</span>
                </div>
                <div className={style.formInput}>
                  <div className={style.locationSelects}>
                    <select 
                      name="1depth_region" 
                      value={formData['1depth_region']} 
                      onChange={handleInputChange} 
                      className={getInputClassName('1depth_region', style.select)}
                    >
                      <option value="">????/option>
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
                      <option value="">??�?�?/option>
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
                    placeholder="?�세 주소"
                  />
                  {(errors['1depth_region'] || errors['2depth_region'] || errors.work_location_detail) && 
                    <div className={style.errorText}>지???�보�?모두 ?�력?�주?�요</div>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ?�세 ?�용 */}
        <h2 className={style.sectionTitle}>?�세 ?�용</h2>
        <div className={style.subSection}>
          <textarea
            name="contents"
            className={getInputClassName('contents', style.textarea)}
            placeholder="?�세 ?�용???�력?�주?�요"
            value={formData.contents}
            onChange={handleInputChange}
          ></textarea>
          {errors.contents && <div className={style.errorText}>?�세 ?�용???�력?�주?�요</div>}
        </div>

        {/* 법적 경고 문구 */}
        {formData.board_type !== '4' && (
          <div className={style.legalWarning}>
            <p>?�️ ?�매�??�선 ???�위??처벌??관??법률 ??조에 ?�당?�는 ?�용???�함??구인 광고 관??법령???�라 ?�매매�? ?�선??경우, 3???�하??징역???�는 3천만 ???�하??벌금??처해�????�습?�다.</p>
            <p>?�️ ?�래�?종업??�?BAR 종업?�등 ?�흥?�소???�??공고??게시가 ?�한?�니??</p>
            <p>?�️ 1개의 공고???�러 ?�사??공고�??�로?�할 경우 게시가 ?�한?�니??</p>
          </div>
        )}

        {/* ?�출 버튼 */}
        <div className={`${style.formGroup} ${style.ft}`}>
          <button type="submit" className={style.submitButton}>
            {isEditing ? '?�정?�기' : '?�록?�기'}
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
        <LoginPopup onClose={handleLoginPopupClose} />
      )}
    </div>
  );
};

export default WritePage;
