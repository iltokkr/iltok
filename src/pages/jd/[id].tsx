import Head from 'next/head';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import JobDetail from '@/components/JobDetail';
import Footer from '@/components/Footer';
import styles from '@/styles/JobDetailPage.module.css';

// Supabase 클라이언트 설정
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface JobDetailType {
  id: number;
  updated_time: string;
  title: string;
  contents: string;
  ad: boolean;
  uploader: {
    company_name: string;
    name: string;
  };
}

const JobDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [jobDetail, setJobDetail] = useState<JobDetailType | null>(null);
  const scrollPositionRef = useRef<number>(0);

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
    const handleRouteChangeStart = () => {
      scrollPositionRef.current = window.pageYOffset;
    };

    const handleRouteChangeComplete = () => {
      if (router.asPath === '/board') {
        setTimeout(() => {
          window.scrollTo(0, scrollPositionRef.current);
        }, 0);
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router]);

  useEffect(() => {
    const fetchJobDetail = async () => {
      if (id) {
        const { data, error } = await supabase
          .from('jd')
          .select(`
            *,
            uploader:users (company_name, name)
          `)
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching job detail:', error);
        } else {
          // uploader가 null인 경우 기본값 설정
          const processedData = {
            ...data,
            uploader: data.uploader || { company_name: "정보 없음", name: "정보 없음" }
          };
          setJobDetail(processedData);
        }
      }
    };

    fetchJobDetail();
  }, [id]);

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
        <title>{jobDetail ? `${jobDetail.title} | 114114KR` : '채용 상세 | 114114KR'}</title>
        <meta name="description" content={jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name}의 채용 정보를 확인하세요. ${jobDetail.contents.substring(0, 150)}...` : '114114KR에서 다양한 채용 정보를 확인하세요.'} />
        <meta name="keywords" content={`채용정보, 구인구직, ${jobDetail?.title}, ${jobDetail?.uploader.company_name}, 114114KR`} />
        <meta property="og:title" content={jobDetail ? `${jobDetail.title} | 114114KR` : '채용 상세 | 114114KR'} />
        <meta property="og:description" content={jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name}의 채용 정보를 확인하세요. ${jobDetail.contents.substring(0, 150)}...` : '114114KR에서 다양한 채용 정보를 확인하세요.'} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://114114KR.com/og-image.jpg" />
        <meta property="og:site_name" content="114114KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={jobDetail ? `${jobDetail.title} | 114114KR` : '채용 상세 | 114114KR'} />
        <meta name="twitter:description" content={jobDetail ? `${jobDetail.title} - ${jobDetail.uploader.company_name}의 채용 정보를 확인하세요. ${jobDetail.contents.substring(0, 150)}...` : '114114KR에서 다양한 채용 정보를 확인하세요.'} />
        <meta name="twitter:image" content="https://114114KR.com/og-image.jpg" />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href={canonicalUrl} />
        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Head>

      <Header/>
      <div className={styles.layout}>
        {jobDetail ? (
          <JobDetail jobDetail={jobDetail} />
        ) : (
          <p>채용 정보를 불러오는 중입니다...</p>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default JobDetailPage;
