import Head from 'next/head';
import React, { useEffect, useContext } from 'react';
import { createClient } from '@supabase/supabase-js'
import { AuthContext } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WritePage from '@/components/writeComponent';
import styles from '@/styles/Write.module.css';
import { useRouter } from 'next/router';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Write 컴포넌트
 * 
 * 이 컴포넌트는 사용자가 새로운 구인 공고를 작성할 수 있는 페이지를 렌더링합니다.
 * 
 * 주요 기능:
 * - 로그인한 사용자만 접근 가능
 * - 사용자의 비즈니스 인증 상태 확인
 * - 비즈니스 인증이 필요한 경우 모달 표시
 * - 구인 공고 작성 폼 제공
 * 
 * @returns {JSX.Element} 구인 공고 작성 페이지의 렌더링된 컴포넌트
 */
const Write: React.FC = () => {
  const router = useRouter();
  const authContext = useContext(AuthContext);

  useEffect(() => {
    // 로그인한 경우에만 사용자 인증 상태 확인
    if (authContext?.user) {
      const checkUserAcceptance = async () => {
        if (!authContext?.user?.id) return;

        const { data, error } = await supabase
          .from('users')
          .select('is_accept')
          .eq('id', authContext.user.id)
          .single();

        if (error) {
          console.error('Error fetching user data:', error);
        } else if (data && !data.is_accept) {
          router.push('/board');
        }
      };

      checkUserAcceptance();
    }
  }, [authContext?.user]);

  return (
    <div className={styles.container}>
      <Head>
        <title>구인 공고 작성 | 114114KR</title>
        <meta name="description" content="114114KR에서 새로운 구인 공고를 작성하세요. 효과적인 채용 공고로 최적의 인재를 찾을 수 있습니다." />
        <meta name="keywords" content="구인 공고 작성, 채용 공고, 인재 채용, 114114KR" />
        <meta property="og:title" content="구인 공고 작성 | 114114KR" />
        <meta property="og:description" content="114114KR에서 새로운 구인 공고를 작성하세요. 효과적인 채용 공고로 최적의 인재를 찾을 수 있습니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/write" />
        <meta property="og:image" content="https://114114KR.com/og-image.jpg" />
        <meta property="og:site_name" content="114114KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="구인 공고 작성 | 114114KR" />
        <meta name="twitter:description" content="114114KR에서 새로운 구인 공고를 작성하세요. 효과적인 채용 공고로 최적의 인재를 찾을 수 있습니다." />
        <meta name="twitter:image" content="https://114114KR.com/og-image.jpg" />
      </Head>
      <Header />
      <main className={styles.layout}>
        <WritePage />
      </main>
      <Footer />
    </div>
  );
};

export default Write;

// Add this at the end of the file
export const getStaticProps = async () => {
  return {
    props: {},
  };
};
// import { useEffect } from 'react';
// import { useRouter } from 'next/router';

// export default function Home() {
//   const router = useRouter();

//   useEffect(() => {
//     router.push('/jd/3323');
//   }, []);

//   return null;
// }
