import React, { useEffect, useState, useContext } from 'react';
import { createClient } from '@supabase/supabase-js'
import { AuthContext } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WritePage from '@/components/writeComponent';
import BusinessVerificationModal from '@/components/BusinessVerificationModal';
import styles from '@/styles/Write.module.css';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const Write: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const checkUserAcceptance = async () => {
      if (authContext?.user) {
        const { data, error } = await supabase
          .from('users')
          .select('is_accept')
          .eq('id', authContext.user.id)
          .single();

        if (error) {
          console.error('Error fetching user data:', error);
        } else if (data && !data.is_accept) {
          setShowModal(true);
        }
      }
    };

    checkUserAcceptance();
  }, [authContext?.user]);

  if (!authContext?.isLoggedIn) {
    // 로그인하지 않은 사용자를 위한 처리
    return <div>Please log in to access this page.</div>;
  }

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.layout}>
        <WritePage />
      </main>
      <Footer />
      {showModal && <BusinessVerificationModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default Write;
