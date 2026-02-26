import Head from 'next/head';
import React, { useEffect, useState, useContext } from 'react';
import { createClient, User } from '@supabase/supabase-js'
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import Mylist from '@/components/Mylist';
import PersonalService from '@/components/PersonalService';
import styles from '@/styles/My.module.css';
import { AuthContext } from '@/contexts/AuthContext';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MyPost {
    id: number;
    updated_time: string;
    title: string;
    '1depth_region': string;
    '2depth_region': string;
    '1depth_category': string;
    '2depth_category': string;
}

interface UserData {
  id: string;
  is_accept: boolean;
  is_upload: boolean;
  reload_times: number;
  biz_file: string | null;
  company_name: string | null;
  name: string | null;
  number: string | null;
  business_number: string | null;
  business_address: string | null;
  user_type: string | null;
}

const My: React.FC = () => {
  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showVerificationAlert, setShowVerificationAlert] = useState(false);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [activeSection, setActiveSection] = useState<'ads' | 'info' | 'applications'>('ads');
  const authContext = useContext(AuthContext);
  const router = useRouter();
  const isBusiness = userData?.user_type === 'business' || userData?.user_type === 'both';
  const isJobseeker = userData?.user_type === 'jobseeker' || userData?.user_type === 'both';

  // URL 쿼리 파라미터로 팝업 표시 여부 확인
  useEffect(() => {
    if (router.query.showVerificationAlert === 'true') {
      setShowVerificationAlert(true);
      router.replace('/my', undefined, { shallow: true });
    }
    if (router.query.showPendingAlert === 'true') {
      setShowPendingAlert(true);
      router.replace('/my', undefined, { shallow: true });
    }
  }, [router.query.showVerificationAlert, router.query.showPendingAlert]);

  // URL 쿼리 파라미터로 섹션 초기화 (공고관리/지원공고/회원정보)
  useEffect(() => {
    const section = router.query.section as string | undefined;
    if (section === 'info') {
      setActiveSection('info');
    } else if (section === 'applications') {
      setActiveSection('applications');
    } else {
      setActiveSection('ads');
    }
  }, [router.query.section]);

  // 개인회원: /my 진입 시 section 없으면 지원공고로 리다이렉트
  useEffect(() => {
    if (!router.isReady || !userData) return;
    const section = router.query.section as string | undefined;
    const isJobseekerOnly = userData.user_type === 'jobseeker';
    if (isJobseekerOnly && !section && router.pathname === '/my') {
      router.replace('/my?section=applications', undefined, { shallow: true });
    }
  }, [router.isReady, router.pathname, router.query.section, userData?.user_type]);

  useEffect(() => {
    if (authContext?.user) {
      fetchMyPosts();
      fetchUserData();
    }
  }, [authContext?.user]);

  const fetchMyPosts = async () => {
    const { data, error } = await supabase
      .from('jd')
      .select('*')
      .eq('uploader_id', authContext?.user?.id)
      .order('updated_time', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      setMyPosts(data || []);
    }
  };

  const fetchUserData = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, is_accept, is_upload, reload_times, biz_file, company_name, name, number, business_number, business_address, user_type')
      .eq('id', authContext?.user?.id)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
    } else {
      setUserData(data);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>내 정보 | 114114KR</title>
        <meta name="description" content="114114KR에서 내 정보를 확인하고 관리하세요. 등록한 채용 공고와 개인 설정을 한눈에 볼 수 있습니다." />
        <meta name="keywords" content="내 정보, 마이페이지, 채용공고 관리, 114114KR, 개인설정" />
        <meta property="og:title" content="[114114KR.com] 외국인 특화 채용 플랫폼" />
        <meta property="og:description" content="외국인 채용, 가장 빠른 연결" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/my" />
        <meta property="og:image" content="https://114114KR.com/og-image.jpg" />
        <meta property="og:site_name" content="114114KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="내 정보 | 114114KR" />
        <meta name="twitter:description" content="114114KR 마이페이지에서 내 채용 공고와 계정 정보를 관리하세요. 간편하고 효율적인 정보 관리를 경험해보세요." />
        <meta name="twitter:image" content="https://114114KR.com/og-image.jpg" />
      </Head>

      <Header />
      <MainMenu showMenuItems={true} currentSection={isBusiness ? (activeSection === 'info' ? 'info' : 'ads') : isJobseeker ? (activeSection === 'info' ? 'info' : 'applications') : undefined} />
      <main className={styles.main}>
        {(isBusiness || isJobseeker) && (
          <div className={styles.sectionTabs}>
            {isBusiness && (
              <button
                type="button"
                className={`${styles.sectionTab} ${activeSection === 'ads' ? styles.sectionTabActive : ''}`}
                onClick={() => setActiveSection('ads')}
              >
                공고관리
              </button>
            )}
            {isJobseeker && (
              <>
                <button
                  type="button"
                  className={`${styles.sectionTab} ${activeSection === 'applications' ? styles.sectionTabActive : ''}`}
                  onClick={() => setActiveSection('applications')}
                >
                  지원 한 공고
                </button>
                <a
                  href="/write?board_type=1"
                  className={`${styles.sectionTab} ${router.pathname === '/write' && router.query.board_type === '1' ? styles.sectionTabActive : ''}`}
                >
                  이력서(회원정보 통합)
                </a>
              </>
            )}
            {isBusiness && (
              <button
                type="button"
                className={`${styles.sectionTab} ${activeSection === 'info' ? styles.sectionTabActive : ''}`}
                onClick={() => setActiveSection('info')}
              >
                회원정보
              </button>
            )}
          </div>
        )}
        {activeSection === 'applications' && isJobseeker ? (
          <PersonalService activeSection="applications" />
        ) : activeSection === 'info' && isJobseeker && !isBusiness ? (
          <PersonalService activeSection="info" />
        ) : activeSection === 'info' ? (
          <>
            {isBusiness && (
              <Mylist
                activeSection="info"
                posts={myPosts}
                isAccept={userData?.is_accept || false}
                isUpload={userData?.is_upload || false}
                reloadTimes={userData?.reload_times || 0}
                bizFile={userData?.biz_file || null}
                companyName={userData?.company_name || null}
                managerName={userData?.name || null}
                phoneNumber={userData?.number || null}
                businessNumber={userData?.business_number || null}
                businessAddress={userData?.business_address || null}
                userType={userData?.user_type || null}
              />
            )}
            {isJobseeker && <PersonalService activeSection="info" />}
          </>
        ) : (
        <Mylist 
          activeSection={isBusiness ? 'ads' : 'ads'}
          posts={myPosts} 
          isAccept={userData?.is_accept || false}
          isUpload={userData?.is_upload || false}
          reloadTimes={userData?.reload_times || 0}
          bizFile={userData?.biz_file || null}
          companyName={userData?.company_name || null}
          managerName={userData?.name || null}
          phoneNumber={userData?.number || null}
          businessNumber={userData?.business_number || null}
          businessAddress={userData?.business_address || null}
          userType={userData?.user_type || null}
        />
        )}
      </main>
      <Footer />

      {/* 사업자 인증 요청 팝업 (미등록) */}
      {showVerificationAlert && (
        <div className={styles.modalOverlay} onClick={() => setShowVerificationAlert(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>사업자 인증 요청</h2>
            <p className={styles.modalText}>
              마이페이지 상단 <strong>등록하기</strong> 버튼을 통해서,<br />
              사업자 인증을 완료해주세요.
            </p>
            <p className={styles.modalSubText}>
              현재 등록하신 게시글은 사업자 인증 후 게시판에 노출됩니다.
            </p>
            <button 
              className={styles.modalButton}
              onClick={() => setShowVerificationAlert(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 사업자 심사중 팝업 */}
      {showPendingAlert && (
        <div className={styles.modalOverlay} onClick={() => setShowPendingAlert(false)}>
          <div className={styles.modalContentPending} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pendingIconWrap}>
              <span className={styles.pendingIcon}>✓</span>
            </div>
            <h2 className={styles.pendingTitle}>사업자 심사중</h2>
            <p className={styles.pendingText}>
              현재 사업자 정보를 확인하고 있습니다.
            </p>
            <div className={styles.pendingInfo}>
              <span className={styles.pendingInfoLabel}>인증 소요 기간</span>
              <span className={styles.pendingInfoValue}>당일 ~ 1일</span>
            </div>
            <button 
              className={styles.pendingButton}
              onClick={() => setShowPendingAlert(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default My;
// import { useEffect } from 'react';
// import { useRouter } from 'next/router';

// export default function Home() {
//   const router = useRouter();

//   useEffect(() => {
//     router.push('/jd/3323');
//   }, []);

//   return null;
// };

