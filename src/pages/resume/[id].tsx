import React, { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '@/styles/ResumeDetail.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobSeekerProfile {
  id: string;
  user_id: string;
  korean_name: string;
  english_name?: string;
  gender?: string;
  birth_year?: number;
  birth_month?: number;
  birth_day?: number;
  profile_image_url?: string;
  desired_jobs?: string[];
  nationality?: string;
  visa_status?: string;
  korean_ability?: string;
  work_time_preference?: string[];
  pay_type_preference?: string[];
  work_duration_preference?: string[];
  work_day_preference?: string[];
  dormitory_needed?: boolean;
  message_to_employer?: string;
  zip_code?: string;
  address?: string;
  address_detail?: string;
  preferred_regions?: string[];
  view_count: number;
  created_at: string;
  updated_at: string;
}

const ResumeDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const auth = useContext(AuthContext);
  const [profile, setProfile] = useState<JobSeekerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProfile(id as string);
    }
  }, [id]);

  useEffect(() => {
    if (profile && auth?.user) {
      setIsOwner(profile.user_id === auth.user.id);
    }
  }, [profile, auth?.user]);

  const fetchProfile = async (profileId: string) => {
    setIsLoading(true);
    try {
      // 프로필 조회
      const { data, error } = await supabase
        .from('job_seeker_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;

      setProfile(data);

      // 조회수 증가
      await supabase.rpc('increment_profile_view_count', { profile_id: profileId });
    } catch (error) {
      console.error('Error fetching profile:', error);
      router.push('/board?board_type=1');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthYear?: number) => {
    if (!birthYear) return null;
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear + 1;
  };

  const handleEdit = () => {
    router.push('/resume');
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <MainMenu showMenuItems={false} />
        <div className={styles.loadingContainer}>
          <p>로딩 중...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Header />
        <div className={styles.errorContainer}>
          <p>이력서를 찾을 수 없습니다.</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{profile.korean_name}님의 이력서 - 일톡</title>
        <meta name="description" content={`${profile.korean_name}님의 구직 이력서`} />
      </Head>
      <Header />
      <MainMenu showMenuItems={false} />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* 프로필 헤더 */}
          <div className={styles.profileHeader}>
            <div className={styles.profileImage}>
              {profile.profile_image_url ? (
                <img src={profile.profile_image_url} alt={profile.korean_name} />
              ) : (
                <div className={styles.imagePlaceholder}>
                  <span>{profile.korean_name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className={styles.profileInfo}>
              <h1 className={styles.name}>
                {profile.korean_name}
                {profile.english_name && (
                  <span className={styles.englishName}>({profile.english_name})</span>
                )}
              </h1>
              <div className={styles.basicInfo}>
                {profile.gender && <span>{profile.gender}</span>}
                {profile.birth_year && <span>{calculateAge(profile.birth_year)}세</span>}
                {profile.nationality && <span>{profile.nationality}</span>}
              </div>
            </div>
            {isOwner && (
              <button onClick={handleEdit} className={styles.editButton}>
                수정하기
              </button>
            )}
          </div>

          {/* 기본 정보 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>기본 정보</h2>
            <div className={styles.infoGrid}>
              {profile.visa_status && (
                <div className={styles.infoItem}>
                  <span className={styles.label}>체류자격</span>
                  <span className={styles.value}>{profile.visa_status}</span>
                </div>
              )}
              {profile.korean_ability && (
                <div className={styles.infoItem}>
                  <span className={styles.label}>한국어 능력</span>
                  <span className={styles.value}>{profile.korean_ability}</span>
                </div>
              )}
              {profile.address && (
                <div className={styles.infoItem}>
                  <span className={styles.label}>거주지</span>
                  <span className={styles.value}>{profile.address}</span>
                </div>
              )}
            </div>
          </section>

          {/* 희망 업무 */}
          {profile.desired_jobs && profile.desired_jobs.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>희망 업무</h2>
              <div className={styles.tagList}>
                {profile.desired_jobs.map((job, index) => (
                  <span key={index} className={styles.tag}>{job}</span>
                ))}
              </div>
            </section>
          )}

          {/* 희망 근무조건 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>희망 근무조건</h2>
            <div className={styles.conditionList}>
              {profile.work_time_preference && profile.work_time_preference.length > 0 && (
                <div className={styles.conditionRow}>
                  <span className={styles.conditionLabel}>근무시간:</span>
                  {profile.work_time_preference.map((item, index) => (
                    <span key={index} className={styles.conditionTag}>{item}</span>
                  ))}
                </div>
              )}
              {profile.pay_type_preference && profile.pay_type_preference.length > 0 && (
                <div className={styles.conditionRow}>
                  <span className={styles.conditionLabel}>급여형태:</span>
                  {profile.pay_type_preference.map((item, index) => (
                    <span key={index} className={styles.conditionTag}>{item}</span>
                  ))}
                </div>
              )}
              {profile.work_duration_preference && profile.work_duration_preference.length > 0 && (
                <div className={styles.conditionRow}>
                  <span className={styles.conditionLabel}>근무기간:</span>
                  {profile.work_duration_preference.map((item, index) => (
                    <span key={index} className={styles.conditionTag}>{item}</span>
                  ))}
                </div>
              )}
              {profile.work_day_preference && profile.work_day_preference.length > 0 && (
                <div className={styles.conditionRow}>
                  <span className={styles.conditionLabel}>근무요일:</span>
                  {profile.work_day_preference.map((item, index) => (
                    <span key={index} className={styles.conditionTag}>{item}</span>
                  ))}
                </div>
              )}
              {profile.dormitory_needed && (
                <div className={styles.conditionRow}>
                  <span className={styles.conditionTag}>기숙사 필요</span>
                </div>
              )}
            </div>
          </section>

          {/* 희망 근무지역 */}
          {profile.preferred_regions && profile.preferred_regions.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>희망 근무지역</h2>
              <div className={styles.tagList}>
                {profile.preferred_regions.map((region, index) => (
                  <span key={index} className={styles.regionTag}>📍 {region}</span>
                ))}
              </div>
            </section>
          )}

          {/* 사장님께 한마디 */}
          {profile.message_to_employer && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>사장님께 한마디</h2>
              <div className={styles.messageBox}>
                <p>{profile.message_to_employer}</p>
              </div>
            </section>
          )}

          {/* 조회수 */}
          <div className={styles.viewCount}>
            👁 조회수 {profile.view_count}회
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default ResumeDetailPage;




