import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import JobFilter from '@/components/JobFilter';
import JobList from '@/components/JobList';
import Pagination from '@/components/Pagination';
import Footer from '@/components/Footer';
import styles from '@/styles/Board.module.css';
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FilterOptions {
  city1: string;
  city2: string;
  cate1: string;
  cate2: string;
  keyword: string;
}

interface Job {
  id: number;
  created_at: string;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
}

interface AdJob extends Job {
  ad: true;
}

const dummyJobs: Job[] = [
  {
    id: 1,
    created_at: "2023-04-01T09:00:00Z",
    title: "웹 개발자 모집",
    '1depth_region': "서울",
    "2depth_region": "강남구",
    "1depth_category": "IT",
    "2depth_category": "웹 개발",
    ad: false
  },
  {
    id: 2,
    created_at: "2023-04-02T10:30:00Z",
    title: "마케팅 매니저 채용",
    "1depth_region": "부산",
    "2depth_region": "해운대구",
    "1depth_category": "마케팅",
    "2depth_category": "디지털 마케팅",
    ad: true
  },
  {
    id: 3,
    created_at: "2023-04-03T11:15:00Z",
    title: "데이터 분석가 구인", 
    "1depth_region": "대전",
    "2depth_region": "유성구",
    "1depth_category": "데이터",
    "2depth_category": "데이터 분석",
    ad: true
  },
  // ... 더 많은 더미 데이터를 추가할 수 있습니다 ...
];

const BoardPage: React.FC = () => {

  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>({
    city1: '',
    city2: '',
    cate1: '',
    cate2: '',
    keyword: ''
  });
  const [city2Options, setCity2Options] = useState<string[]>([]);
  const [cate2Options, setCate2Options] = useState<string[]>([]);
  const [adJobs, setAdJobs] = useState<AdJob[]>([]);
  const [regularJobs, setRegularJobs] = useState<Job[]>([]);

  useEffect(() => {
    // URL 쿼리 파라미터로부터 초기 필터 상태 설정
    const { city1, city2, cate1, cate2, keyword } = router.query;
    setFilters({
      city1: city1 as string || '',
      city2: city2 as string || '',
      cate1: cate1 as string || '',
      cate2: cate2 as string || '',
      keyword: keyword as string || ''
    });
  }, [router.query]);

  useEffect(() => {
    fetchJobs();
  }, [filters, currentPage]);

  const fetchJobs = async () => {
    const { city1, city2, cate1, cate2, keyword } = filters;
    const pageSize = 30; // 페이지당 항목 수

    // Fetch ad jobs (only for the first page)
    if (currentPage === 1) {
      let adQuery = supabase
        .from('jd')
        .select('*')
        .eq('ad', true)
        .order('created_at', { ascending: false });

      if (city1) adQuery = adQuery.eq('1depth_region', city1);
      if (city2) adQuery = adQuery.eq('2depth_region', city2);
      if (cate1) adQuery = adQuery.eq('1depth_category', cate1);
      if (cate2) adQuery = adQuery.eq('2depth_category', cate2);
      if (keyword) adQuery = adQuery.ilike('title', `%${keyword}%`);

      const { data: adData, error: adError } = await adQuery;

      if (adError) {
        console.error('Error fetching ad jobs:', adError);
      } else {
        setAdJobs(adData as AdJob[] || []);
      }
    } else {
      setAdJobs([]);
    }

    // Fetch regular jobs
    let regularQuery = supabase
      .from('jd')
      .select('*', { count: 'exact' })
      .eq('ad', false)
      .order('created_at', { ascending: false });

    if (city1) regularQuery = regularQuery.eq('1depth_region', city1);
    if (city2) regularQuery = regularQuery.eq('2depth_region', city2);
    if (cate1) regularQuery = regularQuery.eq('1depth_category', cate1);
    if (cate2) regularQuery = regularQuery.eq('2depth_category', cate2);
    if (keyword) regularQuery = regularQuery.ilike('title', `%${keyword}%`);

    // Adjust pagination for regular jobs
    const regularJobsOffset = (currentPage === 1) ? 0 : (currentPage - 1) * pageSize - adJobs.length;
    const regularJobsLimit = (currentPage === 1) ? pageSize - adJobs.length : pageSize;

    regularQuery = regularQuery.range(regularJobsOffset, regularJobsOffset + regularJobsLimit - 1);

    const { data: regularData, error: regularError, count } = await regularQuery;

    if (regularError) {
      console.error('Error fetching regular jobs:', regularError);
    } else {
      setRegularJobs(regularData || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    }
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className={styles.container}>
      <Header/>
      <div className={styles.layout}>
        <MainMenu />
        <JobFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          city2Options={city2Options}
          cate2Options={cate2Options}
        />
        <JobList 
          jobs={regularJobs}
          adJobs={adJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
      <Footer />
    </div>
  );
};

export default BoardPage;
