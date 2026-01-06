import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import styles from '@/styles/JobSeekerList.module.css';
import { format, parseISO } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobSeekerProfile {
  id: string;
  korean_name: string;
  english_name?: string;
  gender?: string;
  birth_year?: number;
  profile_image_url?: string;
  desired_jobs?: string[];
  nationality?: string;
  visa_status?: string;
  korean_ability?: string;
  preferred_regions?: string[];
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface JobSeekerListProps {
  filters?: {
    nationality?: string;
    visa_status?: string;
    region?: string;
  };
}

const JobSeekerList: React.FC<JobSeekerListProps> = ({ filters }) => {
  const [profiles, setProfiles] = useState<JobSeekerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchProfiles();
  }, [filters]);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('job_seeker_profiles')
        .select('*', { count: 'exact' })
        .eq('is_published', true)
        .order('updated_at', { ascending: false });

      // 필터 적용
      if (filters?.nationality) {
        query = query.eq('nationality', filters.nationality);
      }
      if (filters?.visa_status) {
        query = query.eq('visa_status', filters.visa_status);
      }
      if (filters?.region) {
        query = query.contains('preferred_regions', [filters.region]);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setProfiles(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthYear?: number) => {
    if (!birthYear) return null;
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear + 1; // 한국 나이
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MM.dd');
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.totalLabel}>전체</span>
        <span className={styles.totalCount}>총 {totalCount}명</span>
      </div>

      {profiles.length === 0 ? (
        <div className={styles.emptyState}>
          <p>등록된 이력서가 없습니다.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {profiles.map((profile) => (
            <li key={profile.id} className={styles.listItem}>
              <Link href={`/resume/${profile.id}`}>
                <div className={styles.card}>
                  <div className={styles.profileImage}>
                    {profile.profile_image_url ? (
                      <img src={profile.profile_image_url} alt={profile.korean_name} />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <span>{profile.korean_name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{profile.korean_name}</span>
                      {profile.gender && (
                        <span className={styles.gender}>
                          {profile.gender === '남성' ? '♂' : '♀'}
                        </span>
                      )}
                      {profile.birth_year && (
                        <span className={styles.age}>
                          {calculateAge(profile.birth_year)}세
                        </span>
                      )}
                    </div>
                    
                    <div className={styles.tags}>
                      {profile.nationality && (
                        <span className={styles.tag}>{profile.nationality}</span>
                      )}
                      {profile.visa_status && (
                        <span className={styles.tag}>{profile.visa_status}</span>
                      )}
                    </div>

                    {profile.desired_jobs && profile.desired_jobs.length > 0 && (
                      <div className={styles.desiredJobs}>
                        희망: {profile.desired_jobs.slice(0, 3).join(', ')}
                        {profile.desired_jobs.length > 3 && ' ...'}
                      </div>
                    )}

                    {profile.preferred_regions && profile.preferred_regions.length > 0 && (
                      <div className={styles.regions}>
                        📍 {profile.preferred_regions.slice(0, 2).join(', ')}
                        {profile.preferred_regions.length > 2 && ` 외 ${profile.preferred_regions.length - 2}곳`}
                      </div>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.views}>👁 {profile.view_count}</span>
                    <span className={styles.date}>{formatDate(profile.updated_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default JobSeekerList;




