import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import style from '@/styles/WriteComponent.module.css';
import { createClient } from '@supabase/supabase-js';
import Modal from '@/components/Modal';
import { addHours, format, subHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import BusinessVerificationModal from '@/components/BusinessVerificationModal';
import LoginPopup from '@/components/LoginPopup';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobForm {
  id?: number;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  contents: string;
  board_type: string; // Add this line
}

const WritePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query; // URL에서 id 파라미터 가져오기
  const [formData, setFormData] = useState<JobForm>({
    title: '',
    '1depth_region': '',
    '2depth_region': '',
    '1depth_category': '',
    '2depth_category': '',
    contents: '',
    board_type: '0' // Add this line with default value '0' for 구인정보
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showBusinessVerificationModal, setShowBusinessVerificationModal] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (id && currentUserId) {
      setIsEditing(true);
      console.log('Editing mode activated. ID:', id);
      fetchJobData(Number(id));
    }
  }, [id, currentUserId]);

  const checkLoginStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    } else {
      setShowLoginPopup(true);
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
        setErrorMessage('게시글을 찾을 수 없습니다.');
        setIsModalOpen(true);
        router.push('/board');
        return;
      }

      const jobData = data[0]; // Get the first row

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('로그인이 필요합니다.');
        setIsModalOpen(true);
        return;
      }

      // 제목 중복 체크
      const { data: existingPosts, error: titleCheckError } = await supabase
        .from('jd')
        .select('id')
        .eq('title', formData.title)
        .neq('id', id || 0);

      if (titleCheckError) throw titleCheckError;

      if (existingPosts && existingPosts.length > 0) {
        setErrorMessage('이미 존재하는 제목입니다. 다른 제목을 입력해주세요.');
        setIsModalOpen(true);
        return;
      }

      // Check if the user is accepted
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

      // 신규 등록시에만 is_upload 체크
      if (!isEditing && userData.is_upload) {
        setErrorMessage('공고는 하루에 하나만 올릴 수 있습니다.');
        setIsModalOpen(true);
        return;
      }

      if (isEditing) {
        // 수정 시에는 내용만 업데이트
        const { data: updatedData, error: updateError } = await supabase
          .from('jd')
          .update({
            title: formData.title.trim(),
            '1depth_region': formData['1depth_region'],
            '2depth_region': formData['2depth_region'],
            '1depth_category': formData['1depth_category'],
            '2depth_category': formData['2depth_category'],
            contents: formData.contents.trim()
            // updated_time은 제외
          })
          .eq('id', id)
          .select();

        if (updateError) throw updateError;

        if (!updatedData || updatedData.length === 0) {
          setErrorMessage('데이터 업데이트 실패');
          setIsModalOpen(true);
          return;
        }
      } else {
        // 신규 등록
        const now = new Date();
        const koreaTime = addHours(now, 9);

        const { data: insertedData, error: insertError } = await supabase
          .from('jd')
          .insert([{ 
            ...formData,
            title: formData.title.trim(),
            contents: formData.contents.trim(),
            uploader_id: user.id,
            ad: false,
            updated_time: koreaTime
          }])
          .select();

        if (insertError) throw insertError;

        if (!insertedData || insertedData.length === 0) {
          setErrorMessage('데이터 저장 실패');
          setIsModalOpen(true);
          return;
        }

        // 신규 등록시에만 is_upload를 true로 업데이트
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ is_upload: true })
          .eq('id', user.id);

        if (updateUserError) throw updateUserError;
      }

      // Check if the user is accepted after submitting the job
      if (!userData.is_accept) {
        setShowBusinessVerificationModal(true);
      } else {
        router.push('/board');
      }

    } catch (error) {
      console.error('Error processing data:', error);
      setErrorMessage('데이터 처리 중 오류가 발생했습니다.');
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
    강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "제군", "고성군", "양양군"],
    충북: ["청주시", "충주시", "제천시", "청원군", "보은군", "옥천군", "영동군", "진천군", "괴산군", "음성군", "단양군", "증군"],
    충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "당진군", "금산군", "연기군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
    전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
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

  const showLocationAndCategory = formData.board_type === '0' || formData.board_type === '1';

  return (
    <div className={style.layout}>
      <form onSubmit={handleSubmit}>
        {errorMessage && <p className={style.errorMessage}>{errorMessage}</p>}
        <dl className={`${style.formGroup} ${style.hd}`}>
          <dt>게시판:</dt>
          <dd>
            <ul className={style.chooseType}>
              <li>
                <input
                  className={style.radio}
                  id="type_0"
                  name="board_type"
                  type="radio"
                  value="0"
                  checked={formData.board_type === '0'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_0">구인정보</label>
              </li>
              <li>
                <input
                  className={style.radio}
                  id="type_1"
                  name="board_type"
                  type="radio"
                  value="1"
                  checked={formData.board_type === '1'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_1">구직정보</label>
              </li>
              <li>
                <input
                  className={style.radio}
                  id="type_2"
                  name="board_type"
                  type="radio"
                  value="2"
                  checked={formData.board_type === '2'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_2">중고시장</label>
              </li>
              <li>
                <input
                  className={style.radio}
                  id="type_3"
                  name="board_type"
                  type="radio"
                  value="3"
                  checked={formData.board_type === '3'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_3">부동산정보</label>
              </li>
            </ul>
          </dd>
        </dl>
        
        {showLocationAndCategory && (
          <>
            <dl className={style.formGroup}>
              <dt>지역:</dt>
              <dd>
                <div className={style.selectBox}>
                  <select
                    name="1depth_region"
                    value={formData['1depth_region']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">시/도</option>
                    {Object.keys(locations).map((city, index) => (
                      <option key={index} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div className={style.selectBox}>
                  <select
                    name="2depth_region"
                    value={formData['2depth_region']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">시/구/군</option>
                    {formData['1depth_region'] && locations[formData['1depth_region']].map((district, index) => (
                      <option key={index} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </dd>
            </dl>

            <dl className={style.formGroup}>
              <dt>분류:</dt>
              <dd>
                <div className={style.selectBox}>
                  <select
                    name="1depth_category"
                    value={formData['1depth_category']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">대분류</option>
                    {Object.keys(categories).map((category, index) => (
                      <option key={index} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className={style.selectBox}>
                  <select
                    name="2depth_category"
                    value={formData['2depth_category']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">소분류</option>
                    {formData['1depth_category'] && categories[formData['1depth_category']].map((subCategory, index) => (
                      <option key={index} value={subCategory}>{subCategory}</option>
                    ))}
                  </select>
                </div>
              </dd>
            </dl>
          </>
        )}

        <dl className={style.formGroup}>
          <dt>제목:</dt>
          <dd>
            <input
              name="title"
              type="text"
              className={`${style.input} ${style.title}`}
              placeholder="제목을 입력해주세요.(한자 및 특수문 사용금지)"
              value={formData.title}
              onChange={handleInputChange}
              maxLength={50}
            />
          </dd>
        </dl>

        <dl className={style.formGroup}>
          <dt>상세 내용:</dt>
          <dd>
            <textarea
              name="contents"
              className={style.textarea}
              placeholder="내용을 입력해주세요. 게시글 내에 근무지, 급여(최저임금 이상), 근무형태, 근무시간, 자격요건에 대한 내용이 부족하면 게시글 등록이 제한됩니다."
              value={formData.contents}
              onChange={handleInputChange}
            ></textarea>
          </dd>
        </dl>

        {/* 새로운 문구 추가 */}
        <p className={style.uploadNotice}>
          ** 모든 게시글은 하루에 1개 업로드 가능하며, 매일 00시 초기화됩니다.
        </p>

        <dl className={`${style.formGroup} ${style.ft}`}>
          <dd>
            <button type="submit" className={style.submitButton}>
              {isEditing ? '수정하기' : '등록하기'}
            </button>
          </dd>
        </dl>
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
          checkLoginStatus(); // 로그인 팝업이 닫힌 후 다시 로그인 상태 확인
        }} />
      )}
    </div>
  );
};

export default WritePage;
