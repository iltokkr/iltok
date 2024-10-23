import React, { useEffect, useState } from 'react';
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
  created_at: string;
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

  return (
    <div className={styles.container}>
      <Header/>
      <div className={styles.layout}>
        {jobDetail && <JobDetail jobDetail={jobDetail} />}
      </div>
      <Footer />
    </div>
  );
};

export default JobDetailPage;
