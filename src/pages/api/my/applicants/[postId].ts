import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';

// .env.local 명시적 로드 (Next.js env 미적용 시 대비)
function ensureEnvLoaded() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envPath = path.join(process.cwd(), '.env.local');
  loadEnv({ path: envPath, override: true });
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/);
      if (m) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = m[1].trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  } catch {
    /* ignore */
  }
}

const calcAge = (y?: number, m?: number, d?: number): number | null => {
  if (!y) return null;
  const today = new Date();
  const birth = new Date(y, (m || 1) - 1, d || 1);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};

const formatPhone = (n?: string) => {
  if (!n) return '-';
  const cleaned = n.replace(/\D/g, '');
  if (cleaned.startsWith('82') && cleaned.length >= 11) return `0${cleaned.slice(2)}`;
  return n;
};

/**
 * 공고 소유자만 자기 공고의 지원자 명단(이름·전화·프로필)을 조회한다.
 * 과거에는 클라이언트가 anon 키로 users(name, number)를 직접 조회해
 * F12 콘솔에서 전 회원 연락처를 덤프할 수 있었다. 이제 서버에서
 * (1) 토큰 검증 → uid, (2) 공고 uploader_id === uid 확인 후에만 반환한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const postIdNum = Number(req.query.postId);
  if (!Number.isFinite(postIdNum)) {
    return res.status(400).json({ error: '잘못된 공고입니다.' });
  }

  ensureEnvLoaded();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Config error' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user) {
    return res.status(401).json({ error: '인증에 실패했습니다.' });
  }
  const uid = authData.user.id;

  try {
    const { data: post, error: postErr } = await supabase
      .from('jd')
      .select('id, title, 1depth_region, 2depth_region, uploader_id')
      .eq('id', postIdNum)
      .single();

    if (postErr || !post) {
      return res.status(404).json({ error: '공고를 찾을 수 없습니다.' });
    }
    if (post.uploader_id !== uid) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const { data: applicationData } = await supabase
      .from('job_application')
      .select('users_id')
      .eq('jd_id', postIdNum);

    const userIds = (applicationData || []).map((a: { users_id: string }) => a.users_id);
    if (userIds.length === 0) {
      return res.status(200).json({ post, applicants: [] });
    }

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, number')
      .in('id', userIds);
    const userMap = new Map(
      (usersData || []).map((u: { id: string; name: string | null; number: string | null }) => [
        u.id,
        { name: u.name || '-', number: u.number || '' },
      ])
    );

    const profileMap = new Map<
      string,
      {
        korean_name: string;
        id: string;
        gender?: string;
        birth_year?: number;
        birth_month?: number;
        birth_day?: number;
        nationality?: string;
        visa_status?: string;
        preferred_regions?: string[];
      }
    >();
    try {
      const { data: profilesData } = await supabase
        .from('job_seeker_profiles')
        .select('user_id, korean_name, id, gender, birth_year, birth_month, birth_day, nationality, visa_status, preferred_regions')
        .in('user_id', userIds);
      for (const p of profilesData || []) {
        let regions: string[] = [];
        if (p.preferred_regions) {
          try {
            regions = typeof p.preferred_regions === 'string'
              ? JSON.parse(p.preferred_regions)
              : (p.preferred_regions as string[]);
          } catch {
            regions = [];
          }
        }
        profileMap.set(p.user_id, {
          korean_name: p.korean_name || '',
          id: p.id,
          gender: p.gender || '',
          birth_year: p.birth_year,
          birth_month: p.birth_month,
          birth_day: p.birth_day,
          nationality: p.nationality || '',
          visa_status: p.visa_status || '',
          preferred_regions: Array.isArray(regions) ? regions : [],
        });
      }
    } catch {
      // job_seeker_profiles 테이블이 없을 수 있음
    }

    const applicants = userIds.map((id: string) => {
      const profile = profileMap.get(id);
      const user = userMap.get(id);
      const regions = profile?.preferred_regions;
      const regionStr = Array.isArray(regions) && regions.length > 0 ? regions.join(', ') : '-';
      return {
        users_id: id,
        name: user?.name,
        korean_name: profile?.korean_name,
        profile_id: profile?.id,
        gender: profile?.gender || '-',
        age: calcAge(profile?.birth_year, profile?.birth_month, profile?.birth_day),
        nationality: profile?.nationality || '-',
        visa_status: profile?.visa_status || '-',
        phone: formatPhone(user?.number),
        preferred_regions: regionStr,
      };
    });

    return res.status(200).json({ post, applicants });
  } catch (err) {
    console.error('applicants API error:', err);
    return res.status(500).json({ error: '데이터를 불러오는데 실패했습니다.' });
  }
}
