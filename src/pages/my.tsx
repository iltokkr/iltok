import React, { useEffect, useState, useContext } from 'react';
import { createClient, User } from '@supabase/supabase-js'
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Mylist from '@/components/Mylist';
import styles from '@/styles/My.module.css';
import { AuthContext } from '@/contexts/AuthContext';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MyPost {
    id: number;
    created_at: string;
    title: string;
    '1depth_region': string;
    '2depth_region': string;
    '1depth_category': string;
    '2depth_category': string;
}

interface UserData {
  id: string;
  is_accept: boolean;
}

const My: React.FC = () => {
  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [isAccept, setIsAccept] = useState<boolean>(false);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    if (authContext?.user) {
      fetchMyPosts();
      fetchUserData();
    }
  }, [authContext?.user]);

  const fetchMyPosts = async () => {
    const { data, error } = await supabase
      .from('jd')
      .select('*')
      .eq('uploader_id', authContext?.user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      setMyPosts(data || []);
    }
  };

  const fetchUserData = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('is_accept')
      .eq('id', authContext?.user?.id)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
    } else {
      setIsAccept(data?.is_accept || false);
    }
  };

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <Mylist posts={myPosts} isAccept={isAccept} />
      </main>
      <Footer />
    </div>
  );
};

export default My;
