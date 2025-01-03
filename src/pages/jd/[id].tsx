import Head from 'next/head';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import JobDetail from '@/components/JobDetail';
import Footer from '@/components/Footer';
import styles from '@/styles/JobDetailPage.module.css';
import { useLanguage } from '@/hooks/useLanguage';
import MainMenu from '@/components/MainMenu';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobDetailType {
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
  salary_type: string;
  salary_detail: string;
  '1depth_category': string;
  '2depth_category': string;
  '1depth_region': string;
  '2depth_region': string;
  work_location_detail: string;
  work_start_time: string;
  work_end_time: string;
  uploader: {
    company_name: string;
    name: string;
    number: string;
  };
}

// getServerSideProps 수정
export async function getServerSideProps({ params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabase
      .from('jd')
      .select(`
        *,
        uploader:users (company_name, name, number)
      `)
      .eq('id', params.id)  // 실제 요청된 ID 사용
      .single();

    if (error || !data) {
      return {
        notFound: true // 404 페이지 표시
      };
    }

    const processedData = {
      ...data,
      uploader: data.uploader || { company_name: "정보 없음", name: "정보 없음" },
      board_type: data.board_type
    };

    return {
      props: {
        initialJobDetail: processedData
      }
    };
  } catch (error) {
    console.error('Error fetching job detail:', error);
    return {
      notFound: true // 404 페이지 표시
    };
  }
}

const JobDetailPage: React.FC<{ initialJobDetail: JobDetailType | null }> = ({ initialJobDetail }) => {
  const router = useRouter();
  const { id } = router.query;
  const { currentLanguage } = useLanguage();
  const [jobDetail, setJobDetail] = useState<JobDetailType | null>(initialJobDetail);
  const scrollPositionRef = useRef<number>(0);
  const [boardType, setBoardType] = useState<string>(initialJobDetail?.board_type || '0');

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem('scrollPosition', window.pageYOffset.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    // JD 페이지에 진입할 때 항상 맨 위로 스크롤
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleRouteChangeComplete = () => {
      if (router.asPath === '/board') {
        const savedPosition = sessionStorage.getItem('boardScrollPosition');
        if (savedPosition) {
          setTimeout(() => {
            window.scrollTo(0, parseInt(savedPosition));
          }, 0);
        }
      }
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router]);

  const canonicalUrl = `https://114114KR.com/JobDetailPage/${id}`;

  const structuredData = jobDetail
    ? {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: jobDetail.title,
        description: jobDetail.contents,
        datePosted: jobDetail.updated_time,
        hiringOrganization: {
          '@type': 'Organization',
          name: jobDetail.uploader.company_name,
        },
      }
    : null;

  return (
    <div className={styles.container}>
      <Head>
        <title>{jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name} | 114114KR` : '채용 상세 | 114114KR'}</title>
        
        {/* SEO 메타 태그 */}
        <meta name="description" content={jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name}의 채용 정보를 확인하세요. ${jobDetail.contents.substring(0, 150)}...` : '114114KR에서 다양한 채용 정보를 확인하세요.'} />
        <meta name="keywords" content={`채용정보, 구인구직, ${jobDetail?.title}, ${jobDetail?.uploader.company_name}, 114114KR`} />
        
        {/* Open Graph 태그 */}
        <meta property="og:title" content={jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name} | 114114KR` : '채용 상세 | 114114KR'} />
        <meta property="og:description" content={jobDetail ? `${jobDetail.contents.substring(0, 200)}...` : '114114KR에서 다양한 채용 정보를 확인하세요.'} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://114114kr.com/ogimage.png" />
        <meta property="og:site_name" content="114114KR" />
        
        {/* Twitter 카드 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name} | 114114KR` : '채용 상세 | 114114KR'} />
        <meta name="twitter:description" content={jobDetail ? `${jobDetail.contents.substring(0, 200)}...` : '114114KR에서 다양한 채용 정보를 확인하세요.'} />
        <meta name="twitter:image" content="https://114114kr.com/ogimage.png" />
        
        <link rel="canonical" href={canonicalUrl} />
      </Head>

      <Header/>
      <MainMenu currentBoardType={boardType} />
      <div className={styles.layout}>
        {jobDetail ? (
          <JobDetail 
            jobDetail={jobDetail}
          />
        ) : (
          <p>채용 정보를 불러오는 중입니다...</p>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default JobDetailPage;
