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
  } catch {
    /* ignore */
  }
}

export const config = { api: { bodyParser: true } };

/**
 * 로그인 아이디(user_id)가 이미 사용 중인지 여부(boolean)만 반환한다.
 * 회원가입 아이디 중복확인용. users 를 본인 행만 읽도록 잠그면서
 * 클라이언트가 직접 조회하던 것을 서버로 옮겼다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  if (!userId) {
    return res.status(400).json({ error: 'user_id required' });
  }

  ensureEnvLoaded();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Config error' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('check-userid-exists error:', error);
      return res.status(500).json({ error: 'Lookup failed' });
    }
    return res.status(200).json({ exists: !!data });
  } catch (err) {
    console.error('check-userid-exists:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
