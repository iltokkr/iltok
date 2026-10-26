import React, { useState, useEffect, PropsWithChildren } from 'react';
import { User, createClient } from '@supabase/supabase-js';
import { AuthContext } from '../contexts/AuthContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 같은 사용자(id 동일)면 기존 객체를 그대로 유지한다.
  // onAuthStateChange는 토큰 갱신·탭 포커스마다 새 user 객체를 주는데, 그걸 매번 state에
  // 넣으면 [user]에 의존하는 effect(my.tsx·BoardChat·JobList·board.tsx)가 전부 재실행돼
  // 같은 쿼리를 사용자당 하루 100~200번씩 반복 호출했다.
  const applyUser = (next: User | null) =>
    setUser((prev) => (prev?.id === next?.id ? prev : next));

  useEffect(() => {
    // 현재 세션 확인
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      applyUser(user);
      setIsLoading(false);
    };

    checkSession();

    // 세션 변경 리스너 설정
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        applyUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('iltok_active_login_type');
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
  };

  const value = {
    user,
    isLoggedIn: !!user,
    isLoading,
    signIn,
    signInWithPassword,
    signOut,
    verifyOtp,
    logout: signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
