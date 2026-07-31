// 관리자 API 공통 — service role 클라이언트 + 요청자 is_admin 검사 + 오류 문구 변환
//
// src/pages/api/admin/** 의 모든 라우트가 이 파일을 쓴다.
// 클라이언트는 Authorization: Bearer <supabase access_token> 을 보낸다.
// 서버는 service role 로 auth.getUser(token) 해서 uid 를 얻고,
// users.is_admin = true 인지 확인한다. 아니면 403.
//
// spam_reports 에는 RLS 정책이 하나도 없어 service role 로만 접근할 수 있다.

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';

/** 로컬 개발에서 .env.local 이 늦게 읽히는 경우 대비 (api/cron/refresh-premium.ts 와 같은 방식) */
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

export interface AdminContext {
  supabase: SupabaseClient;
  adminId: string;
}

/**
 * 관리자 인증. 통과하면 { supabase, adminId } 를, 실패하면 null 을 돌려준다.
 * 실패 시 응답은 이 함수가 이미 보냈으므로 호출부는 바로 return 하면 된다.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminContext | null> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }

  ensureEnvLoaded();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: '서버 설정 오류입니다.' });
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ error: '인증에 실패했습니다.' });
    return null;
  }

  const adminId = authData.user.id;

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', adminId)
    .maybeSingle();

  if (userError) {
    res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
    return null;
  }

  if (!userRow?.is_admin) {
    res.status(403).json({ error: '관리자만 사용할 수 있습니다.' });
    return null;
  }

  return { supabase, adminId };
}

/** 허용된 메서드가 아니면 405 를 보내고 false 를 돌려준다 */
export function methodAllowed(
  req: NextApiRequest,
  res: NextApiResponse,
  method: 'GET' | 'POST'
): boolean {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  res.status(405).json({ error: '허용되지 않은 요청 방식입니다.' });
  return false;
}

/**
 * DB 함수/트리거가 던지는 오류 코드를 화면에 그대로 띄울 한국어 문구로 바꾼다.
 * issue_warning / dismiss_report 가 RAISE EXCEPTION 으로 던지는 것들이다.
 */
export function toKoreanErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: string }).message ?? '')
      : typeof error === 'string'
      ? error
      : '';

  if (!message) return '처리 중 오류가 발생했습니다.';

  if (message.includes('REPORT_NOT_FOUND')) {
    return '해당 후보를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.';
  }
  if (message.includes('REPORT_ALREADY_REVIEWED')) {
    return message.includes('warned')
      ? '이미 경고가 발송된 후보입니다.'
      : '이미 처리된 후보입니다.';
  }
  if (message.includes('USER_NOT_FOUND')) {
    return '대상 회원을 찾을 수 없습니다.';
  }
  if (message.includes('WARNING_TOO_SOON')) {
    return '이 회원은 최근 24시간 안에 이미 경고를 받았습니다. 같은 행위로 회차가 연달아 올라가지 않도록 막았습니다. 남은 묶음은 "숨김만"으로 처리하세요.';
  }
  if (message.includes('POSTING_BLOCKED_PERMANENT')) {
    return '공고 등록이 영구히 제한된 계정입니다.';
  }
  if (message.includes('POSTING_SUSPENDED_UNTIL')) {
    return '공고 등록이 제한된 계정입니다.';
  }

  return message;
}
