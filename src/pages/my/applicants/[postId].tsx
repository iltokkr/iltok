import React, { useEffect, useState, useContext } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import Footer from '@/components/Footer';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '@/styles/Applicants.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Applicant {
  users_id: string;
  name?: string;
  korean_name?: string;
  profile_id?: string;
  gender?: string;
  age?: number | null;
  nationality?: string;
  visa_status?: string;
  phone?: string;
  preferred_regions?: string;
}

interface PostInfo {
  id: number;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  uploader_id: string;
}

const ApplicantsPage: React.FC = () => {
  const router = useRouter();
  const { postId } = router.query;
  const auth = useContext(AuthContext);
  const [post, setPost] = useState<PostInfo | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || !auth?.user) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const postIdNum = Number(postId);
        if (isNaN(postIdNum)) {
          setError('잘못된 공고입니다.');
          setIsLoading(false);
          return;
        }

        const { data: postData, error: postError } = await supabase
          .from('jd')
          .select('id, title, 1depth_region, 2depth_region, uploader_id')
          .eq('id', postIdNum)
          .single();

        if (postError || !postData) {
          setError('공고를 찾을 수 없습니다.');
          setIsLoading(false);
          return;
        }

        if (postData.uploader_id !== auth?.user?.id) {
          setError('접근 권한이 없습니다.');
          setIsLoading(false);
          return;
        }

        setPost(postData);

        const { data: applicationData } = await supabase
          .from('job_application')
          .select('users_id')
          .eq('jd_id', postIdNum);

        const userIds = (applicationData || []).map((b) => b.users_id);

        if (userIds.length === 0) {
          setApplicants([]);
          setIsLoading(false);
          return;
        }

        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, number')
          .in('id', userIds);

        const userMap = new Map((usersData || []).map((u) => [u.id, { name: u.name || '-', number: u.number || '' }]));

        let profileMap = new Map<string, { korean_name: string; id: string; gender?: string; birth_year?: number; birth_month?: number; birth_day?: number; nationality?: string; visa_status?: string; preferred_regions?: string[] }>();
        try {
          const { data: profilesData } = await supabase
            .from('job_seeker_profiles')
            .select('user_id, korean_name, id, gender, birth_year, birth_month, birth_day, nationality, visa_status, preferred_regions')
            .in('user_id', userIds);
          profileMap = new Map(
            (profilesData || []).map((p) => {
              let regions: string[] = [];
              if (p.preferred_regions) {
                try {
                  regions = typeof p.preferred_regions === 'string' ? JSON.parse(p.preferred_regions) : (p.preferred_regions as string[]);
                } catch {
                  regions = [];
                }
              }
              return [
                p.user_id,
                {
                  korean_name: p.korean_name || '',
                  id: p.id,
                  gender: p.gender || '',
                  birth_year: p.birth_year,
                  birth_month: p.birth_month,
                  birth_day: p.birth_day,
                  nationality: p.nationality || '',
                  visa_status: p.visa_status || '',
                  preferred_regions: Array.isArray(regions) ? regions : [],
                },
              ];
            })
          );
        } catch {
          // job_seeker_profiles 테이블이 없을 수 있음
        }

        const calcAge = (y?: number, m?: number, d?: number): number | null => {
          if (!y) return null;
          const today = new Date();
          const birth = new Date(y, (m || 1) - 1, d || 1);
          let age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
          return age >= 0 ? age : null;
        };

        const formatPhone = (n?: string) => {
          if (!n) return '-';
          const cleaned = n.replace(/\D/g, '');
          if (cleaned.startsWith('82') && cleaned.length >= 11) return `0${cleaned.slice(2)}`;
          return n;
        };

        setApplicants(
          userIds.map((uid) => {
            const profile = profileMap.get(uid);
            const user = userMap.get(uid);
            const regions = profile?.preferred_regions;
            const regionStr = Array.isArray(regions) && regions.length > 0 ? regions.join(', ') : '-';
            return {
              users_id: uid,
              name: user?.name,
              korean_name: profile?.korean_name,
              profile_id: profile?.id,
              gender: profile?.gender || '-',
              age: calcAge(profile?.birth_year, profile?.birth_month, profile?.birth_day),
              nationality: profile?.nationality || '-',
              visa_status: profile?.visa_status || '-',
              phone: formatPhone(user?.number),
              preferred_regions: regionStr,
            };
          })
        );
      } catch (err) {
        console.error(err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [postId, auth?.user]);

  useEffect(() => {
    if (!auth?.user) {
      router.replace('/');
    }
  }, [auth?.user, router]);

  if (!auth?.user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>지원자 명단 | 114114KR</title>
        <meta name="description" content="채용 공고 지원자 명단을 확인하세요." />
      </Head>

      <Header />
      <MainMenu showMenuItems={true} currentSection="ads" />

      <main className={styles.main}>
        <div className={styles.content}>
          <Link href="/my" className={styles.backLink}>
            ← 공고관리로 돌아가기
          </Link>

          {isLoading ? (
            <div className={styles.loading}>로딩 중...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : post ? (
            <>
              <div className={styles.header}>
                <h1 className={styles.title}>지원자 명단</h1>
                <p className={styles.postTitle}>{post.title}</p>
                <p className={styles.postRegion}>
                  {post['1depth_region']} {post['2depth_region']}
                </p>
              </div>

              <div className={styles.tableWrap}>
                {applicants.length === 0 ? (
                  <p className={styles.empty}>지원자가 없습니다.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>성별</th>
                        <th>나이</th>
                        <th>국적</th>
                        <th>비자</th>
                        <th>연락처</th>
                        <th>거주지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((a) => (
                        <tr key={a.users_id}>
                          <td>
                            {a.profile_id ? (
                              <Link href={`/resume/${a.profile_id}`} className={styles.itemLink}>
                                {a.korean_name || a.name || '-'}
                              </Link>
                            ) : (
                              <span className={styles.itemText}>{a.korean_name || a.name || '-'}</span>
                            )}
                          </td>
                          <td>{a.gender || '-'}</td>
                          <td>{a.age != null ? `${a.age}세` : '-'}</td>
                          <td>{a.nationality || '-'}</td>
                          <td>{a.visa_status || '-'}</td>
                          <td>{a.phone || '-'}</td>
                          <td>{a.preferred_regions || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ApplicantsPage;
