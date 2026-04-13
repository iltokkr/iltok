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
 * 기업회원 계정 전환: 아이디 + 이메일 + 비밀번호 일괄 설정
 * - service role로 이메일 확인 없이 바로 auth.users에 이메일/비밀번호 등록
 * - users 테이블에 user_id, email, password_set 업데이트
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { auth_user_id, user_id, email, password } = req.body ?? {};

  if (!auth_user_id || !user_id || !email || !password) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }

  ensureEnvLoaded();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Config error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 아이디 중복 확인
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('user_id', user_id.trim())
      .neq('id', auth_user_id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    }

    // 이메일 중복 확인
    const { data: emailExisting } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .neq('id', auth_user_id)
      .maybeSingle();

    if (emailExisting) {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }

    // Supabase auth에 이메일 + 비밀번호 등록 (이메일 확인 없이)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, {
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // users 테이블 업데이트
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        user_id: user_id.trim(),
        email: email.trim().toLowerCase(),
        password_set: true,
      })
      .eq('id', auth_user_id);

    if (dbError) throw dbError;

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('setup-business-account error:', err);
    return res.status(500).json({ error: msg });
  }
}
