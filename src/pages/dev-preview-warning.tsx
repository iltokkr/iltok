// 도배 경고 팝업 시안 확인용 페이지 (개발 환경 전용)
//   http://localhost:3001/dev-preview-warning?level=1  1차 경고
//   http://localhost:3001/dev-preview-warning?level=2  2차 · 7일 제한
//   http://localhost:3001/dev-preview-warning?level=3  3차 · 영구 제한
// 운영 배포에서는 404 로 막힌다.
import React from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import SpamWarningModal, { SpamWarning } from '@/components/SpamWarningModal';

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
};

const samples: Record<string, SpamWarning> = {
  '1': {
    id: 1,
    level: 1,
    kind: 'duplicate_posting',
    region_1depth: '경기',
    region_2depth: '수원시',
    jd_count: 4,
    hidden_jd_titles: [
      '수원 생산직 주간 모집합니다',
      '[수원] 생산직 주간근무자 구합니다',
      '수원시 주간 생산직 채용',
    ],
    bump_date: null,
    suspended_until: null,
    is_permanent: false,
    created_at: '2026-07-31T06:00:00Z',
  },
  '2': {
    id: 2,
    level: 2,
    kind: 'bump_abuse',
    region_1depth: '경기',
    region_2depth: '수원시',
    jd_count: 5,
    hidden_jd_titles: null,
    bump_date: '2026-08-01',
    suspended_until: '2026-08-07T06:20:00Z',
    is_permanent: false,
    created_at: '2026-07-31T06:00:00Z',
  },
  '3': {
    id: 3,
    level: 3,
    kind: 'duplicate_posting',
    region_1depth: '경기',
    region_2depth: '수원시',
    jd_count: 6,
    // 영구 제한은 남기는 공고 없이 6건 전부 숨김 → 3건만 보이고 "외 3건"
    hidden_jd_titles: [
      '수원 생산직 급구',
      '수원 생산직 모집',
      '수원 주간 생산직',
      '[수원] 주간 생산직 채용',
      '수원시 생산직 대량모집',
      '수원 공장 생산직 구합니다',
    ],
    bump_date: null,
    suspended_until: null,
    is_permanent: true,
    created_at: '2026-07-31T06:00:00Z',
    history: [
      { level: 1, kind: 'duplicate_posting', created_at: '2026-06-03T01:00:00Z' },
      { level: 2, kind: 'bump_abuse', created_at: '2026-07-12T02:00:00Z' },
      { level: 3, kind: 'duplicate_posting', created_at: '2026-07-31T06:00:00Z' },
    ],
  },
};

export default function DevPreviewWarning() {
  const router = useRouter();
  const level = (router.query.level as string) || '1';
  return <SpamWarningModal warning={samples[level] ?? samples['1']} onConfirm={() => {}} />;
}
