// import Head from 'next/head';
// import React, { useEffect, useState, useContext } from 'react';
// import { createClient, User } from '@supabase/supabase-js'
// import Header from '@/components/Header';
// import Footer from '@/components/Footer';
// import Mylist from '@/components/Mylist';
// import styles from '@/styles/My.module.css';
// import { AuthContext } from '@/contexts/AuthContext';

// // Supabase 클라이언트 생성
// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )

// interface MyPost {
//     id: number;
//     updated_time: string;
//     title: string;
//     '1depth_region': string;
//     '2depth_region': string;
//     '1depth_category': string;
//     '2depth_category': string;
// }

// interface UserData {
//   id: string;
//   is_accept: boolean;
//   is_upload: boolean;
//   reload_times: number;
// }

// const My: React.FC = () => {
//   const [myPosts, setMyPosts] = useState<MyPost[]>([]);
//   const [userData, setUserData] = useState<UserData | null>(null);
//   const authContext = useContext(AuthContext);

//   useEffect(() => {
//     if (authContext?.user) {
//       fetchMyPosts();
//       fetchUserData();
//     }
//   }, [authContext?.user]);

//   const fetchMyPosts = async () => {
//     const { data, error } = await supabase
//       .from('jd')
//       .select('*')
//       .eq('uploader_id', authContext?.user?.id)
//       .order('updated_time', { ascending: false });

//     if (error) {
//       console.error('Error fetching posts:', error);
//     } else {
//       setMyPosts(data || []);
//     }
//   };

//   const fetchUserData = async () => {
//     const { data, error } = await supabase
//       .from('users')
//       .select('id, is_accept, is_upload, reload_times')
//       .eq('id', authContext?.user?.id)
//       .single();

//     if (error) {
//       console.error('Error fetching user data:', error);
//     } else {
//       setUserData(data);
//     }
//   };

//   return (
//     <div className={styles.container}>
//       <Head>
//         <title>내 정보 | 114114KR</title>
//         <meta name="description" content="114114KR에서 내 정보를 확인하고 관리하세요. 등록한 구인 공고와 개인 설정을 한눈에 볼 수 있습니다." />
//         <meta name="keywords" content="내 정보, 마이페이지, 구인공고 관리, 114114KR, 개인설정" />
//         <meta property="og:title" content="내 정보 | 114114KR" />
//         <meta property="og:description" content="114114KR 마이페이지에서 내 구인 공고와 계정 정보를 관리하세요. 간편하고 효율적인 정보 관리를 경험해보세요." />
//         <meta property="og:type" content="website" />
//         <meta property="og:url" content="https://114114KR.com/my" />
//         <meta property="og:image" content="https://114114KR.com/og-image.jpg" />
//         <meta property="og:site_name" content="114114KR" />
//         <meta name="twitter:card" content="summary_large_image" />
//         <meta name="twitter:title" content="내 정보 | 114114KR" />
//         <meta name="twitter:description" content="114114KR 마이페이지에서 내 구인 공고와 계정 정보를 관리하세요. 간편하고 효율적인 정보 관리를 경험해보세요." />
//         <meta name="twitter:image" content="https://114114KR.com/og-image.jpg" />
//       </Head>

//       <Header />
//       <main className={styles.main}>
//         <Mylist 
//           posts={myPosts} 
//           isAccept={userData?.is_accept || false}
//           isUpload={userData?.is_upload || false}
//           reloadTimes={userData?.reload_times || 0}
//         />
//       </main>
//       <Footer />
//     </div>
//   );
// };

// export default My;
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/jd/3323');
  }, []);

  return null;
};

