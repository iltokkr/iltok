import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import style from '@/styles/JobDetail.module.css';
import { parseISO, format, subHours } from 'date-fns';
import { useLanguage } from '@/hooks/useLanguage';
import { GA_TRACKING_ID } from '@/lib/gtag';
import MainCarousel from '@/components/MainCarousel';
import { AuthContext } from '@/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js'
import { toast } from 'react-hot-toast';
import LoginPopup from '@/components/LoginPopup';
import Comment from './Comment';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CommentType {
  id: number;
  created_at: string;
  text: string;
  user_id: string;
  jd_id: number;
  user?: {
    name: string;
  };
}

interface JobDetailProps {
  jobDetail: {
    id: number;
    updated_time: string;
    title: string;
    contents: string;
    ad: boolean;
    board_type: string;
    experience: string;
    gender: string;
    education: string;
    age_limit: string;
    required_visa?: string | null;
    salary_type: string;
    salary_detail: string;
    '1depth_category': string;
    '2depth_category': string;
    '1depth_region': string;
    '2depth_region': string;
    work_location_detail: string;
    work_start_time: string;
    work_end_time: string;
    is_two_shift?: boolean;
    work_start_time2?: string;
    work_end_time2?: string;
    is_ads?: boolean;
    content_image?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    // 구직정보 전용 필드
    korean_name?: string;
    english_name?: string;
    seeker_gender?: string;
    birth_date?: string;
    nationality?: string;
    visa_status?: string;
    korean_ability?: string;
    work_conditions?: string;
    desired_regions?: string;
    career_history?: string;
    uploader: {
      company_name: string;
      name: string;
      number: string;
    };
  };
  initialComments: CommentType[];
}

const JobDetail: React.FC<JobDetailProps> = ({ jobDetail, initialComments }) => {
  const router = useRouter();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [translatedTitle, setTranslatedTitle] = useState(jobDetail.title);
  const [translatedContents, setTranslatedContents] = useState(jobDetail.contents);
  const [isTranslating, setIsTranslating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const auth = useContext(AuthContext);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showMinWagePopup, setShowMinWagePopup] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showApplySuccessPopup, setShowApplySuccessPopup] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (!auth) throw new Error("AuthContext not found");
  const { user, isLoggedIn } = auth;

  // 최저임금 미달 팝업 체크
  useEffect(() => {
    if (jobDetail.salary_type === '시급') {
      const wage = parseInt(jobDetail.salary_detail);
      if (!isNaN(wage) && wage < 10320) {
        // localStorage에서 "다시 보지 않기" 체크 여부 확인
        const hiddenPosts = JSON.parse(localStorage.getItem('hiddenMinWagePopup') || '[]');
        if (!hiddenPosts.includes(jobDetail.id)) {
          setShowMinWagePopup(true);
        }
      }
    }
  }, [jobDetail]);

  const handleCloseMinWagePopup = () => {
    if (dontShowAgain) {
      // localStorage에 저장
      const hiddenPosts = JSON.parse(localStorage.getItem('hiddenMinWagePopup') || '[]');
      if (!hiddenPosts.includes(jobDetail.id)) {
        hiddenPosts.push(jobDetail.id);
        localStorage.setItem('hiddenMinWagePopup', JSON.stringify(hiddenPosts));
      }
    }
    setShowMinWagePopup(false);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsFloating(window.innerHeight < document.body.scrollHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleListClick = () => {
    router.push('/board');
  };

  const handleCopyPhoneNumber = (number: string) => {
    navigator.clipboard.writeText(number)
      .then(() => {
        alert('전화번호가 복사되었습니다!');
      })
      .catch(err => console.error('Failed to copy: ', err));
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd HH:mm');
  };

  const formatPhoneNumber = (number: string) => {
    if (number.length === 12 && number.startsWith('82')) {
      const formattedNumber = `0${number.slice(2)}`;
      return `${formattedNumber.slice(0, 3)}-${formattedNumber.slice(3, 7)}-${formattedNumber.slice(7)}`;
    }
    return number;
  };

  const getSmsHref = (number: string) => {
    const raw = number.replace(/\D/g, '');
    if (raw.startsWith('82') && raw.length >= 11) {
      return `sms:0${raw.slice(2)}`;
    }
    if (raw.startsWith('0')) {
      return `sms:${raw}`;
    }
    return `sms:${raw || number}`;
  };

  // 만 나이 계산 함수
  const calculateAge = (birthDateStr: string): number | null => {
    if (!birthDateStr) return null;
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // JSON 파싱 헬퍼 함수
  const parseJsonField = (field: string | undefined): any[] => {
    if (!field) return [];
    try {
      return JSON.parse(field);
    } catch {
      return [];
    }
  };

  // 번역 함수 수정
  const translate = async (text: string, targetLang: string) => {
    if (targetLang === 'ko') return text;
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await response.json();
      
      // 번역된 문장들을 공백 없이 합치기 (data[0]이 없을 수 있음)
      const segments = Array.isArray(data?.[0]) ? data[0] : [];
      return segments
        .map((item: any[]) => item?.[0])
        .filter(Boolean)
        .join('') || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  // 언어 변경 핸들러 정
  const handleLanguageChange = (lang: string) => {
    if (lang === currentLanguage || isTranslating) return;
    
    window.gtag('event', 'translate', {
      event_category: 'Translation',
      event_label: `${currentLanguage}_to_${lang}`,
      job_id: jobDetail.id
    });
    
    changeLanguage(lang);
  };

  // 언어 변경 시 번역 실행
  useEffect(() => {
    const translateContent = async () => {
      if (currentLanguage === 'ko' || isTranslating) {
        setTranslatedTitle(jobDetail.title);
        setTranslatedContents(jobDetail.contents);
        return;
      }

      setIsTranslating(true);
      try {
        // 제목 번역
        const newTitle = await translate(jobDetail.title, currentLanguage);
        
        // 내용 번역 - 전체 내용을 한 번에 번역
        const newContents = await translate(jobDetail.contents, currentLanguage);
        
        setTranslatedTitle(newTitle);
        setTranslatedContents(newContents);
      } catch (error) {
        console.error('Translation error:', error);
        // 에러 발생 시 원본 텍스트 유지
        setTranslatedTitle(jobDetail.title);
        setTranslatedContents(jobDetail.contents);
      } finally {
        setIsTranslating(false);
      }
      
    };

    translateContent();
  }, [currentLanguage, jobDetail]);

  // 지원 상태 확인 (job_application)
  useEffect(() => {
    const checkApplyStatus = async () => {
      if (!isLoggedIn || !user) return;
      
      const { data, error } = await supabase
        .from('job_application')
        .select('id')
        .eq('users_id', user.id)
        .eq('jd_id', jobDetail.id)
        .single();
        
      if (data && !error) {
        setIsBookmarked(true);
      }
    };

    checkApplyStatus();
  }, [isLoggedIn, user, jobDetail.id]);

  const handleApply = async () => {
    if (!isLoggedIn || !user) {
      setShowLoginPopup(true);
      return;
    }
    if (isApplying) return;
    setIsApplying(true);

    try {
      if (isBookmarked) {
        const { error: deleteError } = await supabase
          .from('job_application')
          .delete()
          .eq('users_id', user.id)
          .eq('jd_id', jobDetail.id);

        if (deleteError) throw deleteError;
        setIsBookmarked(false);
        toast(currentLanguage === 'ko' ? '지원이 취소되었습니다.' : 'Application cancelled', {
          icon: '✓',
          style: { background: '#64748b', color: '#fff' },
        });
      } else {
        const { error: insertError } = await supabase
          .from('job_application')
          .insert([{ users_id: user.id, jd_id: jobDetail.id }]);

        if (insertError) throw insertError;
        setIsBookmarked(true);
        toast.success(currentLanguage === 'ko' ? '지원이 완료되었습니다.' : 'Application submitted');
        setShowApplySuccessPopup(true);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; details?: string };
      console.error('Error applying:', err?.message || err?.code || error);
      toast.error(currentLanguage === 'ko' ? '지원 처리 중 오류가 발생했습니다.' : 'An error occurred.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className={style.layout}>

      {copySuccess && <div className={style.copyAlert}>전화번호가 복사되었습니다!</div>}
      
      <div className={style.articleHeader}>
        <div className={style.articleTitle}>
          <h1>{translatedTitle}</h1>
        </div>

        <div className={style.articleMetaRow}>
          <ul className={style.articleMeta}>
            <li>등록일: {formatDate(jobDetail.updated_time)}</li>
            <li>글번호: {jobDetail.id}</li>
          </ul>
          <div className={style.languageSelector}>
            <button 
              className={currentLanguage === 'ko' ? style.activeLanguage : ''} 
              onClick={() => changeLanguage('ko')}
            >
              한국어
            </button>
            <button 
              className={currentLanguage === 'en' ? style.activeLanguage : ''} 
              onClick={() => changeLanguage('en')}
            >
              EN
            </button>
            <button 
              className={currentLanguage === 'zh' ? style.activeLanguage : ''} 
              onClick={() => changeLanguage('zh')}
            >
              中文
            </button>
            <button 
              className={currentLanguage === 'ja' ? style.activeLanguage : ''} 
              onClick={() => changeLanguage('ja')}
            >
              日本
            </button>
          </div>
        </div>
      </div>
      <div className={style.articleDetail}>
        {jobDetail.board_type === '0' && (
          <div className={style.seekerInfoSection}>
            {/* 급여·근무 - 최상단 강조 (is_ads 광고 글에서는 숨김) */}
            {!jobDetail.is_ads && (jobDetail.salary_type || (jobDetail.work_start_time && jobDetail.work_end_time)) && (
              <div className={style.salaryWorkHighlight}>
                <div className={style.salaryWorkGrid}>
                  {jobDetail.salary_type && jobDetail.salary_detail && (
                    <div className={style.salaryWorkItem}>
                      <span className={style.salaryWorkLabel}>{jobDetail.salary_type}</span>
                      <span className={style.salaryWorkValue}>{Number(jobDetail.salary_detail).toLocaleString()}원</span>
                    </div>
                  )}
                  {jobDetail.work_start_time && jobDetail.work_end_time && (
                    <div className={style.salaryWorkItem}>
                      <span className={style.salaryWorkLabel}>근무시간</span>
                      <span className={style.salaryWorkValue}>
                        {jobDetail.work_start_time} ~ {jobDetail.work_end_time}
                        {jobDetail.is_two_shift && jobDetail.work_start_time2 && jobDetail.work_end_time2 && (
                          <span className={style.salaryWorkSub}> / {jobDetail.work_start_time2}~{jobDetail.work_end_time2} (2교대)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <p className={style.minWageNote}>2026년 최저임금 10,320원</p>
              </div>
            )}

            {/* 채용 조건 */}
            {!jobDetail.is_ads && (jobDetail.experience || jobDetail.gender || jobDetail.education || jobDetail.age_limit || jobDetail.required_visa) && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>채용 조건</h3>
                <div className={style.seekerBasicInfoList}>
                  {jobDetail.experience && (
                    <div className={style.seekerBasicInfoItem}>
                      <span className={style.seekerBasicLabel}>경력</span>
                      <span className={style.seekerBasicValue}>{jobDetail.experience}</span>
                    </div>
                  )}
                  {jobDetail.gender && (
                    <div className={style.seekerBasicInfoItem}>
                      <span className={style.seekerBasicLabel}>성별</span>
                      <span className={style.seekerBasicValue}>{jobDetail.gender}</span>
                    </div>
                  )}
                  {jobDetail.education && (
                    <div className={style.seekerBasicInfoItem}>
                      <span className={style.seekerBasicLabel}>학력</span>
                      <span className={style.seekerBasicValue}>{jobDetail.education}</span>
                    </div>
                  )}
                  {jobDetail.age_limit && (
                    <div className={style.seekerBasicInfoItem}>
                      <span className={style.seekerBasicLabel}>연령</span>
                      <span className={style.seekerBasicValue}>{jobDetail.age_limit}</span>
                    </div>
                  )}
                  {jobDetail.required_visa && (() => {
                    try {
                      const visas = typeof jobDetail.required_visa === 'string'
                        ? JSON.parse(jobDetail.required_visa)
                        : jobDetail.required_visa;
                      const visaArr = Array.isArray(visas) ? visas : [];
                      if (visaArr.length > 0) {
                        return (
                          <div className={style.seekerBasicInfoItem}>
                            <span className={style.seekerBasicLabel}>비자</span>
                            <span className={style.seekerBasicValue}>{visaArr.join(', ')}</span>
                          </div>
                        );
                      }
                    } catch {
                      return null;
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* 근무지 */}
            {!jobDetail.is_ads && (jobDetail['1depth_region'] || jobDetail.work_location_detail) && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>근무지</h3>
                <div className={style.seekerBasicInfoList}>
                  {jobDetail['1depth_region'] && (
                    <div className={style.seekerBasicInfoItem}>
                      <span className={style.seekerBasicLabel}>지역</span>
                      <span className={style.seekerBasicValue}>
                        {jobDetail['1depth_region']}
                        {jobDetail['2depth_region'] && ` ${jobDetail['2depth_region']}`}
                      </span>
                    </div>
                  )}
                  {jobDetail.work_location_detail && (
                    <div className={style.seekerBasicInfoItem}>
                      <span className={style.seekerBasicLabel}>상세주소</span>
                      <span className={style.seekerBasicValue}>{jobDetail.work_location_detail}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상세 내용 위 이미지 (is_ads일 때만 표시 가능) */}
            {jobDetail.content_image && (
              <div className={style.contentImageWrap}>
                <img src={jobDetail.content_image} alt="" className={style.contentImage} />
              </div>
            )}
            {/* 상세 내용 */}
            {jobDetail.id !== 6599 && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>상세 내용</h3>
                <div className={style.seekerContents}>
                  {translatedContents.split('\n').map((line: string, index: number) => (
                    <React.Fragment key={index}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* 채용담당자 - 담당자명, 담당자 연락처, 문자보내기, 지원하기, 안내문 */}
            {(jobDetail.contact_phone || jobDetail.uploader.number) && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>채용담당자</h3>
                <div className={style.companyInfo}>
                  <div className={style.infoRow}>
                    <span className={style.infoLabel}>담당자명</span>
                    <span className={style.infoValue}>{jobDetail.contact_name || ''}</span>
                  </div>
                  <div className={style.infoRow}>
                    <span className={style.infoLabel}>연락처</span>
                    <span
                      className={style.phoneNumber}
                      onClick={() => handleCopyPhoneNumber(formatPhoneNumber(jobDetail.contact_phone || jobDetail.uploader.number || ''))}
                    >
                      {formatPhoneNumber(jobDetail.contact_phone || jobDetail.uploader.number || '')}
                    </span>
                  </div>
                </div>
                <div
                  className={style.buttonGroup}
                  onClick={(e) => {
                    const el = (e.target as HTMLElement).closest('[data-apply-btn]');
                    if (el) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleApply();
                    }
                  }}
                >
                  <a
                    href={getSmsHref(jobDetail.contact_phone || jobDetail.uploader.number || '')}
                    className={style.smsButton}
                  >
                    문자보내기
                  </a>
                  <div
                    role="button"
                    tabIndex={0}
                    data-apply-btn
                    className={isBookmarked ? `${style.applyButton} ${style.applyButtonSupported}` : style.applyButton}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleApply(); } }}
                    style={{ cursor: isApplying ? 'wait' : 'pointer' }}
                  >
                    {isApplying ? '처리 중...' : (isBookmarked ? '지원 취소' : '지원하기')}
                  </div>
                </div>
                <div className={style.notice}>
                  ※ 공고에 대한 오류 및 이로인한 책임은 114114KR에서 책임지지 않습니다.
                </div>
                <div className={style.notice}>
                  ※ 114114KR 통해서 연락한다고 말씀해주세요.
                </div>
              </div>
            )}

            {/* 기업정보 - 업체명, 대표자명, 연락처 (문자보내기/지원하기 없음) */}
            <div className={style.seekerInfoCard}>
              <h3 className={style.seekerInfoTitle}>기업정보</h3>
              <div className={style.companyInfo}>
                <div className={style.infoRow}>
                  <span className={style.infoLabel}>업체명</span>
                  <span className={style.infoValue}>{jobDetail.uploader.company_name || "정보없음"}</span>
                </div>
                <div className={style.infoRow}>
                  <span className={style.infoLabel}>대표자명</span>
                  <span className={style.infoValue}>{jobDetail.uploader.name || "정보없음"}</span>
                </div>
                <div className={style.infoRow}>
                  <span className={style.infoLabel}>전화번호</span>
                  <span
                    className={style.phoneNumber}
                    onClick={() => handleCopyPhoneNumber(formatPhoneNumber(jobDetail.uploader.number || ''))}
                  >
                    {formatPhoneNumber(jobDetail.uploader.number || '')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 구직정보 표시 (board_type === '1') */}
        {jobDetail.board_type === '1' && (
          <div className={style.seekerInfoSection}>
            {/* 기본 정보 */}
            <div className={style.seekerInfoCard}>
              <h3 className={style.seekerInfoTitle}>기본 정보</h3>
              <div className={style.seekerBasicInfoList}>
                {(jobDetail.korean_name || jobDetail.english_name) && (
                  <div className={style.seekerBasicInfoItem}>
                    <span className={style.seekerBasicLabel}>이름</span>
                    <span className={style.seekerBasicValue}>
                      {jobDetail.korean_name}
                      {jobDetail.english_name && ` (${jobDetail.english_name})`}
                    </span>
                  </div>
                )}
                {jobDetail.seeker_gender && (
                  <div className={style.seekerBasicInfoItem}>
                    <span className={style.seekerBasicLabel}>성별</span>
                    <span className={style.seekerBasicValue}>{jobDetail.seeker_gender}</span>
                  </div>
                )}
                {jobDetail.birth_date && (
                  <div className={style.seekerBasicInfoItem}>
                    <span className={style.seekerBasicLabel}>나이</span>
                    <span className={style.seekerBasicValue}>만 {calculateAge(jobDetail.birth_date)}세</span>
                  </div>
                )}
                {jobDetail.nationality && (
                  <div className={style.seekerBasicInfoItem}>
                    <span className={style.seekerBasicLabel}>국적</span>
                    <span className={style.seekerBasicValue}>{jobDetail.nationality}</span>
                  </div>
                )}
                {jobDetail.visa_status && (
                  <div className={style.seekerBasicInfoItem}>
                    <span className={style.seekerBasicLabel}>체류자격</span>
                    <span className={style.seekerBasicValue}>{jobDetail.visa_status}</span>
                  </div>
                )}
                {jobDetail.korean_ability && (
                  <div className={style.seekerBasicInfoItem}>
                    <span className={style.seekerBasicLabel}>한국어</span>
                    <span className={style.seekerBasicValue}>{jobDetail.korean_ability}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 희망 업무 */}
            {jobDetail['1depth_category'] && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>희망 업무</h3>
                <div className={style.seekerTagsContainer}>
                  <span className={style.seekerTag}>{jobDetail['1depth_category']}</span>
                  {jobDetail['2depth_category'] && (
                    <span className={style.seekerTag}>{jobDetail['2depth_category']}</span>
                  )}
                </div>
              </div>
            )}

            {/* 희망 근무조건 */}
            {jobDetail.work_conditions && parseJsonField(jobDetail.work_conditions).length > 0 && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>희망 근무조건</h3>
                <div className={style.seekerTagsContainer}>
                  {parseJsonField(jobDetail.work_conditions).map((condition: string, index: number) => (
                    <span key={index} className={style.seekerTag}>{condition}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 희망 지역 */}
            {jobDetail.desired_regions && parseJsonField(jobDetail.desired_regions).length > 0 && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>희망 지역</h3>
                <div className={style.seekerTagsContainer}>
                  {parseJsonField(jobDetail.desired_regions).map((region: string, index: number) => (
                    <span key={index} className={style.seekerTag}>{region}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 경력 사항 */}
            {jobDetail.career_history && parseJsonField(jobDetail.career_history).length > 0 && (
              <div className={style.seekerInfoCard}>
                <h3 className={style.seekerInfoTitle}>경력 사항</h3>
                <div className={style.careerList}>
                  {parseJsonField(jobDetail.career_history).map((career: any, index: number) => (
                    <div key={index} className={style.careerItem}>
                      <div className={style.careerCompany}>
                        <span className={style.careerCompanyName}>{career.company_name}</span>
                        <span className={style.careerStatus}>{career.work_status}</span>
                      </div>
                      <div className={style.careerPeriod}>
                        {career.work_years && `${career.work_years}년`}
                        {career.work_years && career.work_months && ' '}
                        {career.work_months && `${career.work_months}개월`}
                      </div>
                      {career.job_duties && career.job_duties.length > 0 && (
                        <div className={style.careerDuties}>
                          {career.job_duties.map((duty: string, dutyIndex: number) => (
                            <span key={dutyIndex} className={style.careerDutyTag}>{duty}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 상세 내용 */}
            <div className={style.seekerInfoCard}>
              <h3 className={style.seekerInfoTitle}>상세 내용</h3>
              <div className={style.seekerContents}>
                {translatedContents.split('\n').map((line: string, index: number) => (
                  <React.Fragment key={index}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* 업체명·대표자명·전화번호·문자보내기·지원하기 - 상세내용 밑 */}
            {jobDetail.uploader.number && (
              <div className={style.actionArea}>
                <div className={style.companyInfo}>
                  {jobDetail.board_type !== '1' && (
                    <>
                      <div className={style.infoRow}>
                        <span className={style.infoLabel}>업체명</span>
                        <span className={style.infoValue}>{jobDetail.uploader.company_name || "정보없음"}</span>
                      </div>
                      <div className={style.infoRow}>
                        <span className={style.infoLabel}>대표자명</span>
                        <span className={style.infoValue}>{jobDetail.uploader.name || "정보없음"}</span>
                      </div>
                    </>
                  )}
                  <div className={style.infoRow}>
                    <span className={style.infoLabel}>전화번호</span>
                    <span
                      className={style.phoneNumber}
                      onClick={() => handleCopyPhoneNumber(formatPhoneNumber(jobDetail.uploader.number))}
                    >
                      {formatPhoneNumber(jobDetail.uploader.number)}
                    </span>
                  </div>
                </div>
                <div className={style.buttonGroup}>
                  <a
                    href={getSmsHref(jobDetail.uploader.number)}
                    className={style.smsButton}
                  >
                    문자보내기
                  </a>
                </div>
                <div className={style.notice}>
                  ※ 공고에 대한 오류 및 이로인한 책임은 114114KR에서 책임지지 않습니다.
                </div>
                <div className={style.notice}>
                  ※ 114114KR 통해서 연락한다고 말씀해주세요.
                </div>
              </div>
            )}
          </div>
        )}
        {/* 특별 광고 이미지 */}
        {jobDetail.id === 6599 && (
          <div className={style.content}>
            <img 
              src="/landing_ad.png" 
              alt="Landing Ad" 
              style={{ maxWidth: '980px', width: '100%', height: 'auto' }}
            /> 
          </div>
        )}
        {/* 자유게시판 상세 내용 */}
        {jobDetail.board_type === '4' && (
          <div className={style.content}>
            {translatedContents.split('\n').map((line: string, index: number) => (
              <React.Fragment key={index}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Comment section with updated props */}
      <Comment 
        jdId={jobDetail.id} 
        initialComments={initialComments as CommentType[]} 
      />

      {/* LoginPopup 컴포넌트 추가 */}
      {showLoginPopup && (
        <LoginPopup onClose={() => setShowLoginPopup(false)} />
      )}

      {/* 최저임금 미달 팝업 */}
      {showMinWagePopup && (
        <div className={style.minWagePopupOverlay} onClick={handleCloseMinWagePopup}>
          <div className={style.minWagePopup} onClick={(e) => e.stopPropagation()}>
            <button className={style.minWageCloseBtn} onClick={handleCloseMinWagePopup}>×</button>
            <h2 className={style.minWageTitle}>2026 최저임금 준수 안내</h2>
            <div className={style.minWageContent}>
              <p className={style.minWageText}>
                2026년 적용 <span className={style.minWageHighlight}>최저시급은 10,320원</span>입니다.
              </p>
              <p className={style.minWageSubtext}>
                변경된 최저임금이 준수되었는 지 공고 내용을 미리 확인해 주세요.
              </p>
            </div>
            <label className={style.minWageCheckbox}>
              <input 
                type="checkbox" 
                checked={dontShowAgain} 
                onChange={(e) => setDontShowAgain(e.target.checked)} 
              />
              다시 보지 않기
            </label>
          </div>
        </div>
      )}

      {/* 지원 완료 팝업 - Portal로 body에 렌더링하여 항상 최상단 표시 */}
      {showApplySuccessPopup && typeof document !== 'undefined' && createPortal(
        <div className={style.applySuccessOverlay} onClick={() => setShowApplySuccessPopup(false)}>
          <div className={style.applySuccessPopup} onClick={(e) => e.stopPropagation()}>
            <div className={style.applySuccessIcon}>✓</div>
            <p className={style.applySuccessText}>지원이 완료되었습니다</p>
            <p className={style.applySuccessSubtext}>기업에서 연락드릴 수 있습니다</p>
            <button className={style.applySuccessBtn} onClick={() => setShowApplySuccessPopup(false)}>
              확인
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default JobDetail;
