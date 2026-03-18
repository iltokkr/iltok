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
 * 휴대폰 번호로 기업회원이 아이디/비밀번호 전환 완료인지 확인
 * 전환 완료면 OTP 발송 차단 → Twilio 비용 절감
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: 'phone required' });

  ensureEnvLoaded();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Config error' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from('users')
      .select('password_set, user_type')
      .eq('number', phone)
      .in('user_type', ['business', 'both'])
      .maybeSingle();

    return res.status(200).json({
      isTransitioned: data?.password_set === true,
      isBusiness: !!data,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
