import React, { useState, useEffect, useContext, PropsWithChildren } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('user_type, user_id, email, name, company_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('UserProvider users 조회 오류:', error);
    return { userType: 'jobseeker' as const, userId: null };
  }
  return {
    userType: data?.user_type || 'jobseeker',
    userId: data?.user_type === 'jobseeker'
      ? (data?.name || data?.user_id || data?.email || null)
      : (data?.company_name || data?.user_id || data?.email || null),
  };
};

export const UserProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [userType, setUserType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    if (auth?.user?.id) {
      setIsUserLoading(true);
      let cancelled = false;
      fetchUserProfile(auth.user.id).then((result) => {
        if (cancelled) return;
        setIsUserLoading(false);
        setUserType(result.userType);
        setUserId(result.userId);
      });
      return () => {
        cancelled = true;
      };
    } else {
      setUserType(null);
      setUserId(null);
      setIsUserLoading(false);
    }
  }, [auth?.user?.id, fetchTrigger]);

  const refreshUser = () => setFetchTrigger((n) => n + 1);

  const value = {
    userType,
    userId,
    isUserLoading,
    refreshUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
