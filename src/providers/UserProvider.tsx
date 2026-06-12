import React, { useState, useEffect, useContext, PropsWithChildren } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';
import AcceptApprovedModal from '@/components/AcceptApprovedModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('user_type, user_id, email, name, company_name, is_accept, accept_notified')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('UserProvider users 조회 오류:', error);
    return { userType: 'jobseeker' as const, userId: null, needsAcceptNotice: false };
  }
  return {
    userType: data?.user_type || 'jobseeker',
    userId: data?.user_type === 'jobseeker'
      ? (data?.name || data?.user_id || data?.email || null)
      : (data?.company_name || data?.user_id || data?.email || null),
    // 사업자 인증이 승인(is_accept=true)되었지만 아직 승인 알림을 보여주지 않은 경우
    needsAcceptNotice: data?.is_accept === true && data?.accept_notified === false,
  };
};

export const UserProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [userType, setUserType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  useEffect(() => {
    if (auth?.user?.id) {
      setIsUserLoading(true);
      let cancelled = false;
      fetchUserProfile(auth.user.id).then((result) => {
        if (cancelled) return;
        setIsUserLoading(false);
        setUserType(result.userType);
        setUserId(result.userId);
        if (result.needsAcceptNotice) {
          setShowAcceptModal(true);
        }
      });
      return () => {
        cancelled = true;
      };
    } else {
      setUserType(null);
      setUserId(null);
      setIsUserLoading(false);
      setShowAcceptModal(false);
    }
  }, [auth?.user?.id, fetchTrigger]);

  const refreshUser = () => setFetchTrigger((n) => n + 1);

  // 승인 알림 확인: 모달을 닫으면서 다시 뜨지 않도록 accept_notified=true 로 기록
  const handleAcceptModalClose = async () => {
    setShowAcceptModal(false);
    const uid = auth?.user?.id;
    if (!uid) return;
    const { error } = await supabase
      .from('users')
      .update({ accept_notified: true })
      .eq('id', uid);
    if (error) {
      console.error('accept_notified 업데이트 오류:', error);
    }
  };

  const value = {
    userType,
    userId,
    isUserLoading,
    refreshUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
      {showAcceptModal && <AcceptApprovedModal onClose={handleAcceptModalClose} />}
    </UserContext.Provider>
  );
};
