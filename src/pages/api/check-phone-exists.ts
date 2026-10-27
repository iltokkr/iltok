import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { phoneVariants } from '@/lib/phoneVariants';
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
 * 전화번호가 이미 가입돼 있는지 여부와 회원유형(user_type)만 반환한다.
 * 과거에는 클라이언트가 anon 키로 users 테이블을 number 로 직접 조회했는데,
 * users 를 본인 행만 읽도록 잠그면서 이 확인을 서버로 옮겼다.
 * (이름·전화·이메일·아이디 등은 반환하지 않고 존재 여부 + 유형만 준다.
 *  로그인/회원가입 흐름에서 "이미 가입된 번호/유형" 안내에 필요)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone) {
    return res.status(400).json({ error: 'phone required' });
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
      .select('user_type')
      // 저장 형식이 섞여 있어 정확 일치로 찾으면 기존 회원을 신규로 판정한다 (lib/phoneVariants.ts)
      .in('number', phoneVariants(phone))
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('check-phone-exists error:', error);
      return res.status(500).json({ error: 'Lookup failed' });
    }
    return res.status(200).json({ exists: !!data, user_type: data?.user_type ?? null });
  } catch (err) {
    console.error('check-phone-exists:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
