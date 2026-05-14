import Head from 'next/head';
import React, { useMemo } from 'react';
import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import { FaRegEye, FaLock } from 'react-icons/fa';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MainMenu from '@/components/MainMenu';
import styles from '@/styles/Analytics.module.css';
import { format, parseISO, subHours } from 'date-fns';

interface JdInfo {
  id: number;
  title: string;
  view_count: number;
  ad: boolean;
  ad_auto: boolean;
  ad_since: string | null;
  ad_until: string | null;
}

interface ViewLogRow {
  id: number;
  viewed_at: string;
  viewer_user_id: string | null;
  session_id: string;
  source: string | null;
  dwell_ms: number | null;
}

interface ProfileRow {
  user_id: string;
  nationality: string | null;
  visa_status: string | null;
  gender: string | null;
}

interface PageProps {
  ok: boolean;
  reason?: 'not-found' | 'invalid-token';
  preview?: boolean;
  jd?: JdInfo;
  logs?: ViewLogRow[];
  applicantCount?: number;
  commentCount?: number;
  viewerProfiles?: ProfileRow[];
  applicantProfiles?: ProfileRow[];
}

const SOURCE_LABEL: Record<string, string> = {
  board: '게시판',
  home: '메인',
  internal: '사이트 내부',
  external: '외부 사이트',
  direct: '직접 접속',
  search: '검색',
  category: '카테고리',
};

const K_ANONYMITY_THRESHOLD = 5;

function aggregateBucket(values: (string | null | undefined)[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = (v ?? '').trim() || '미상';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const entries = Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  const big = entries.filter(e => e.count >= K_ANONYMITY_THRESHOLD);
  const small = entries.filter(e => e.count < K_ANONYMITY_THRESHOLD);
  const otherCount = small.reduce((s, e) => s + e.count, 0);
  big.sort((a, b) => b.count - a.count);
  if (otherCount > 0) big.push({ label: '기타', count: otherCount });
  return big;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async ({ params, query }) => {
  const postId = Number(params?.postId);
  const token = typeof query.t === 'string' ? query.t : '';
  const isPreview = query.preview === '1';

  if (!Number.isFinite(postId)) {
    return { props: { ok: false, reason: 'not-found' } };
  }

  // 미리보기 모드: 토큰/DB 검증 없이 빈 템플릿만 렌더 (레이아웃 확인용)
  if (isPreview) {
    return {
      props: {
        ok: true,
        preview: true,
        jd: {
          id: postId,
          title: `[미리보기] 게시물 #${postId}`,
          view_count: 0,
          ad: false,
          ad_auto: false,
          ad_since: null,
          ad_until: null,
        },
        logs: [],
        applicantCount: 0,
        commentCount: 0,
        viewerProfiles: [],
        applicantProfiles: [],
      },
    };
  }

  if (!token) {
    return { props: { ok: false, reason: 'invalid-token' } };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { props: { ok: false, reason: 'invalid-token' } };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: jdData, error: jdErr } = await supabase
    .from('jd')
    .select('id, title, view_count, ad, ad_auto, ad_since, ad_until, analytics_token')
    .eq('id', postId)
    .single();

  if (jdErr || !jdData) {
    return { props: { ok: false, reason: 'not-found' } };
  }
  if (!jdData.analytics_token || jdData.analytics_token !== token) {
    return { props: { ok: false, reason: 'invalid-token' } };
  }

  const [logsRes, appRes, comRes] = await Promise.all([
    supabase
      .from('jd_view_log')
      .select('id, viewed_at, viewer_user_id, session_id, source, dwell_ms')
      .eq('jd_id', postId)
      .order('viewed_at', { ascending: false })
      .limit(5000),
    supabase
      .from('job_application')
      .select('user_id', { count: 'exact' })
      .eq('jd_id', postId),
    supabase
      .from('comment')
      .select('id', { count: 'exact', head: true })
      .eq('jd_id', postId),
  ]);

  const logs = (logsRes.data || []) as ViewLogRow[];
  const applicantCount = appRes.count ?? 0;
  const commentCount = comRes.count ?? 0;

  const viewerIds = Array.from(new Set(logs.map(l => l.viewer_user_id).filter(Boolean))) as string[];
  const applicantIds = Array.from(new Set((appRes.data || []).map(a => (a as { user_id: string }).user_id)));

  const allIds = Array.from(new Set([...viewerIds, ...applicantIds]));
  let profiles: ProfileRow[] = [];
  if (allIds.length > 0) {
    const { data: profData } = await supabase
      .from('job_seeker_profiles')
      .select('user_id, nationality, visa_status, gender')
      .in('user_id', allIds);
    profiles = (profData || []) as ProfileRow[];
  }
  const profMap = new Map(profiles.map(p => [p.user_id, p]));
  const viewerProfiles = viewerIds.map(uid => profMap.get(uid)).filter(Boolean) as ProfileRow[];
  const applicantProfiles = applicantIds.map(uid => profMap.get(uid)).filter(Boolean) as ProfileRow[];

  const jd: JdInfo = {
    id: jdData.id,
    title: jdData.title,
    view_count: jdData.view_count ?? 0,
    ad: !!jdData.ad,
    ad_auto: !!jdData.ad_auto,
    ad_since: jdData.ad_since,
    ad_until: jdData.ad_until,
  };

  return {
    props: {
      ok: true,
      jd,
      logs,
      applicantCount,
      commentCount,
      viewerProfiles,
      applicantProfiles,
    },
  };
};

const AnalyticsPage: React.FC<PageProps> = (props) => {
  const { ok, reason, preview, jd, logs = [], applicantCount = 0, commentCount = 0, viewerProfiles = [], applicantProfiles = [] } = props;

  const stats = useMemo(() => {
    const uniqueSessions = new Set(logs.map(l => l.session_id)).size;
    const loggedInViews = logs.filter(l => l.viewer_user_id).length;
    const dwellSamples = logs
      .map(l => l.dwell_ms)
      .filter((v): v is number => typeof v === 'number' && v > 0 && v < 30 * 60 * 1000);
    const avgDwellSec = dwellSamples.length
      ? Math.round(dwellSamples.reduce((s, v) => s + v, 0) / dwellSamples.length / 1000)
      : 0;
    const ctrApplicants = uniqueSessions > 0 ? (applicantCount / uniqueSessions) * 100 : 0;
    return { uniqueSessions, loggedInViews, avgDwellSec, ctrApplicants };
  }, [logs, applicantCount]);

  const dailySeries = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets: { label: string; count: number; dateKey: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push({
        label: format(d, 'MM/dd'),
        count: 0,
        dateKey: format(d, 'yyyy-MM-dd'),
      });
    }
    const map = new Map(buckets.map(b => [b.dateKey, b]));
    for (const l of logs) {
      const d = parseISO(l.viewed_at);
      const key = format(d, 'yyyy-MM-dd');
      const b = map.get(key);
      if (b) b.count += 1;
    }
    return buckets;
  }, [logs]);

  const hourlySeries = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const l of logs) {
      const d = parseISO(l.viewed_at);
      buckets[d.getHours()].count += 1;
    }
    return buckets;
  }, [logs]);

  const sourceDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs) {
      const k = l.source || 'direct';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([k, v]) => ({ label: SOURCE_LABEL[k] ?? k, count: v }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  const viewerNationality = useMemo(() => aggregateBucket(viewerProfiles.map(p => p.nationality)), [viewerProfiles]);
  const viewerVisa = useMemo(() => aggregateBucket(viewerProfiles.map(p => p.visa_status)), [viewerProfiles]);
  const viewerGender = useMemo(() => aggregateBucket(viewerProfiles.map(p => p.gender)), [viewerProfiles]);
  const applicantNationality = useMemo(() => aggregateBucket(applicantProfiles.map(p => p.nationality)), [applicantProfiles]);
  const applicantVisa = useMemo(() => aggregateBucket(applicantProfiles.map(p => p.visa_status)), [applicantProfiles]);

  const dataSinceText = useMemo(() => {
    if (logs.length === 0) return null;
    const earliest = logs.reduce((min, l) => (l.viewed_at < min ? l.viewed_at : min), logs[0].viewed_at);
    const days = Math.max(1, Math.floor((Date.now() - parseISO(earliest).getTime()) / (1000 * 60 * 60 * 24)));
    return `데이터 수집 시작: ${format(subHours(parseISO(earliest), 9), 'yyyy년 MM월 dd일')} (D+${days})`;
  }, [logs]);

  if (!ok || !jd) {
    return (
      <div className={styles.container}>
        <Head>
          <title>광고 성과 분석 | 114114KR</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <Header />
        <MainMenu />
        <main className={styles.main}>
          <div className={styles.forbidden}>
            <h2>접근할 수 없습니다</h2>
            <p>
              {reason === 'not-found'
                ? '존재하지 않는 채용공고입니다.'
                : '유효하지 않은 링크입니다. 운영자에게 다시 문의해주세요.'}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const maxDaily = Math.max(1, ...dailySeries.map(d => d.count));
  const maxHourly = Math.max(1, ...hourlySeries.map(h => h.count));
  const maxSource = Math.max(1, ...sourceDist.map(s => s.count));

  return (
    <div className={styles.container}>
      <Head>
        <title>광고 성과 분석 - {jd.title} | 114114KR</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Header />
      <MainMenu />
      <main className={styles.main}>
        <div className={styles.header}>
          {preview && (
            <p className={styles.previewBadge}>
              <FaRegEye className={styles.previewIcon} aria-hidden />
              미리보기 모드 — 실제 데이터 없이 레이아웃만 표시됩니다
            </p>
          )}
          <h1 className={styles.title}>광고 성과 분석</h1>
          <p className={styles.subtitle}>{jd.title}</p>
          {jd.ad && !jd.ad_auto && jd.ad_since && jd.ad_until && (
            <p className={styles.adPeriod}>
              프리미엄 게재 {format(parseISO(jd.ad_since), 'yy.MM.dd')} ~ {format(parseISO(jd.ad_until), 'yy.MM.dd')}
            </p>
          )}
          {dataSinceText && <p className={styles.dataSince}>{dataSinceText}</p>}
        </div>

        <section className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>누적 조회수</div>
            <div className={styles.cardValue}>{jd.view_count.toLocaleString()}</div>
            <div className={styles.cardSub}>전체 페이지뷰</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>고유 방문자</div>
            <div className={styles.cardValue}>{stats.uniqueSessions.toLocaleString()}</div>
            <div className={styles.cardSub}>세션 기준 (수집기간)</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>지원자 수</div>
            <div className={styles.cardValue}>{applicantCount.toLocaleString()}</div>
            <div className={styles.cardSub}>지원전환율 {stats.ctrApplicants.toFixed(1)}%</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>댓글 수</div>
            <div className={styles.cardValue}>{commentCount.toLocaleString()}</div>
            <div className={styles.cardSub}>문의/관심도</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>평균 체류시간</div>
            <div className={styles.cardValue}>{stats.avgDwellSec}초</div>
            <div className={styles.cardSub}>공고 정독 정도</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>로그인 조회</div>
            <div className={styles.cardValue}>{stats.loggedInViews.toLocaleString()}</div>
            <div className={styles.cardSub}>식별 가능 회원</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>일자별 조회수 (최근 14일)</h2>
          {logs.length === 0 ? (
            <p className={styles.emptyHint}>아직 수집된 데이터가 없습니다. 공고가 조회되면 자동으로 채워집니다.</p>
          ) : (
            <div className={styles.barChart}>
              {dailySeries.map(d => (
                <div key={d.dateKey} className={styles.barCol}>
                  <div className={styles.barWrap}>
                    <div
                      className={styles.bar}
                      style={{ height: `${(d.count / maxDaily) * 100}%` }}
                      title={`${d.label}: ${d.count}회`}
                    />
                    {d.count > 0 && <span className={styles.barValue}>{d.count}</span>}
                  </div>
                  <div className={styles.barLabel}>{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>시간대별 조회수</h2>
          {logs.length === 0 ? (
            <p className={styles.emptyHint}>아직 수집된 데이터가 없습니다.</p>
          ) : (
            <div className={styles.hourChart}>
              {hourlySeries.map(h => (
                <div key={h.hour} className={styles.hourCol}>
                  <div className={styles.hourBarWrap}>
                    <div
                      className={styles.hourBar}
                      style={{ height: `${(h.count / maxHourly) * 100}%` }}
                      title={`${h.hour}시: ${h.count}회`}
                    />
                  </div>
                  <div className={styles.hourLabel}>{h.hour}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>유입 경로</h2>
          {sourceDist.length === 0 ? (
            <p className={styles.emptyHint}>아직 수집된 데이터가 없습니다.</p>
          ) : (
            <div className={styles.distList}>
              {sourceDist.map(s => (
                <div key={s.label} className={styles.distRow}>
                  <span className={styles.distLabel}>{s.label}</span>
                  <div className={styles.distBarWrap}>
                    <div
                      className={styles.distBar}
                      style={{ width: `${(s.count / maxSource) * 100}%` }}
                    />
                  </div>
                  <span className={styles.distCount}>{s.count}회</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>조회자 분포 (로그인 회원 기준 · 익명 집계)</h2>
          <p className={styles.privacyNote}>
            <FaLock className={styles.privacyIcon} aria-hidden />
            개인정보 보호를 위해 인원수 5명 미만 항목은 '기타'로 묶어 표시합니다.
          </p>
          <div className={styles.distGrid}>
            <DistBlock title="국적" data={viewerNationality} empty="아직 수집된 데이터가 없습니다." />
            <DistBlock title="비자" data={viewerVisa} empty="아직 수집된 데이터가 없습니다." />
            <DistBlock title="성별" data={viewerGender} empty="아직 수집된 데이터가 없습니다." />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>지원자 분포 (익명 집계)</h2>
          <div className={styles.distGrid}>
            <DistBlock title="국적" data={applicantNationality} empty="아직 지원자가 없습니다." />
            <DistBlock title="비자" data={applicantVisa} empty="아직 지원자가 없습니다." />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const DistBlock: React.FC<{ title: string; data: { label: string; count: number }[]; empty: string }> = ({ title, data, empty }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className={styles.distBlock}>
      <h3 className={styles.distTitle}>{title}</h3>
      {data.length === 0 || total === 0 ? (
        <p className={styles.emptyHint}>{empty}</p>
      ) : (
        <ul className={styles.distMini}>
          {data.map(d => {
            const pct = (d.count / total) * 100;
            return (
              <li key={d.label} className={styles.distMiniRow}>
                <span className={styles.distMiniLabel}>{d.label}</span>
                <div className={styles.distMiniBarWrap}>
                  <div className={styles.distMiniBar} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.distMiniCount}>{pct.toFixed(0)}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AnalyticsPage;
