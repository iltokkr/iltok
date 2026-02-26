import React, { useState, useEffect, useContext, PropsWithChildren } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const UserProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [userType, setUserType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);

  useEffect(() => {
    if (auth?.user?.id) {
      setIsUserLoading(true);
      let cancelled = false;
      supabase
        .from('users')
        .select('user_type, user_id, email, name')
        .eq('id', auth.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return;
          setIsUserLoading(false);
          if (error) {
            console.error('UserProvider users 조회 오류:', error);
            setUserType('jobseeker');
            setUserId(null);
            return;
          }
          setUserType(data?.user_type || 'jobseeker');
          setUserId(
            data?.user_type === 'jobseeker'
              ? (data?.name || data?.user_id || data?.email || null)
              : (data?.user_id || data?.email || null)
          );
        });
      return () => {
        cancelled = true;
      };
    } else {
      setUserType(null);
      setUserId(null);
      setIsUserLoading(false);
    }
  }, [auth?.user?.id]);

  const value = {
    userType,
    userId,
    isUserLoading,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
