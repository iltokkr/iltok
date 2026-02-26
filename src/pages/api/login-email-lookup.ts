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
  // dotenv 실패 시 직접 파싱
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

export const config = {
  api: { bodyParser: true },
};

/**
 * 아이디(user_id)로 이메일 조회 - 로그인 시 RLS 우회용
 * 서버에서 service_role로 조회 후 이메일만 반환
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  if (!user_id) {
    return res.status(400).json({
      error: 'user_id required',
      hint: process.env.NODE_ENV === 'development' ? 'body가 비어있을 수 있습니다.' : undefined,
    });
  }

  ensureEnvLoaded();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
    return res.status(500).json({
      error: 'Config error',
      hint: 'SUPABASE_SERVICE_ROLE_KEY가 .env.local에 설정되어 있는지 확인하세요.',
    });
  }
  if (!supabaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL not configured');
    return res.status(500).json({
      error: 'Config error',
      hint: 'NEXT_PUBLIC_SUPABASE_URL가 .env.local에 설정되어 있는지 확인하세요.',
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('user_id', user_id)
      .limit(1)
      .maybeSingle();

    if (error) {
      const errMsg = (error as { message?: string; details?: string; hint?: string }).message ?? String(error);
      const errDetails = (error as { details?: string }).details;
      console.error('login-email-lookup Supabase error:', error);
      return res.status(500).json({
        error: 'Lookup failed',
        hint: errMsg + (errDetails ? ` (${errDetails})` : ''),
      });
    }

    const email = data?.email?.trim();
    if (!email) {
      return res.status(404).json({
        error: 'User not found',
        hint: process.env.NODE_ENV === 'development'
          ? `user_id="${user_id}"에 해당하는 이메일이 없습니다. (user_id/email 확인)`
          : undefined,
      });
    }

    return res.status(200).json({ email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('login-email-lookup:', err);
    return res.status(500).json({
      error: 'Server error',
      hint: msg || '알 수 없는 오류',
    });
  }
}
