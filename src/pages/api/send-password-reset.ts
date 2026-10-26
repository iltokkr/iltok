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

// 보낸 주소를 화면에 보여주되 전체는 가린다. mkyxx0302@daum.net → mky****02@daum.net
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 4) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 3)}${'*'.repeat(local.length - 5)}${local.slice(-2)}@${domain}`;
}

/**
 * 아이디(user_id) 또는 이메일로 비밀번호 재설정 이메일 발송.
 *
 * 메일은 항상 계정에 "등록된 이메일"로 보낸다. 입력값은 계정을 찾는 용도일 뿐이다.
 * 아이디를 먼저 찾고, 없을 때만 입력값을 이메일로 취급한다.
 * 아이디가 이메일 형태(예: silw77@naver.com)인 회원이 있어서, '@' 유무로 먼저 갈라버리면
 * 등록 이메일이 아닌 아이디 주소로 요청이 나간다. Supabase 는 가입되지 않은 이메일이면
 * 메일을 보내지 않으면서도 성공으로 응답하므로, 화면엔 "보냈다"가 뜨고 메일은 어디에도 안 간다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // identifier 가 새 필드. 배포 직후 캐시된 구버전 화면이 보내는 user_id / email 도 받는다.
  const { identifier: rawIdentifier, user_id, email: legacyEmail } = req.body ?? {};
  const identifier = String(rawIdentifier ?? user_id ?? legacyEmail ?? '').trim();
  if (!identifier) {
    return res.status(400).json({ error: '아이디 또는 이메일을 입력해주세요.' });
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

    // 1) 아이디로 먼저 찾는다 ('@' 가 있어도)
    const { data: byUserId } = await supabase
      .from('users')
      .select('email')
      .eq('user_id', identifier)
      .maybeSingle();

    let email: string | undefined;
    if (byUserId) {
      email = byUserId.email?.trim();
      if (!email) {
        return res.status(404).json({
          error: '등록된 이메일이 없는 계정입니다. 고객센터로 문의해주세요.',
        });
      }
    } else if (identifier.includes('@')) {
      // 2) 아이디가 아니면 이메일로 취급한다
      email = identifier;
    } else {
      return res.status(404).json({ error: '등록되지 않은 아이디입니다.' });
    }

    // Supabase Auth 는 이메일을 소문자로 저장한다
    email = email.toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });

    if (error) throw error;

    return res.status(200).json({ ok: true, maskedEmail: maskEmail(email) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return res.status(500).json({ error: msg });
  }
}
