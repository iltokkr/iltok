// 관리자 도배 검토 화면 ↔ API 공유 계약
//
// 이 파일이 유일한 기준이다. API 라우트(src/pages/api/admin/**)와
// 화면(src/pages/admin/**)은 양쪽 다 여기 정의된 모양만 주고받는다.
//
// 설계 문서: docs/superpowers/specs/2026-07-31-spam-warning-system-design.md (8절)

/** 도배 후보 종류. 'manual' 은 운영자가 직접 지정한 경고 */
export type SpamKind = 'duplicate_posting' | 'bump_abuse' | 'manual';

/** 구분 신호가 몇 개나 일치하는지에 따른 확신도 */
export type SpamConfidence = 'high' | 'medium' | 'low';

/** 'hidden' = 경고 없이 공고만 내린 상태 */
export type SpamReportStatus = 'pending' | 'warned' | 'dismissed' | 'hidden';

/** 경고 발송 시 그 회원에게 실제로 적용될 제재 */
export type NextAction = 'warn_only' | 'suspend_7d' | 'permanent';

/** 후보 카드에 나란히 놓고 비교할 공고 하나 */
export interface AdminReportPost {
  id: number;
  title: string;
  /** 등록·수정·끌어올리기 시각 (ISO) */
  updatedTime: string | null;
  /** "시급 11,000" 처럼 이미 사람이 읽을 수 있게 만든 문자열 */
  salaryText: string | null;
  /** "08:00~17:00" */
  worktimeText: string | null;
  contactPhone: string | null;
  locationDetail: string | null;
  /**
   * 본문을 문장 단위로 쪼갠 것. shared=true 면 묶음 안 다른 공고에도 있는 문장이다.
   * 화면에서 shared 여부에 따라 배경색을 달리해 "어디가 같고 어디가 다른지"를 바로 보여준다.
   */
  sentences: { text: string; shared: boolean }[];
}

/** 검토 대기 후보 한 건 */
export interface AdminSpamReport {
  id: number;
  kind: SpamKind;
  status: SpamReportStatus;
  createdAt: string;

  uploaderId: string;
  /** 회사명 또는 이름. 없으면 아이디/이메일 */
  uploaderName: string;
  uploaderPhone: string | null;

  region: string;              // "경기 수원시"
  jdCount: number;
  /** 0.000 ~ 1.000 */
  contentSimilarity: number;
  confidence: SpamConfidence;

  sameContact: boolean;
  sameSalary: boolean;
  sameWorktime: boolean;
  sameLocationDetail: boolean;

  /** kind='bump_abuse' 일 때만 (YYYY-MM-DD, KST) */
  bumpDate: string | null;

  /** 등록 기간 표시용 */
  firstPostedAt: string | null;
  lastPostedAt: string | null;

  /** 이 회원의 현재 누적 경고 횟수 */
  currentWarningCount: number;
  /**
   * 이 회원이 최근 24시간 안에 받은 경고 시각. 있으면 경고 발송이 막힌다.
   * 한 회원이 여러 묶음으로 잡혔을 때 묶음마다 경고를 눌러 하루 만에
   * 영구 제한이 되는 것을 막기 위한 것이다. 남은 묶음은 숨김만 처리한다.
   */
  recentlyWarnedAt: string | null;
  /** 같은 회원의 다른 검토 대기 묶음 수 (자기 자신 제외) */
  siblingPendingCount: number;
  /** 경고를 발송하면 몇 회차가 되는지 */
  nextLevel: number;
  /** 그때 적용될 제재 */
  nextAction: NextAction;
  /** nextAction='suspend_7d' 일 때 예상 해제 일시 (ISO) */
  nextSuspendedUntil: string | null;

  posts: AdminReportPost[];
}

export interface AdminSummary {
  pendingReports: number;
  warningsThisMonth: number;
  suspendedUsers: number;
  permanentlyBlockedUsers: number;
}

/** 회원 검색 결과 한 줄 */
export interface AdminUserRow {
  id: string;
  displayName: string;
  userType: string | null;
  phone: string | null;
  email: string | null;
  warningCount: number;
  suspendedUntil: string | null;
  isPermanentlyBlocked: boolean;
  /** 숨김 처리되지 않은 채용공고 수 */
  activePostCount: number;
}

/** 회원 상세 — 수동 경고를 보내기 위한 화면 */
export interface AdminUserDetail extends AdminUserRow {
  warnings: {
    id: number;
    level: number;
    kind: SpamKind;
    region: string | null;
    jdCount: number | null;
    hiddenJdTitles: string[] | null;
    suspendedUntil: string | null;
    isPermanent: boolean;
    /** 사용자 팝업에 보인 사유 */
    reasonText: string | null;
    /** 운영자만 보는 메모 */
    adminNote: string | null;
    createdAt: string;
    acknowledgedAt: string | null;
  }[];
  /** 숨김 처리되지 않은 채용공고. 수동 경고 시 여기서 골라 숨긴다 */
  posts: {
    id: number;
    title: string;
    region: string;
    updatedTime: string | null;
    salaryText: string | null;
    worktimeText: string | null;
    contactPhone: string | null;
    locationDetail: string | null;
    /** 본문 평문. 화면에서 고른 공고끼리 문장을 대조하는 데 쓴다 */
    contents: string;
    /**
     * 같은 지역 + 내용이 비슷한 공고끼리 묶은 번호. 2건 이상 묶인 것만 값이 있다.
     * 제목만 봐서는 중복인지 알 수 없으므로 화면이 이 번호로 후보를 먼저 짚어준다.
     */
    similarGroup: number | null;
  }[];
  nextLevel: number;
  nextAction: NextAction;
  nextSuspendedUntil: string | null;
}

// ── 요청 본문 ────────────────────────────────────────────────

export interface WarnReportRequest {
  reportId: number;
  /** 운영 메모. 사용자 팝업에는 보이지 않는다 */
  adminNote?: string;
}

export interface DismissReportRequest {
  reportId: number;
}

/** 자동 감지에 걸리지 않은 도배를 운영자가 직접 처리할 때 */
export interface ManualWarningRequest {
  userId: string;
  /** 숨길 공고. 여기 고른 공고는 전부 숨겨진다 (영구 제한이면 전체 공고가 숨겨짐) */
  jdIds: number[];
  /** 사용자 팝업에 그대로 보이는 사유 문구. 비우면 기본 문구가 나간다 */
  reason?: string;
  /** 운영 메모 */
  adminNote?: string;
}

// ── 응답 봉투 ────────────────────────────────────────────────

/** 실패 시 { error } 만 온다. 성공 시 각 필드가 채워진다 */
export interface AdminApiError {
  error: string;
}

/**
 * 목록 응답은 배열을 그대로 내려보내지 않고 반드시 이름 붙은 객체로 감싼다.
 * 나중에 페이지네이션 같은 필드를 붙일 때 응답 모양을 안 바꿔도 되기 때문이다.
 */
export interface ReportsResponse {
  reports: AdminSpamReport[];
}

export interface UsersResponse {
  users: AdminUserRow[];
}

export interface OkResponse {
  ok: true;
}

export interface WarnResult {
  warningId: number;
  level: number;
  suspendedUntil: string | null;
  isPermanent: boolean;
  hiddenJdCount: number;
}
