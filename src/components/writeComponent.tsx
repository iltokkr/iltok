import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import style from '@/styles/WriteComponent.module.css';
import { createClient } from '@supabase/supabase-js';
import Modal from '@/components/Modal';
import { addHours, format, subHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import BusinessVerificationModal from '@/components/BusinessVerificationModal';
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
  community_tag: string;
  // 채용조건
  experience: string;
  gender: string;
  education: string;
  age_limit: string;
  // 급여
  salary_type: string;
  salary_detail: string;
  // 기숙사 (DB 컬럼명: is_day_pay)
  is_day_pay: boolean;
  // 근무정보
  '1depth_category': string;
  '2depth_category': string;
  '1depth_region': string;
  '2depth_region': string;
  work_location_detail: string;
  work_start_time: string;
  work_end_time: string;
  is_two_shift: boolean;
  work_start_time2: string;
  work_end_time2: string;
  // 상세내용
  contents: string;
  // 구직정보 전용 필드
  korean_name: string;
  english_name: string;
  seeker_gender: string;
  birth_year: string;
  birth_month: string;
  birth_day: string;
  nationality: string;
  visa_status: string;
  korean_ability: string;
  work_conditions: string[];
  desired_regions: string[];
  career_history: CareerItem[];
}

interface CareerItem {
  id: string;
  company_name: string;
  work_status: string;
  work_years: string;
  work_months: string;
  job_duties: string[];
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

// 국적 목록
const nationalities = [
  '대한민국', '중국', '베트남', '필리핀', '인도네시아', '태국', '미얀마', '캄보디아',
  '네팔', '스리랑카', '방글라데시', '파키스탄', '우즈베키스탄', '몽골',
  '러시아', '카자흐스탄', '키르기스스탄', '일본', '대만', '기타'
];

// 체류자격 목록
const visaStatuses = [
  '해당없음', '취업비자(E1-E7)', '방문취업(H-2)', '재외동포(F-4)', '영주(F-5)',
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

const WritePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState<JobForm>({
    title: '',
    board_type: '0',
    community_tag: '',
    experience: '무관',
    gender: '무관',
    education: '무관',
    age_limit: '무관',
    salary_type: '시급',
    salary_detail: '10,320',
    is_day_pay: false,
    '1depth_category': '',
    '2depth_category': '',
    '1depth_region': '',
    '2depth_region': '',
    work_location_detail: '',
    work_start_time: '08:00',
    work_end_time: '17:00',
    is_two_shift: false,
    work_start_time2: '17:00',
    work_end_time2: '02:00',
    contents: '',
    // 구직정보 전용 필드 초기값
    korean_name: '',
    english_name: '',
    seeker_gender: '',
    birth_year: '',
    birth_month: '',
    birth_day: '',
    nationality: '',
    visa_status: '',
    korean_ability: '',
    work_conditions: [],
    desired_regions: [],
    career_history: []
  });
  const [showCareerModal, setShowCareerModal] = useState(false);
  const [regionLimitError, setRegionLimitError] = useState(false);
  const [newCareer, setNewCareer] = useState<CareerItem>({
    id: '',
    company_name: '',
    work_status: '계약종료',
    work_years: '',
    work_months: '',
    job_duties: []
  });
  
  // 담당업무 옵션 목록
  const jobDutyOptions = [
    '제조/가공/조립', '기기부품제조', '식품생산직', '지게차 운전', '재단/재봉',
    '공사/건설현장', '조선소', '운반/설치/철거', '금형/사출/프레스/사상', '인테리어/보수공사', '기타'
  ];
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showBusinessVerificationModal, setShowBusinessVerificationModal] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    title: false,
    '1depth_category': false,
    '2depth_category': false,
    '1depth_region': false,
    '2depth_region': false,
    work_location_detail: false,
    contents: false
  });
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [contentsUrlError, setContentsUrlError] = useState(false);
  const [salaryWarningConfirmed, setSalaryWarningConfirmed] = useState(false);
  const [showSalaryWarningModal, setShowSalaryWarningModal] = useState(false);
  const [salaryWarningMessage, setSalaryWarningMessage] = useState('');
  const auth = useContext(AuthContext);

  // 제목 유효성 검사 함수
  const validateTitle = (value: string): boolean => {
    // 허용되는 문자: 한글, 중국어, 영문, 숫자, 공백, 특수문자(- + # ( ) [ ] % & . ㈜ ㈔ /)
    const allowedPattern = /^[가-힣ㄱ-ㅎㅏ-ㅣ\u4e00-\u9fffa-zA-Z0-9\s\-\+#\(\)\[\]%&\.㈜㈔\/\u0020]*$/;
    return allowedPattern.test(value);
  };

  // URL 포함 여부 검사 함수
  const containsUrl = (value: string): boolean => {
    // http://, https://, www., .com, .kr, .net, .org, .co.kr 등 URL 패턴 감지
    const urlPatterns = [
      /https?:\/\//i,                    // http:// 또는 https://
      /www\./i,                          // www.
      /\.[a-z]{2,}(\/|$|\s)/i,          // .com, .kr, .net 등 (최소 2자 도메인)
      /\.com/i,                          // .com
      /\.kr/i,                           // .kr
      /\.co\.kr/i,                       // .co.kr
      /\.net/i,                          // .net
      /\.org/i,                          // .org
      /\.io/i,                           // .io
    ];
    
    return urlPatterns.some(pattern => pattern.test(value));
  };

  useEffect(() => {
    if (auth?.user) {
      setCurrentUserId(auth.user.id);
    }
  }, [auth?.user]);

  // URL에서 board_type 파라미터를 읽어서 폼에 설정
  useEffect(() => {
    const boardTypeFromUrl = router.query.board_type as string;
    if (boardTypeFromUrl && !id) {  // 새 글 작성 시에만 적용
      setFormData(prev => ({ ...prev, board_type: boardTypeFromUrl }));
    }
  }, [router.query.board_type, id]);

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

      // 급여 데이터에 콤마 추가
      if (jobData.salary_detail) {
        jobData.salary_detail = jobData.salary_detail.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }

      // 구직정보 필드 파싱 (JSON 문자열 -> 배열)
      if (jobData.board_type === '1') {
        // work_conditions, desired_regions, career_history 파싱
        if (jobData.work_conditions) {
          try {
            jobData.work_conditions = typeof jobData.work_conditions === 'string' 
              ? JSON.parse(jobData.work_conditions) 
              : jobData.work_conditions;
          } catch {
            jobData.work_conditions = [];
          }
        } else {
          jobData.work_conditions = [];
        }

        if (jobData.desired_regions) {
          try {
            jobData.desired_regions = typeof jobData.desired_regions === 'string'
              ? JSON.parse(jobData.desired_regions)
              : jobData.desired_regions;
          } catch {
            jobData.desired_regions = [];
          }
        } else {
          jobData.desired_regions = [];
        }

        if (jobData.career_history) {
          try {
            jobData.career_history = typeof jobData.career_history === 'string'
              ? JSON.parse(jobData.career_history)
              : jobData.career_history;
          } catch {
            jobData.career_history = [];
          }
        } else {
          jobData.career_history = [];
        }

        // 생년월일 파싱 (YYYY-MM-DD -> 년, 월, 일 분리)
        if (jobData.birth_date) {
          const birthDate = new Date(jobData.birth_date);
          jobData.birth_year = birthDate.getFullYear().toString();
          jobData.birth_month = (birthDate.getMonth() + 1).toString();
          jobData.birth_day = birthDate.getDate().toString();
        } else {
          jobData.birth_year = '';
          jobData.birth_month = '';
          jobData.birth_day = '';
        }
      } else {
        // 구직정보가 아닌 경우 기본값 설정
        jobData.work_conditions = jobData.work_conditions || [];
        jobData.desired_regions = jobData.desired_regions || [];
        jobData.career_history = jobData.career_history || [];
        jobData.birth_year = '';
        jobData.birth_month = '';
        jobData.birth_day = '';
      }

      // 2교대 관련 필드 기본값 설정
      jobData.is_two_shift = jobData.is_two_shift || false;
      jobData.work_start_time2 = jobData.work_start_time2 || '17:00';
      jobData.work_end_time2 = jobData.work_end_time2 || '02:00';

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
      // 자유게시판: 제목과 내용만 필수
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
    } else if (formData.board_type === '1') {
      // 구직정보: 구직자 전용 필드 검증
      const newErrors = {
        title: formData.title.trim() === '',
        '1depth_category': formData['1depth_category'] === '',
        '2depth_category': false, // 2차 분류는 필수 아님
        '1depth_region': formData.desired_regions.length === 0,
        '2depth_region': false,
        work_location_detail: false,
        contents: formData.contents.trim() === ''
      };
      setErrors(newErrors);

      // 구직정보 전용 필수값 검증 (필수 항목만 검증)
      if (!formData.seeker_gender) {
        setErrorMessage('성별을 선택해주세요.');
        setIsModalOpen(true);
        return false;
      }
      if (!formData.nationality) {
        setErrorMessage('국적을 선택해주세요.');
        setIsModalOpen(true);
        return false;
      }
      if (!formData.visa_status) {
        setErrorMessage('체류자격을 선택해주세요.');
        setIsModalOpen(true);
        return false;
      }
      if (formData.desired_regions.length === 0) {
        setErrorMessage('희망 지역을 선택해주세요.');
        setIsModalOpen(true);
        return false;
      }
      if (!formData.korean_name.trim()) {
        setErrorMessage('한글 이름을 입력해주세요.');
        setIsModalOpen(true);
        return false;
      }
      if (!formData.birth_year || !formData.birth_month || !formData.birth_day) {
        setErrorMessage('생년월일을 입력해주세요.');
        setIsModalOpen(true);
        return false;
      }
      if (!formData.contents.trim()) {
        setErrorMessage('상세내용을 입력해주세요.');
        setIsModalOpen(true);
        return false;
      }

      return !newErrors.title && !newErrors['1depth_category'] && !newErrors.contents;
    } else {
      // 채용정보: 기존 검증
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

    // 제목 특수문자 유효성 검사
    if (!validateTitle(formData.title)) {
      setTitleInvalid(true);
      setErrorMessage('제목에는 한글, 영문, 중국어, 숫자, 일부 특수문자(- + # () [] % & . ㈜ ㈔ /)만 사용할 수 있습니다.');
      setIsModalOpen(true);
      return;
    }

    // 상세내용 URL 포함 여부 검사
    if (containsUrl(formData.contents)) {
      setContentsUrlError(true);
      setErrorMessage('상세내용에 URL(http, www, .com 등)을 포함할 수 없습니다.');
        setIsModalOpen(true);
        return;
      }

    // 시급 유효성 검사 추가 (콤마 제거 후 검사)
    const salaryNumber = formData.salary_detail.replace(/,/g, '');
    const salaryNum = parseInt(salaryNumber);
    
    if (formData.board_type === '0' && formData.salary_type === '시급') {
      if (!isNaN(salaryNum) && salaryNum < 10320) {
        setErrorMessage('최저임금(10,320원)보다 적은 금액을 입력할 수 없습니다.');
        setIsModalOpen(true);
        return;
      }
    }

    // 급여 범위 초과 검사 (확인되지 않은 경우에만)
    if (formData.board_type === '0' && !salaryWarningConfirmed && !isNaN(salaryNum)) {
      let warningMessage = '';
      
      // 시급: 10만원 초과
      if (formData.salary_type === '시급' && salaryNum > 100000) {
        warningMessage = '시급이 평균 범위를 초과합니다.\n\n의도하신 금액이 맞다면 다시 한 번 등록을 진행해 주세요.';
      }
      // 일급: 100만원 초과
      else if (formData.salary_type === '일급' && salaryNum > 1000000) {
        warningMessage = '일급이 평균 범위를 초과합니다.\n\n의도하신 금액이 맞다면 다시 한 번 등록을 진행해 주세요.';
      }
      // 월급: 1000만원 초과
      else if (formData.salary_type === '월급' && salaryNum > 10000000) {
        warningMessage = '월급이 평균 범위를 초과합니다.\n\n의도하신 금액이 맞다면 다시 한 번 등록을 진행해 주세요.';
      }
      // 주급: 1000만원 초과
      else if (formData.salary_type === '주급' && salaryNum > 10000000) {
        warningMessage = '주급이 평균 범위를 초과합니다.\n\n의도하신 금액이 맞다면 다시 한 번 등록을 진행해 주세요.';
      }
      
      if (warningMessage) {
        setSalaryWarningMessage(warningMessage);
        setShowSalaryWarningModal(true);
        setSalaryWarningConfirmed(true); // 다음 클릭 시 통과하도록
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
      // 채용정보만 하루 1건 제한 적용 (구직정보, 자유게시판은 제한 없음)
      if (formData.board_type === '0') {
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
          setErrorMessage('채용정보는 하루에 하나만 올릴 수 있습니다.');
        setIsModalOpen(true);
        return;
      }
      }

      // 생년월일 합치기
      const birthDateStr = formData.birth_year 
        ? `${formData.birth_year}-${formData.birth_month?.padStart(2, '0') || '01'}-${formData.birth_day?.padStart(2, '0') || '01'}`
        : null;

      const submissionData = {
            ...formData,
        salary_detail: formData.salary_detail.replace(/,/g, ''), // 콤마 제거하고 저장
            uploader_id: user.id,
            ad: false,
        // 구직정보인 경우 배열 데이터를 JSON 문자열로 변환
        work_conditions: formData.board_type === '1' ? JSON.stringify(formData.work_conditions) : null,
        desired_regions: formData.board_type === '1' ? JSON.stringify(formData.desired_regions) : null,
        career_history: formData.board_type === '1' ? JSON.stringify(formData.career_history) : null,
        birth_date: formData.board_type === '1' ? birthDateStr : null,
        // 구직정보의 경우 첫 번째 희망 지역을 1depth/2depth에 저장
        '1depth_region': formData.board_type === '1' && formData.desired_regions.length > 0 
          ? formData.desired_regions[0].split(' ')[0] 
          : formData['1depth_region'],
        '2depth_region': formData.board_type === '1' && formData.desired_regions.length > 0 
          ? formData.desired_regions[0].split(' ')[1] || ''
          : formData['2depth_region'],
      };
      
      // 임시 필드 제거 (DB에 저장하지 않음)
      delete (submissionData as any).birth_year;
      delete (submissionData as any).birth_month;
      delete (submissionData as any).birth_day;

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

      // 신규 등록이고 채용정보인 경우에만 is_upload를 true로 업데이트
      if (!isEditing && formData.board_type === '0') {
        await supabase
          .from('users')
          .update({ is_upload: true })
          .eq('id', user.id);
      }

      // 게시글 등록 후 이동 처리
      if (formData.board_type === '4') {
        // 자유게시판: 자유게시판으로 이동
        router.push('/board?board_type=4');
      } else if (formData.board_type === '1') {
        // 구직정보: 구직정보 게시판으로 이동
        router.push('/board?board_type=1');
      } else {
        // 채용정보: 사업자 등록 상태에 따라 분기
        const { data: userData } = await supabase
          .from('users')
          .select('is_accept, biz_file')
          .eq('id', user.id)
          .single();

        if (userData?.is_accept) {
          // 인증완료: 마이페이지로 이동
          router.push('/my');
        } else if (userData?.biz_file) {
          // 심사중: 마이페이지로 이동 + 심사중 팝업 표시
          router.push('/my?showPendingAlert=true');
        } else {
          // 미등록: 마이페이지로 이동 + 등록 요청 팝업 표시
          router.push('/my?showVerificationAlert=true');
        }
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      setErrorMessage('게시글 등록에 실패했습니다. 다시 시도해주세요.');
      setIsModalOpen(true);
    }
  };

  // 숫자에 콤마 추가하는 함수
  const formatNumberWithCommas = (value: string): string => {
    // 숫자만 추출
    const numbersOnly = value.replace(/[^\d]/g, '');
    // 콤마 추가
    return numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // 제목 입력 시 유효성 검사
    if (name === 'title') {
      setTitleInvalid(!validateTitle(value));
    }
    
    // 상세내용 입력 시 URL 에러 초기화
    if (name === 'contents') {
      setContentsUrlError(false);
    }
    

    // 급여 유형 변경 시 기본값 설정
    if (name === 'salary_type') {
      setSalaryWarningConfirmed(false); // 급여 유형 변경 시 경고 확인 초기화
      setFormData(prevState => ({
        ...prevState,
        [name]: value,
        salary_detail: value === '시급' ? '10,320' : ''
      }));
      return;
    }
    
    // 급여 입력 시 숫자만 허용하고 콤마 자동 추가
    if (name === 'salary_detail') {
      setSalaryWarningConfirmed(false); // 급여 금액 변경 시 경고 확인 초기화
      const formattedValue = formatNumberWithCommas(value);
      setFormData(prevState => ({
        ...prevState,
        [name]: formattedValue
      }));
      return;
    }
    
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

  // 나이 계산 함수
  const calculateAge = (): number | null => {
    const { birth_year, birth_month, birth_day } = formData;
    if (!birth_year) return null;
    
    const today = new Date();
    const birthYear = parseInt(birth_year);
    const birthMonth = birth_month ? parseInt(birth_month) - 1 : 0;
    const birthDay = birth_day ? parseInt(birth_day) : 1;
    
    let age = today.getFullYear() - birthYear;
    const monthDiff = today.getMonth() - birthMonth;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
      age--;
    }
    return age;
  };

  // 희망 근무조건 토글
  const handleWorkConditionToggle = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      work_conditions: prev.work_conditions.includes(condition)
        ? prev.work_conditions.filter(c => c !== condition)
        : [...prev.work_conditions, condition]
    }));
  };

  // 희망 지역 추가
  const handleAddDesiredRegion = () => {
    const region = `${formData['1depth_region']} ${formData['2depth_region']}`.trim();
    if (!region || region === ' ') return;
    if (formData.desired_regions.length >= 5) {
      setRegionLimitError(true);
      return;
    }
    setRegionLimitError(false);
    if (!formData.desired_regions.includes(region)) {
      setFormData(prev => ({
        ...prev,
        desired_regions: [...prev.desired_regions, region],
        '1depth_region': '',
        '2depth_region': ''
      }));
    }
  };

  // 희망 지역 삭제
  const handleRemoveDesiredRegion = (region: string) => {
    setFormData(prev => ({
      ...prev,
      desired_regions: prev.desired_regions.filter(r => r !== region)
    }));
  };

  // 경력 추가
  const handleAddCareer = () => {
    if (!newCareer.company_name) {
      setErrorMessage('업체명을 입력해주세요.');
      setIsModalOpen(true);
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
      work_years: '',
      work_months: '',
      job_duties: []
    });
    setShowCareerModal(false);
  };

  // 경력 삭제
  const handleRemoveCareer = (careerId: string) => {
    setFormData(prev => ({
      ...prev,
      career_history: prev.career_history.filter(c => c.id !== careerId)
    }));
  };

  // 경력 담당업무 토글
  const handleCareerDutyToggle = (duty: string) => {
    setNewCareer(prev => ({
      ...prev,
      job_duties: prev.job_duties.includes(duty)
        ? prev.job_duties.filter(d => d !== duty)
        : [...prev.job_duties, duty]
    }));
  };

  return (
    <div className={style.layout}>
      <form onSubmit={handleSubmit}>
        {/* 게시판 선택 */}
        <div className={style.subSection}>
          <div className={style.formRow}>
            <div className={style.formLabel}>게시판 <span className={style.required}>*</span></div>
            <div className={style.boardTypeContainer}>
              <button
                type="button"
                className={`${style.boardTypeTag} ${formData.board_type === '0' ? style.boardTypeTagSelected : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, board_type: '0' }))}
              >
                채용정보
              </button>
              <button
                type="button"
                className={`${style.boardTypeTag} ${formData.board_type === '1' ? style.boardTypeTagSelected : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, board_type: '1' }))}
              >
                구직정보
              </button>
              <button
                type="button"
                className={`${style.boardTypeTag} ${formData.board_type === '4' ? style.boardTypeTagSelected : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, board_type: '4' }))}
              >
                자유게시판
              </button>
            </div>
          </div>
        </div>

        {/* 제목 입력 */}
        <div className={style.subSection}>
          <div className={style.formRow}>
            <div className={style.formLabel}>제목 <span className={style.required}>*</span></div>
            <div className={style.titleFormInput}>
              <input
                name="title"
                type="text"
                className={`${getInputClassName('title', `${style.input} ${style.titleField}`)} ${titleInvalid ? style.errorInput : ''}`}
                placeholder="제목을 입력해주세요 (최대 40자)"
                value={formData.title}
                onChange={handleInputChange}
                maxLength={40}
              />
              <div className={style.titleCharCount}>{formData.title.length}/40 [최소2자]</div>
              {titleInvalid && <div className={style.errorText}>제목에는 한글, 영문, 중국어, 숫자, 일부 특수문자(- + # () [] % &amp; . ㈜ ㈔ /)만 사용할 수 있습니다.</div>}
              {errors.title && !titleInvalid && <div className={style.errorText}>제목을 입력해주세요</div>}
            </div>
          </div>
        </div>

        {/* 자유게시판이 아닐 때만 추가 필드들 표시 */}
        {formData.board_type !== '4' && (
          <>
            {/* 채용정보일 때 보이는 섹션들 */}
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
                    <div className={style.timeInputRow}>
                      <input type="time" name="work_start_time" value={formData.work_start_time} onChange={handleInputChange} className={style.timeInput} />
                      <span>~</span>
                      <input type="time" name="work_end_time" value={formData.work_end_time} onChange={handleInputChange} className={style.timeInput} />
                      <label className={style.twoShiftLabel}>
                        <input 
                          type="checkbox" 
                          checked={formData.is_two_shift} 
                          onChange={(e) => setFormData(prev => ({ ...prev, is_two_shift: e.target.checked }))}
                        />
                        2교대
                      </label>
                    </div>
                    {formData.is_two_shift && (
                      <div className={style.timeInputRow} style={{ marginTop: '8px' }}>
                        <input type="time" name="work_start_time2" value={formData.work_start_time2} onChange={handleInputChange} className={style.timeInput} />
                        <span>~</span>
                        <input type="time" name="work_end_time2" value={formData.work_end_time2} onChange={handleInputChange} className={style.timeInput} />
                        <span className={style.shiftLabel}>2교대</span>
                      </div>
                    )}
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

            {/* 채용정보용 기본 정보 */}
            {formData.board_type === '0' && (
              <>
                <h2 className={style.sectionTitle}>근무 정보</h2>
        <div className={style.subSection}>
          <div className={style.formRow}>
                    <div className={style.formLabel}>직무 <span className={style.required}>*</span></div>
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
                    <div className={style.formLabel}>근무지 <span className={style.required}>*</span></div>
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

            {/* 구직정보용 폼 필드들 */}
            {formData.board_type === '1' && (
              <>
                <h2 className={style.sectionTitle}>기본 정보</h2>
                <div className={style.subSection}>
                  {/* 한글이름, 영문이름 */}
                  <div className={style.formRow}>
                    <div className={style.formLabel}>한글 이름 <span className={style.required}>*</span></div>
                    <div className={style.formInput}>
                      <input
                        type="text"
                        name="korean_name"
                        value={formData.korean_name}
                        onChange={handleInputChange}
                        className={style.input}
                        placeholder="홍길동"
                      />
                    </div>
                  </div>
                  <div className={style.formRow}>
                    <div className={style.formLabel}>영문 이름</div>
                    <div className={style.formInput}>
                      <input
                        type="text"
                        name="english_name"
                        value={formData.english_name}
                        onChange={handleInputChange}
                        className={style.input}
                        placeholder="Hong Gil Dong"
                      />
                    </div>
                  </div>

                  {/* 성별 */}
                  <div className={style.formRow}>
                    <div className={style.formLabel}>성별 <span className={style.required}>*</span></div>
                    <div className={style.formInput}>
                      <div className={style.genderButtonGroup}>
                        <button
                          type="button"
                          className={`${style.genderButton} ${formData.seeker_gender === '남성' ? style.genderButtonSelected : ''}`}
                          onClick={() => setFormData(prev => ({ ...prev, seeker_gender: '남성' }))}
                        >
                          남성
                        </button>
                        <button
                          type="button"
                          className={`${style.genderButton} ${formData.seeker_gender === '여성' ? style.genderButtonSelected : ''}`}
                          onClick={() => setFormData(prev => ({ ...prev, seeker_gender: '여성' }))}
                        >
                          여성
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 생년월일 */}
                  <div className={style.formRow}>
                    <div className={style.formLabel}>생년월일 <span className={style.required}>*</span></div>
                    <div className={style.formInput}>
                      <div className={style.birthDateInputs}>
                        <input
                          type="number"
                          name="birth_year"
                          value={formData.birth_year}
                          onChange={handleInputChange}
                          className={style.birthInput}
                          placeholder="년"
                          maxLength={4}
                        />
                        <span className={style.birthLabel}>년</span>
                        <input
                          type="number"
                          name="birth_month"
                          value={formData.birth_month}
                          onChange={handleInputChange}
                          className={style.birthInputSmall}
                          placeholder="월"
                          min={1}
                          max={12}
                        />
                        <span className={style.birthLabel}>월</span>
                        <input
                          type="number"
                          name="birth_day"
                          value={formData.birth_day}
                          onChange={handleInputChange}
                          className={style.birthInputSmall}
                          placeholder="일"
                          min={1}
                          max={31}
                        />
                        <span className={style.birthLabel}>일</span>
                        {calculateAge() !== null && (
                          <span className={style.ageDisplay}>(만 {calculateAge()}세)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={style.divider} />

                {/* 희망업무 (카테고리) */}
                <div className={style.subSection}>
                  <div className={style.formRow}>
                    <div className={style.formLabel}>희망업무 <span className={style.required}>*</span></div>
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
                    </div>
                  </div>

                  {/* 국적 */}
                  <div className={style.formRow}>
                    <div className={style.formLabel}>국적 <span className={style.required}>*</span></div>
                    <div className={style.formInput}>
                      <select
                        name="nationality"
                        value={formData.nationality}
                        onChange={handleInputChange}
                        className={style.select}
                      >
                        <option value="">선택</option>
                        {nationalities.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 체류자격 */}
                  <div className={style.formRow}>
                    <div className={style.formLabel}>체류자격 <span className={style.required}>*</span></div>
                    <div className={style.formInput}>
                      <select
                        name="visa_status"
                        value={formData.visa_status}
                        onChange={handleInputChange}
                        className={style.select}
                      >
                        <option value="">선택</option>
                        {visaStatuses.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 한국어 능력 */}
                  <div className={style.formRow}>
                    <div className={style.formLabel}>한국어 능력</div>
                    <div className={style.formInput}>
                      <select
                        name="korean_ability"
                        value={formData.korean_ability}
                        onChange={handleInputChange}
                        className={style.select}
                      >
                        <option value="">선택</option>
                        {koreanAbilities.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 희망 근무조건 */}
                <div className={style.subSection}>
                  <div className={style.formRow}>
                    <div className={style.formLabelRow}>
                      <span className={style.formLabel}>희망 근무조건</span>
                      <span className={style.subLabelRight}>(중복선택이 가능해요)</span>
                    </div>
                    <div className={style.formInput}>
                      <div className={style.tagContainer}>
                        {workConditionOptions.map(condition => (
                          <button
                            key={condition}
                            type="button"
                            className={`${style.conditionTag} ${formData.work_conditions.includes(condition) ? style.conditionTagSelected : ''}`}
                            onClick={() => handleWorkConditionToggle(condition)}
                          >
                            {condition}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 희망 지역 */}
                <div className={style.subSection}>
                  <div className={style.formRow}>
                    <div className={style.formLabelRow}>
                      <span className={style.formLabel}>희망 지역 <span className={style.required}>*</span></span>
                      <span className={style.subLabelRight}>(5곳 까지 입력할 수 있어요)</span>
                    </div>
                    <div className={style.formInput}>
                      <div className={style.locationSelects}>
                        <select 
                          name="1depth_region" 
                          value={formData['1depth_region']} 
                          onChange={handleInputChange} 
                          className={style.select}
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
                          className={style.select}
                        >
                          <option value="">시/구/군</option>
                          {formData['1depth_region'] && locations[formData['1depth_region']].map(district => (
                            <option key={district} value={district}>{district}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={style.addRegionBtn}
                          onClick={handleAddDesiredRegion}
                        >
                          추가
                        </button>
                      </div>
                      {regionLimitError && (
                        <div className={style.regionLimitError}>희망 지역은 최대 5개까지 선택 가능합니다.</div>
                      )}
                      {formData.desired_regions.length > 0 && (
                        <div className={style.selectedRegions}>
                          {formData.desired_regions.map(region => (
                            <span key={region} className={style.regionTag}>
                              {region}
                              <button 
                                type="button" 
                                className={style.removeTag}
                                onClick={() => handleRemoveDesiredRegion(region)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={style.divider} />

                {/* 경력 */}
                <div className={style.subSection}>
                  <div className={style.formRow}>
                    <div className={style.formLabel}>경력사항</div>
                    <div className={style.formInput}>
                      {formData.career_history.map(career => (
                        <div key={career.id} className={style.careerCard}>
                          <div className={style.careerHeader}>
                            <strong>{career.company_name}</strong>
                            <button 
                              type="button" 
                              className={style.careerDeleteBtn}
                              onClick={() => handleRemoveCareer(career.id)}
                            >
                              삭제
                            </button>
                          </div>
                          <div className={style.careerInfo}>
                            {career.job_duties.join(', ')}
                          </div>
                          <div className={style.careerDate}>
                            {career.work_years && `${career.work_years}년`}
                            {career.work_years && career.work_months && ' '}
                            {career.work_months && `${career.work_months}개월`}
                            {!career.work_years && !career.work_months && '-'}
                            <span className={`${style.careerStatus} ${career.work_status === '재직중' ? style.working : ''}`}>
                              {career.work_status}
                            </span>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={style.addCareerBtn}
                        onClick={() => setShowCareerModal(true)}
                      >
                        경력 추가하기
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* 상세 내용 */}
        <h2 className={style.sectionTitle}>
          상세 내용
          {formData.board_type === '1' && <span className={style.required}> *</span>}
        </h2>
        <div className={style.subSection}>
          <textarea
            name="contents"
            className={`${getInputClassName('contents', style.textarea)} ${contentsUrlError ? style.errorInput : ''}`}
            placeholder={formData.board_type === '1' ? "추가로 전할 내용이 있다면 작성해주세요.." : "상세 내용을 입력해주세요"}
            value={formData.contents}
            onChange={handleInputChange}
          ></textarea>
          {errors.contents && <div className={style.errorText}>상세 내용을 입력해주세요</div>}
          {contentsUrlError && <div className={style.errorText}>상세내용에 URL(http, www, .com 등)을 포함할 수 없습니다.</div>}
        </div>

        {/* 법적 경고 문구 - 채용정보(board_type='0')에만 표시 */}
        {formData.board_type === '0' && (
        <div className={style.legalWarning}>
            <p>⚠️ 성매매 알선 등 행위의 처벌에 관한 법률 제4조에 해당되는 내용이 포함된 채용 광고 관련 법령에 따라 성매매를 알선한 경우, 3년 이하의 징역형 또는 3천만 원 이하의 벌금에 처해질 수 있습니다.</p>
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
      
      {/* 급여 범위 초과 경고 모달 */}
      {showSalaryWarningModal && (
        <div className={style.salaryWarningOverlay}>
          <div className={style.salaryWarningModal}>
            <button 
              className={style.salaryWarningClose}
              onClick={() => setShowSalaryWarningModal(false)}
            >
              ×
            </button>
            <h2 className={style.salaryWarningTitle}>⚠️ 급여 범위 확인</h2>
            <div className={style.salaryWarningContent}>
              <p className={style.salaryWarningText}>
                {salaryWarningMessage.split('\n').map((line, i) => (
                  <span key={i}>{line}<br/></span>
                ))}
              </p>
            </div>
            <button 
              className={style.salaryWarningButton}
              onClick={() => setShowSalaryWarningModal(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 경력 추가 모달 */}
      {showCareerModal && (
        <div className={style.careerModalOverlay} onClick={() => setShowCareerModal(false)}>
          <div className={style.careerModal} onClick={e => e.stopPropagation()}>
            <div className={style.careerModalHeader}>
              <h3>경력 추가하기</h3>
              <button className={style.careerModalClose} onClick={() => setShowCareerModal(false)}>×</button>
            </div>
            
            <div className={style.careerModalBody}>
              <div className={style.careerFormGroup}>
                <label>업체명</label>
                <input
                  type="text"
                  value={newCareer.company_name}
                  onChange={e => setNewCareer({...newCareer, company_name: e.target.value})}
                  placeholder="업체명을 입력해 주세요"
                  className={style.input}
                />
              </div>
              
              <div className={style.careerFormGroup}>
                <label>근무상태</label>
                <div className={style.workStatusGroup}>
                  <label className={`${style.workStatusLabel} ${newCareer.work_status === '재직중' ? style.workStatusSelected : ''}`}>
                    <input
                      type="radio"
                      checked={newCareer.work_status === '재직중'}
                      onChange={() => setNewCareer({...newCareer, work_status: '재직중'})}
                    />
                    <span>재직중</span>
                  </label>
                  <label className={`${style.workStatusLabel} ${newCareer.work_status === '계약종료' ? style.workStatusSelected : ''}`}>
                    <input
                      type="radio"
                      checked={newCareer.work_status === '계약종료'}
                      onChange={() => setNewCareer({...newCareer, work_status: '계약종료'})}
                    />
                    <span>계약종료</span>
                  </label>
                </div>
              </div>

              <div className={style.careerFormGroup}>
                <label>근무기간</label>
                <div className={style.workDurationInputs}>
                  <input
                    type="number"
                    value={newCareer.work_years}
                    onChange={e => setNewCareer({...newCareer, work_years: e.target.value})}
                    className={style.durationInput}
                    placeholder=""
                    min={0}
                  />
                  <span className={style.durationLabel}>년</span>
                  <input
                    type="number"
                    value={newCareer.work_months}
                    onChange={e => setNewCareer({...newCareer, work_months: e.target.value})}
                    className={style.durationInput}
                    placeholder=""
                    min={0}
                    max={11}
                  />
                  <span className={style.durationLabel}>개월</span>
                </div>
              </div>

              <div className={style.careerFormGroup}>
                <label>담당업무</label>
                <div className={style.tagContainer}>
                  {jobDutyOptions.map(duty => (
                    <button
                      key={duty}
                      type="button"
                      className={`${style.conditionTag} ${newCareer.job_duties.includes(duty) ? style.conditionTagSelected : ''}`}
                      onClick={() => handleCareerDutyToggle(duty)}
                    >
                      {duty}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className={style.careerModalSubmit} onClick={handleAddCareer}>
              추가하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WritePage;
