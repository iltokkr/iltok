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

/**
 * 아이디(user_id) 또는 이메일로 비밀번호 재설정 이메일 발송
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, email: inputEmail } = req.body ?? {};
  if (!user_id && !inputEmail) {
    return res.status(400).json({ error: 'user_id 또는 이메일을 입력해주세요.' });
  }

  ensureEnvLoaded();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Config error' });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://114114kr.com';

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let email = inputEmail?.trim();

    if (!email && user_id) {
      const { data } = await supabase
        .from('users')
        .select('email')
        .eq('user_id', user_id.trim())
        .maybeSingle();

      email = data?.email?.trim();
      if (!email) {
        return res.status(404).json({ error: '등록되지 않은 아이디입니다.' });
      }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return res.status(500).json({ error: msg });
  }
}
