import Head from 'next/head';
import React, { useEffect, useState, useContext } from 'react';
import { createClient, User } from '@supabase/supabase-js'
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Mylist from '@/components/Mylist';
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
    board_type?: string;
    status?: string;
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
}

const My: React.FC = () => {
  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showVerificationAlert, setShowVerificationAlert] = useState(false);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const authContext = useContext(AuthContext);
  const router = useRouter();

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
      .select('id, is_accept, is_upload, reload_times, biz_file, company_name, name, number, business_number, business_address')
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
        <meta property="og:title" content="내 정보 | 114114KR" />
        <meta property="og:description" content="114114KR 마이페이지에서 내 채용 공고와 계정 정보를 관리하세요. 간편하고 효율적인 정보 관리를 경험해보세요." />
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
      <main className={styles.main}>
        <Mylist 
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
        />
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
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>사업자 심사중</h2>
            <p className={styles.modalText}>
              현재 사업자 정보를 확인하고있습니다.
            </p>
            <p className={styles.modalSubText}>
              사업자 인증 소요 기간 : 당일 ~ 1일 후
            </p>
            <button 
              className={styles.modalButton}
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

