import React, { useContext, useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JobSeekerProfileForm from '@/components/JobSeekerProfileForm';
import LoginPopup from '@/components/LoginPopup';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '@/styles/Resume.module.css';

const ResumePage: React.FC = () => {
  const auth = useContext(AuthContext);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // 클라이언트에서만 로그인 상태 체크
    if (isClient && !auth?.isLoading && !auth?.isLoggedIn) {
      setShowLoginPopup(true);
    }
  }, [auth?.isLoading, auth?.isLoggedIn, isClient]);

  if (!isClient || auth?.isLoading) {
    return (
      <>
        <Head>
          <title>이력서 등록 - 일톡</title>
        </Head>
        <Header />
        <div className={styles.loadingContainer}>
          <p>로딩 중...</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>이력서 등록 - 일톡</title>
        <meta name="description" content="구직자 이력서를 등록하고 관리하세요" />
      </Head>
      <Header />
      <main className={styles.main}>
        {auth?.isLoggedIn ? (
          <JobSeekerProfileForm />
        ) : (
          <div className={styles.loginRequired}>
            <p>이력서 등록을 위해 로그인이 필요합니다.</p>
            <button onClick={() => setShowLoginPopup(true)} className={styles.loginButton}>
              로그인하기
            </button>
          </div>
        )}
      </main>
      <Footer />
      
      {showLoginPopup && (
        <LoginPopup onClose={() => setShowLoginPopup(false)} />
      )}
    </>
  );
};

export default ResumePage;



