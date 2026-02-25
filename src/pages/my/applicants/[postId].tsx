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

        const { data: bookmarkData } = await supabase
          .from('bookmark')
          .select('users_id')
          .eq('jd_id', postIdNum);

        const userIds = (bookmarkData || []).map((b) => b.users_id);

        if (userIds.length === 0) {
          setApplicants([]);
          setIsLoading(false);
          return;
        }

        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);

        const userMap = new Map((usersData || []).map((u) => [u.id, u.name || '-']));

        let profileMap = new Map<string, { korean_name: string; id: string }>();
        try {
          const { data: profilesData } = await supabase
            .from('job_seeker_profiles')
            .select('user_id, korean_name, id')
            .in('user_id', userIds);
          profileMap = new Map(
            (profilesData || []).map((p) => [p.user_id, { korean_name: p.korean_name || '', id: p.id }])
          );
        } catch {
          // job_seeker_profiles 테이블이 없을 수 있음
        }

        setApplicants(
          userIds.map((uid) => ({
            users_id: uid,
            name: userMap.get(uid),
            korean_name: profileMap.get(uid)?.korean_name,
            profile_id: profileMap.get(uid)?.id,
          }))
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

              <div className={styles.listWrap}>
                {applicants.length === 0 ? (
                  <p className={styles.empty}>지원자가 없습니다.</p>
                ) : (
                  <ul className={styles.list}>
                    {applicants.map((a) => (
                      <li key={a.users_id} className={styles.item}>
                        {a.profile_id ? (
                          <Link href={`/resume/${a.profile_id}`} className={styles.itemLink}>
                            {a.korean_name || a.name || '-'}
                          </Link>
                        ) : (
                          <span className={styles.itemText}>{a.korean_name || a.name || '-'}</span>
                        )}
                      </li>
                    ))}
                  </ul>
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
