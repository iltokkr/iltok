import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AdminUserDetailPanel from '@/components/AdminUserDetailPanel';
import styles from '@/styles/Admin.module.css';
import type {
  AdminSummary,
  AdminSpamReport,
  AdminUserRow,
  AdminUserDetail,
  NextAction,
  WarnReportRequest,
  DismissReportRequest,
  ManualWarningRequest,
  WarnResult,
  AdminApiError,
  ReportsResponse,
  UsersResponse,
} from '@/types/admin';

// 새 클라이언트를 만들지 않고 공용 인스턴스를 쓴다.
// supabase-js 는 인스턴스마다 같은 저장소 키에 락을 걸어서,
// 인스턴스가 늘어나면 getSession() 이 서로 기다리다 멈추는 일이 생긴다.
import supabase from '@/lib/supabase';
import {
  formatKST,
  formatDateShort,
  kindLabel,
  confidenceLabel,
  formatSanctionPreview,
} from '@/lib/adminFormat';


// ── 아이콘 (인라인 SVG) ──────────────────────────────────────
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconEmpty = () => (
  <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);

const IconWarn = () => (
  <svg className={styles.lowConfidenceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// ── 구분 신호 배지 ───────────────────────────────────────────
interface SignalProps {
  label: string;
  match: boolean;
}

const SignalBadge: React.FC<SignalProps> = ({ label, match }) => (
  <span className={`${styles.signalBadge} ${match ? styles.signalMatch : styles.signalDiff}`}>
    <span className={`${styles.signalDot} ${match ? styles.signalMatchDot : styles.signalDiffDot}`} />
    {match ? `${label} 동일` : `${label} 다름`}
  </span>
);

// ── 공고 비교 카드 ───────────────────────────────────────────
const PostColumn: React.FC<{ post: AdminSpamReport['posts'][number] }> = ({ post }) => (
  <div className={styles.postCol}>
    <div className={styles.postColHeader}>
      <p className={styles.postColTitle}>{post.title}</p>
      <div className={styles.postColMeta}>
        {post.updatedTime && (
          <span className={styles.postColMetaRow}>
            <span className={styles.postColMetaLabel}>등록</span>
            {formatDateShort(post.updatedTime)}
          </span>
        )}
        {post.salaryText && (
          <span className={styles.postColMetaRow}>
            <span className={styles.postColMetaLabel}>급여</span>
            {post.salaryText}
          </span>
        )}
        {post.worktimeText && (
          <span className={styles.postColMetaRow}>
            <span className={styles.postColMetaLabel}>근무</span>
            {post.worktimeText}
          </span>
        )}
        {post.contactPhone && (
          <span className={styles.postColMetaRow}>
            <span className={styles.postColMetaLabel}>연락처</span>
            {post.contactPhone}
          </span>
        )}
        {post.locationDetail && (
          <span className={styles.postColMetaRow}>
            <span className={styles.postColMetaLabel}>주소</span>
            {post.locationDetail}
          </span>
        )}
      </div>
    </div>
    <div className={styles.postSentences}>
      {post.sentences.map((s, i) => (
        <p
          key={i}
          className={`${styles.sentence} ${s.shared ? styles.sentenceShared : styles.sentenceUnique}`}
        >
          {s.text}
        </p>
      ))}
    </div>
  </div>
);

// ── 리포트 카드 ──────────────────────────────────────────────
interface ReportCardProps {
  report: AdminSpamReport;
  onWarn: (reportId: number) => void;
  onDismiss: (reportId: number) => void;
  onHide: (reportId: number) => void;
  processing: boolean;
}

const ReportCard: React.FC<ReportCardProps> = ({
  report,
  onWarn,
  onDismiss,
  onHide,
  processing,
}) => {
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [confirmingPermanent, setConfirmingPermanent] = useState(false);

  const visiblePosts = showAllPosts ? report.posts : report.posts.slice(0, 2);
  const hiddenCount = report.posts.length - 2;
  const isPermanent = report.nextAction === 'permanent';
  // 최근 24시간 안에 경고를 받았으면 또 주지 않는다.
  // 한 회원이 여러 묶음으로 잡히는 일이 흔한데, 묶음마다 누르면 하루 만에 영구 제한이 된다.
  const warnLocked = !!report.recentlyWarnedAt;

  const handleWarnClick = () => {
    if (isPermanent) {
      setConfirmingPermanent(true);
    } else {
      onWarn(report.id);
    }
  };

  return (
    <div className={styles.reportCard}>
      {/* 헤더 */}
      <div className={styles.reportCardHeader}>
        <div className={styles.reportMeta}>
          <div className={styles.reportNameRow}>
            <span className={styles.reportName}>{report.uploaderName}</span>
            <span className={`${styles.confidenceBadge} ${
              report.confidence === 'high'
                ? styles.confidenceHigh
                : report.confidence === 'medium'
                ? styles.confidenceMedium
                : styles.confidenceLow
            }`}>
              {confidenceLabel(report.confidence)}
            </span>
            <span className={`${styles.confidenceBadge} ${styles.confidenceLow}`}>
              {kindLabel(report.kind)}
            </span>
          </div>
          <div className={styles.reportSubRow}>
            <span className={styles.reportSubItem}>
              <span className={styles.reportSubLabel}>지역</span>
              {report.region}
            </span>
            <span className={styles.reportSubItem}>
              <span className={styles.reportSubLabel}>공고</span>
              {report.jdCount}건
            </span>
            <span className={styles.reportSubItem}>
              <span className={styles.reportSubLabel}>누적경고</span>
              {report.currentWarningCount}회
            </span>
            {report.firstPostedAt && report.lastPostedAt && (
              <span className={styles.reportSubItem}>
                <span className={styles.reportSubLabel}>기간</span>
                {formatDateShort(report.firstPostedAt)} ~ {formatDateShort(report.lastPostedAt)}
              </span>
            )}
            {report.uploaderPhone && (
              <span className={styles.reportSubItem}>
                <span className={styles.reportSubLabel}>연락처</span>
                {report.uploaderPhone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 구분 신호 배지 */}
      <div className={styles.signalBadges}>
        <SignalBadge label="연락처" match={report.sameContact} />
        <SignalBadge label="급여" match={report.sameSalary} />
        <SignalBadge label="근무시간" match={report.sameWorktime} />
        <SignalBadge label="상세주소" match={report.sameLocationDetail} />
      </div>

      {/* 유사도 + 확신도 낮음 안내 */}
      <div className={styles.reportInfoBar}>
        <span className={styles.similarityText}>
          본문 유사도{' '}
          <span className={styles.similarityValue}>
            {Math.round(report.contentSimilarity * 100)}%
          </span>
        </span>
        {report.confidence === 'low' && (
          <span className={styles.lowConfidenceNotice}>
            <IconWarn />
            연락처와 급여가 모두 달라 서로 다른 고객사 공고일 가능성이 높습니다.
          </span>
        )}
      </div>

      {/* 공고 본문 나란히 비교 */}
      <div className={styles.postsCompare}>
        <p className={styles.postsCompareTitle}>
          공고 본문 비교
          <span style={{ marginLeft: 6, color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 400 }}>
            빨강=공통 / 초록=고유
          </span>
        </p>
        <div className={styles.postsGrid}>
          {visiblePosts.map((post) => (
            <PostColumn key={post.id} post={post} />
          ))}
        </div>
        {!showAllPosts && hiddenCount > 0 && (
          <button
            className={styles.showMorePostsBtn}
            onClick={() => setShowAllPosts(true)}
          >
            나머지 {hiddenCount}건 보기
          </button>
        )}
      </div>

      {/* 같은 회원의 다른 묶음 안내 — 묶음마다 경고하면 하루 만에 영구 제한이 된다 */}
      {report.siblingPendingCount > 0 && !warnLocked && (
        <p className={styles.siblingNotice}>
          이 회원은 검토 대기에 <strong>{report.siblingPendingCount}묶음</strong>이 더 있습니다.
          경고는 한 번만 주고 나머지는 <strong>숨김만</strong>으로 처리하세요. 묶음마다 경고하면
          같은 행위로 회차가 연달아 올라갑니다.
        </p>
      )}

      {warnLocked ? (
        <p className={styles.warnLockedNotice}>
          이 회원은 최근 24시간 안에 경고를 받았습니다({formatKST(report.recentlyWarnedAt!)}).
          회차가 연달아 올라가지 않도록 경고 발송을 막아뒀습니다. 이 묶음은{' '}
          <strong>숨김만</strong>으로 처리하시거나, 내일 다시 경고하세요.
        </p>
      ) : (
        /* 발송 결과 미리보기 */
        <div className={styles.actionPreview}>
          <span className={styles.actionPreviewLabel}>경고 시</span>
          <span className={styles.actionPreviewText}>
            {formatSanctionPreview(report.nextLevel, report.nextAction, report.nextSuspendedUntil)}
          </span>
          {isPermanent && <span className={styles.actionPreviewBadge}>되돌리기 어려움</span>}
        </div>
      )}

      {/* 영구 제한 확인 단계 */}
      {confirmingPermanent && (
        <div className={styles.permanentConfirmBox}>
          <p className={styles.permanentConfirmTitle}>영구 제한 확인</p>
          <p className={styles.permanentConfirmDesc}>
            경고를 발송하면 이 회원이 <strong>영구 제한</strong>됩니다.
            그 회원의 모든 채용공고가 숨김 처리되며, 이 조치는 관리자가 직접
            DB를 수정하지 않는 한 되돌릴 수 없습니다. 계속하시겠습니까?
          </p>
          <div className={styles.permanentConfirmBtns}>
            <button
              className={styles.btnConfirmPermanent}
              onClick={() => { setConfirmingPermanent(false); onWarn(report.id); }}
              disabled={processing}
            >
              영구 제한 경고 발송
            </button>
            <button
              className={styles.btnCancelConfirm}
              onClick={() => setConfirmingPermanent(false)}
              disabled={processing}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 버튼 행 */}
      {!confirmingPermanent && (
        <div className={styles.reportActions}>
          <button
            className={styles.btnWarn}
            onClick={handleWarnClick}
            disabled={processing || warnLocked}
            title={warnLocked ? '최근 24시간 안에 경고를 받은 회원입니다' : undefined}
          >
            {processing ? '처리 중...' : '경고 발송'}
          </button>
          <button
            className={styles.btnHideOnly}
            onClick={() => onHide(report.id)}
            disabled={processing}
            title="경고 없이 이 묶음의 공고만 내립니다"
          >
            숨김만
          </button>
          <button
            className={styles.btnDismiss}
            onClick={() => onDismiss(report.id)}
            disabled={processing}
          >
            무시
          </button>
        </div>
      )}
    </div>
  );
};

// ── 메인 페이지 ──────────────────────────────────────────────
type Tab = 'reports' | 'users';

const AdminPage: React.FC = () => {
  const router = useRouter();

  // 관리자 검증. 'stalled' 는 세션 확인이 응답하지 않아 재시도가 필요한 상태
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'denied' | 'stalled'>('loading');
  const [authAttempt, setAuthAttempt] = useState(0);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 탭
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  // 요약
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // 검토 대기
  const [reports, setReports] = useState<AdminSpamReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // 회원 조회
  const [userQuery, setUserQuery] = useState('');
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userRows, setUserRows] = useState<AdminUserRow[]>([]);
  const [userSearched, setUserSearched] = useState(false);

  // 회원 상세
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // 수동 경고 폼
  const [selectedJdIds, setSelectedJdIds] = useState<number[]>([]);
  const [manualReason, setManualReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [manualProcessing, setManualProcessing] = useState(false);

  // 관리자 인증 확인
  //
  // AuthContext 의 isLoading 에 의존하지 않고 세션을 직접 읽는다.
  // 로그아웃 상태에서 isLoading 이 풀리지 않으면 이 화면이 "확인 중" 에서 멈춰버리기 때문이다.
  // getSession() 은 저장된 세션을 바로 돌려주므로 기다릴 일이 없다.
  useEffect(() => {
    let cancelled = false;

    const deny = () => {
      if (cancelled) return;
      setAuthState('denied');
      router.replace('/board');
    };

    const checkAdmin = async () => {
      try {
        // getSession() 이 락 경합으로 응답하지 않는 경우가 있어 시간 제한을 둔다.
        // 멈춘 채로 두면 화면이 "확인 중" 에서 영영 벗어나지 못한다.
        const session = await Promise.race([
          supabase.auth.getSession().then((r) => r.data.session),
          new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5000)),
        ]);

        if (cancelled) return;
        if (session === 'timeout') {
          setAuthState('stalled');
          return;
        }
        if (!session?.user) {
          deny();
          return;
        }
        if (cancelled) return;
        setAccessToken(session.access_token);

        const { data, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data?.is_admin) {
          deny();
          return;
        }
        setAuthState('ok');
      } catch {
        deny();
      }
    };

    checkAdmin();
    return () => {
      cancelled = true;
    };
    // 마운트 시, 그리고 사용자가 재시도를 누를 때만 확인한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authAttempt]);

  // API 공통 fetch 헬퍼
  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options?.headers ?? {}),
      };
      const res = await fetch(path, { ...options, headers });
      // API 라우트가 아직 없으면 Next.js 가 JSON 이 아닌 404 페이지를 돌려준다.
      // 그때 res.json() 이 파싱 오류를 던져 엉뚱한 문구가 보이는 것을 막는다.
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok) {
        const errMsg =
          (json as AdminApiError | null)?.error ??
          (res.status === 404 ? '기능이 아직 준비되지 않았습니다' : `요청에 실패했습니다 (${res.status})`);
        throw new Error(errMsg);
      }
      return json;
    },
    [accessToken]
  );

  // 요약 로드
  const loadSummary = useCallback(async () => {
    if (!accessToken) return;
    setSummaryLoading(true);
    try {
      const data = await apiFetch('/api/admin/summary');
      setSummary(data as AdminSummary);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '요약을 불러오지 못했습니다');
    } finally {
      setSummaryLoading(false);
    }
  }, [apiFetch, accessToken]);

  // 검토 대기 로드
  const loadReports = useCallback(async () => {
    if (!accessToken) return;
    setReportsLoading(true);
    try {
      const data = (await apiFetch('/api/admin/reports')) as ReportsResponse;
      setReports(data.reports ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '목록을 불러오지 못했습니다';
      // 404는 API 미구현 — 조용히 처리, 그 외 오류만 toast
      if (!msg.includes('404') && !msg.includes('NOT_FOUND')) {
        toast.error(msg);
      }
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, [apiFetch, accessToken]);

  useEffect(() => {
    if (authState === 'ok') {
      loadSummary();
      loadReports();
    }
  }, [authState, loadSummary, loadReports]);


  // 경고 발송
  const handleWarn = useCallback(
    async (reportId: number) => {
      setProcessingId(reportId);
      try {
        const body: WarnReportRequest = { reportId };
        const result = await apiFetch('/api/admin/reports/warn', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const r = result as WarnResult;
        const msg = r.isPermanent
          ? `경고 발송 완료 (${r.level}회차 · 영구 제한, 공고 ${r.hiddenJdCount}건 숨김)`
          : r.suspendedUntil
          ? `경고 발송 완료 (${r.level}회차 · 7일 제한)`
          : `경고 발송 완료 (${r.level}회차)`;
        toast.success(msg);
        await loadReports();
        await loadSummary();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : '경고 발송에 실패했습니다');
      } finally {
        setProcessingId(null);
      }
    },
    [apiFetch, loadReports, loadSummary]
  );

  // 무시
  const handleDismiss = useCallback(
    async (reportId: number) => {
      setProcessingId(reportId);
      try {
        const body: DismissReportRequest = { reportId };
        await apiFetch('/api/admin/reports/dismiss', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('무시 처리했습니다');
        await loadReports();
        await loadSummary();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : '무시 처리에 실패했습니다');
      } finally {
        setProcessingId(null);
      }
    },
    [apiFetch, loadReports, loadSummary]
  );

  // 경고 없이 공고만 숨김 — 같은 회원의 두 번째 이후 묶음을 처리할 때 쓴다
  const handleHide = useCallback(
    async (reportId: number) => {
      setProcessingId(reportId);
      try {
        const body: DismissReportRequest = { reportId };
        const result = (await apiFetch('/api/admin/reports/hide', {
          method: 'POST',
          body: JSON.stringify(body),
        })) as { hiddenCount: number };
        toast.success(`공고 ${result.hiddenCount}건을 숨겼습니다 (경고는 나가지 않았습니다)`);
        await loadReports();
        await loadSummary();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : '숨김 처리에 실패했습니다');
      } finally {
        setProcessingId(null);
      }
    },
    [apiFetch, loadReports, loadSummary]
  );

  // 회원 검색
  const handleUserSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      // 검색어가 비어 있어도 부른다 — 그때는 살펴볼 만한 회원 목록이 온다
      setUserSearchLoading(true);
      setUserSearched(true);
      setExpandedUserId(null);
      setUserDetail(null);
      try {
        const data = (await apiFetch(
          `/api/admin/users?q=${encodeURIComponent(userQuery.trim())}`
        )) as UsersResponse;
        setUserRows(data.users ?? []);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : '회원 검색에 실패했습니다');
        setUserRows([]);
      } finally {
        setUserSearchLoading(false);
      }
    },
    [apiFetch, userQuery]
  );

  // 회원 조회 탭을 처음 열면 검색어 없이 한 번 불러온다.
  // 빈 화면을 보여주면 무엇부터 봐야 할지 알 수 없어 페이지가 막다른 길이 된다.
  useEffect(() => {
    if (authState === 'ok' && activeTab === 'users' && !userSearched) {
      handleUserSearch();
    }
  }, [authState, activeTab, userSearched, handleUserSearch]);

  // 회원 상세 열기/닫기
  const handleToggleUser = useCallback(
    async (userId: string) => {
      if (expandedUserId === userId) {
        setExpandedUserId(null);
        setUserDetail(null);
        return;
      }
      setExpandedUserId(userId);
      setUserDetail(null);
      setUserDetailLoading(true);
      setSelectedJdIds([]);
      setManualReason('');
      setAdminNote('');
      try {
        const data = await apiFetch(`/api/admin/users/${userId}`);
        setUserDetail(data as AdminUserDetail);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : '회원 정보를 불러오지 못했습니다');
        setExpandedUserId(null);
      } finally {
        setUserDetailLoading(false);
      }
    },
    [apiFetch, expandedUserId]
  );

  // 공고 체크박스 토글
  const toggleJdSelection = (id: number) => {
    setSelectedJdIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 유사 묶음 전체 선택 — 이미 다 골라져 있으면 다시 눌러 해제한다
  const selectManyJds = (ids: number[]) => {
    setSelectedJdIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      return allSelected
        ? prev.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev, ...ids]));
    });
  };

  // 수동 경고 발송
  const handleManualWarn = useCallback(async () => {
    if (!userDetail) return;
    setManualProcessing(true);
    try {
      const body: ManualWarningRequest = {
        userId: userDetail.id,
        jdIds: selectedJdIds,
        reason: manualReason.trim() || undefined,
        adminNote: adminNote.trim() || undefined,
      };
      const result = await apiFetch('/api/admin/warnings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const r = result as WarnResult;
      const msg = r.isPermanent
        ? `수동 경고 완료 (${r.level}회차 · 영구 제한)`
        : `수동 경고 완료 (${r.level}회차)`;
      toast.success(msg);
      // 상세 갱신
      const updated = await apiFetch(`/api/admin/users/${userDetail.id}`);
      setUserDetail(updated as AdminUserDetail);
      setSelectedJdIds([]);
      setManualReason('');
      setAdminNote('');
      await loadSummary();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '경고 발송에 실패했습니다');
    } finally {
      setManualProcessing(false);
    }
  }, [apiFetch, userDetail, selectedJdIds, manualReason, adminNote, loadSummary]);

  // 로딩 화면
  if (authState === 'loading') {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.main}>
          <div className={styles.fullscreen}>
            <div className={styles.spinner} />
            <span>관리자 확인 중...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (authState === 'stalled') {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.main}>
          <div className={styles.fullscreen}>
            <span>로그인 정보를 확인하지 못했습니다.</span>
            <button
              className={styles.btnSearch}
              onClick={() => {
                setAuthState('loading');
                setAuthAttempt((n) => n + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (authState === 'denied') {
    return null;
  }

  return (
    <>
      <Head>
        <title>관리자 — 114114kr</title>
      </Head>
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <h1 className={styles.pageTitle}>관리자</h1>

          {/* 요약 카드 */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>검토 대기</span>
              <span className={`${styles.summaryValue} ${summaryLoading ? '' : styles.summaryValuePending}`}>
                {summaryLoading ? '—' : (summary?.pendingReports ?? reports.length)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>이번 달 경고</span>
              <span className={styles.summaryValue}>
                {summaryLoading ? '—' : (summary?.warningsThisMonth ?? '—')}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>정지 중</span>
              <span className={styles.summaryValue}>
                {summaryLoading ? '—' : (summary?.suspendedUsers ?? '—')}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>영구 제한</span>
              <span className={`${styles.summaryValue} ${summaryLoading ? '' : styles.summaryValueError}`}>
                {summaryLoading ? '—' : (summary?.permanentlyBlockedUsers ?? '—')}
              </span>
            </div>
          </div>

          {/* 탭 */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'reports' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              검토 대기
              {reports.length > 0 && (
                <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--color-error)' }}>
                  {reports.length}
                </span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('users')}
            >
              회원 조회
            </button>
          </div>

          {/* ── 검토 대기 탭 ── */}
          {activeTab === 'reports' && (
            <>
              {reportsLoading ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} />
                  <span>불러오는 중...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className={styles.emptyState}>
                  <IconEmpty />
                  <p className={styles.emptyTitle}>아직 감지된 도배 의심 공고가 없습니다</p>
                  <p className={styles.emptyDesc}>
                    자동 감지는 아직 켜지지 않았습니다. 지금은 이 목록이 늘 비어 있습니다.
                    <br />
                    도배를 발견하셨다면 <strong>회원 조회</strong> 탭에서 직접 경고를 보내세요.
                  </p>
                  <button
                    className={styles.btnSearch}
                    style={{ marginTop: 4 }}
                    onClick={() => setActiveTab('users')}
                  >
                    회원 조회로 이동
                  </button>
                </div>
              ) : (
                <div className={styles.reportList}>
                  {reports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onWarn={handleWarn}
                      onDismiss={handleDismiss}
                      onHide={handleHide}
                      processing={processingId === report.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 회원 조회 탭 ── */}
          {activeTab === 'users' && (
            <>
              <form className={styles.searchForm} onSubmit={handleUserSearch}>
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="이름 · 회사명 · 전화번호 · 아이디 · 이메일 (비우면 공고 많은 회원)"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                <button type="submit" className={styles.btnSearch} disabled={userSearchLoading}>
                  {userSearchLoading ? '검색 중...' : '검색'}
                </button>
              </form>

              {!userSearched || userSearchLoading ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} />
                  <span>검색 중...</span>
                </div>
              ) : userRows.length === 0 ? (
                <div className={styles.emptyState}>
                  <IconEmpty />
                  <p className={styles.emptyTitle}>
                    {userQuery.trim() ? '검색 결과가 없습니다' : '살펴볼 회원이 없습니다'}
                  </p>
                  {!userQuery.trim() && (
                    <p className={styles.emptyDesc}>
                      최근 90일 안에 공고를 2건 이상 올린 회원이 없습니다
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {!userQuery.trim() && (
                    <p className={styles.emptyDesc} style={{ margin: '0 0 12px' }}>
                      최근 90일 안에 공고를 많이 올린 회원과 경고 이력이 있는 회원입니다.
                      도배가 의심되면 눌러서 공고를 확인하세요.
                    </p>
                  )}
                  <table className={styles.userTable}>
                    <thead>
                      <tr>
                        <th>이름/회사명</th>
                        <th className={styles.hideOnMobile}>연락처</th>
                        <th className={styles.hideOnMobile}>이메일</th>
                        <th>경고</th>
                        <th>상태</th>
                        <th>공고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userRows.map((row) => (
                        <React.Fragment key={row.id}>
                          <tr
                            className={`${styles.userTableRow} ${
                              expandedUserId === row.id ? styles.userTableRowActive : ''
                            }`}
                            onClick={() => handleToggleUser(row.id)}
                          >
                            <td style={{ fontWeight: 600 }}>{row.displayName}</td>
                            <td className={styles.hideOnMobile}>{row.phone ?? '—'}</td>
                            <td className={styles.hideOnMobile}>{row.email ?? '—'}</td>
                            <td>{row.warningCount}회</td>
                            <td>
                              {row.isPermanentlyBlocked ? (
                                <span className={`${styles.userStatusBadge} ${styles.statusPermanent}`}>영구 제한</span>
                              ) : row.suspendedUntil ? (
                                <span className={`${styles.userStatusBadge} ${styles.statusSuspended}`}>정지 중</span>
                              ) : (
                                <span className={`${styles.userStatusBadge} ${styles.statusNormal}`}>정상</span>
                              )}
                            </td>
                            <td>{row.activePostCount}건</td>
                          </tr>
                          {/* 누른 행 바로 아래에 펼친다 — 목록이 길어도 눈이 따라가기 쉽다 */}
                          {expandedUserId === row.id && (
                            <tr>
                              <td colSpan={6} className={styles.userDetailCell}>
                                <AdminUserDetailPanel
                                  detail={userDetail}
                                  loading={userDetailLoading}
                                  selectedJdIds={selectedJdIds}
                                  onToggleJd={toggleJdSelection}
                                  onSelectMany={selectManyJds}
                                  reason={manualReason}
                                  onReasonChange={setManualReason}
                                  adminNote={adminNote}
                                  onAdminNoteChange={setAdminNote}
                                  processing={manualProcessing}
                                  onWarn={handleManualWarn}
                                  onClose={() => {
                                    setExpandedUserId(null);
                                    setUserDetail(null);
                                  }}
                                  fallbackName={row.displayName}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>

                </>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default AdminPage;
