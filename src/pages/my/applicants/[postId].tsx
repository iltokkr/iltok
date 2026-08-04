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

        // 지원자 이름·전화번호는 서버(service_role)에서 소유자 검증 후에만 내려준다.
        // (클라이언트가 users 테이블을 직접 조회하던 연락처 유출 경로 제거)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('로그인이 필요합니다.');
          setIsLoading(false);
          return;
        }

        const resp = await fetch(`/api/my/applicants/${postIdNum}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          setError(j.error || '데이터를 불러오는데 실패했습니다.');
          setIsLoading(false);
          return;
        }

        const { post: postData, applicants } = await resp.json();
        setPost(postData);
        setApplicants(applicants);
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
