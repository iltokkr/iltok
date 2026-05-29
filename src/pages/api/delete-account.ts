import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';

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
  } catch { /* ignore */ }
}

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  ensureEnvLoaded();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Config error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: '인증에 실패했습니다.' });
  }

  const uid = userData.user.id;

  try {
    // 1) 본인이 작성한 댓글 (다른 공고에 단 댓글 포함)
    await supabaseAdmin.from('comment').delete().eq('user_id', uid);

    // 2) 본인이 보낸 지원 내역
    await supabaseAdmin.from('job_application').delete().eq('users_id', uid);

    // 3) 구직자 프로필
    await supabaseAdmin.from('job_seeker_profiles').delete().eq('user_id', uid);

    // 4) 본인이 작성한 공고에 달린 댓글 (jd CASCADE 보장 없으므로 명시 삭제)
    const { data: myPosts } = await supabaseAdmin
      .from('jd')
      .select('id')
      .eq('uploader_id', uid);
    const postIds = (myPosts || []).map((p: { id: number }) => p.id);
    if (postIds.length > 0) {
      await supabaseAdmin.from('comment').delete().in('jd_id', postIds);
    }

    // 5) 본인이 작성한 공고 (job_application은 CASCADE로 함께 삭제)
    await supabaseAdmin.from('jd').delete().eq('uploader_id', uid);

    // 6) 조회 로그는 분석용으로 보존하되 식별자만 제거
    await supabaseAdmin
      .from('jd_view_log')
      .update({ viewer_user_id: null })
      .eq('viewer_user_id', uid);

    // 7) users 레코드
    await supabaseAdmin.from('users').delete().eq('id', uid);

    // 8) auth.users 레코드
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (delAuthErr) throw delAuthErr;

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('delete-account error:', err);
    return res.status(500).json({ error: msg });
  }
}
