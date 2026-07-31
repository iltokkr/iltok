import React, { useState, useEffect, useContext, PropsWithChildren } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';
import AcceptApprovedModal from '@/components/AcceptApprovedModal';
import SpamWarningModal, { SpamWarning } from '@/components/SpamWarningModal';

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

/**
 * 미확인 도배 경고 조회. 테이블이 없거나 오류면 조용히 빈 배열 반환.
 * 3차 이상 경고는 팝업에 전체 이력을 보여줘야 하므로 확인 완료분까지 함께 조회한다.
 */
const fetchUnacknowledgedWarnings = async (userId: string): Promise<SpamWarning[]> => {
  try {
    const { data, error } = await supabase
      .from('user_warnings')
      .select(
        'id, level, kind, reason_text, region_1depth, region_2depth, jd_count, hidden_jd_titles, bump_date, suspended_until, is_permanent, created_at, acknowledged_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      // 테이블이 아직 없거나 RLS 오류 → 조용히 넘어감
      return [];
    }

    const all = (data ?? []) as (SpamWarning & { acknowledged_at: string | null })[];
    const history = all.map((w) => ({ level: w.level, kind: w.kind, created_at: w.created_at }));

    return all
      .filter((w) => w.acknowledged_at === null)
      .map((w) => (w.level >= 3 ? { ...w, history } : w));
  } catch {
    return [];
  }
};

export const UserProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [userType, setUserType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  // 미확인 경고 큐: 오래된 것부터 하나씩 보여줌
  const [warningQueue, setWarningQueue] = useState<SpamWarning[]>([]);

  useEffect(() => {
    if (auth?.user?.id) {
      setIsUserLoading(true);
      let cancelled = false;

      Promise.all([
        fetchUserProfile(auth.user.id),
        fetchUnacknowledgedWarnings(auth.user.id),
      ]).then(([profile, warnings]) => {
        if (cancelled) return;
        setIsUserLoading(false);
        setUserType(profile.userType);
        setUserId(profile.userId);
        // 경고를 먼저 처리한 뒤 승인 모달을 그 다음에 보임
        // (경고 큐가 비워지면 승인 모달이 자동으로 뜨도록 needsAcceptNotice를 별도 state로 관리)
        setWarningQueue(warnings);
        if (profile.needsAcceptNotice) {
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
      setWarningQueue([]);
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

  // 경고 확인: RPC 호출 후 큐에서 제거. 다음 경고가 있으면 자동으로 표시됨
  const handleWarningConfirm = async () => {
    const current = warningQueue[0];
    if (!current) return;

    // UI에서 먼저 큐에서 제거 (RPC 결과 기다리지 않음 → UX 지연 방지)
    setWarningQueue((prev) => prev.slice(1));

    try {
      const { error } = await supabase.rpc('acknowledge_warning', {
        p_warning_id: current.id,
      });
      if (error) {
        console.error('acknowledge_warning 오류:', error);
      }
    } catch (e) {
      console.error('acknowledge_warning 예외:', e);
    }
  };

  const value = {
    userType,
    userId,
    isUserLoading,
    refreshUser,
  };

  // 경고가 남아 있으면 경고 모달 우선. 경고 큐가 비워진 뒤에 승인 모달.
  const currentWarning = warningQueue[0] ?? null;
  const showWarningModal = currentWarning !== null;
  // 경고 모달이 열려 있는 동안은 승인 모달을 뒤에 대기
  const showApproveModal = !showWarningModal && showAcceptModal;

  return (
    <UserContext.Provider value={value}>
      {children}
      {showWarningModal && (
        <SpamWarningModal warning={currentWarning!} onConfirm={handleWarningConfirm} />
      )}
      {showApproveModal && <AcceptApprovedModal onClose={handleAcceptModalClose} />}
    </UserContext.Provider>
  );
};
