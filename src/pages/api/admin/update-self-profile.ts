// POST /api/admin/update-self-profile — 관리자가 "자기 계정"의 잠긴 항목까지 수정한다.
//
// 일반 회원 화면(/my/edit, 사업자 정보 수정 모달)은 아이디·전화번호·사업자번호 등을
// readOnly 로 잠가둔다. 관리자는 이 잠금을 풀고 전부 고칠 수 있어야 해서 이 라우트를 둔다.
//
// 클라이언트에서 직접 users 를 update 하지 않고 서버로 오는 이유:
//   1) 전화번호/이메일은 users 행뿐 아니라 auth.users 도 같이 바꿔야 한다.
//      users.number 만 바꾸면 로그인 계정과 어긋나 본인이 로그인하지 못하게 된다.
//      auth 쪽은 service role 로만 건드릴 수 있다.
//   2) 아이디(user_id)·전화번호 중복 검사는 남의 행을 읽어야 하는데
//      users 는 본인 행만 읽도록 RLS 로 잠겨 있다.
//
// 대상은 항상 요청자 본인(adminId)이다. 남의 계정은 이 라우트로 못 고친다.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';

/** 010-1234-5678 / 01012345678 → +821012345678 (이미 + 로 시작하면 그대로) */
function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/[^0-9+]/g, '');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return '+82' + digits.slice(1);
  if (digits.startsWith('82')) return '+' + digits;
  return '+' + digits;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 문자열 필드만 뽑아 trim. 값이 안 왔으면 undefined(= 변경 없음) */
function str(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  return typeof v === 'string' ? v.trim() : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, res, 'POST')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase, adminId } = ctx;

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const { data: current, error: currentError } = await supabase
      .from('users')
      .select('user_id, email, number, company_name, name, business_number, business_address, biz_file')
      .eq('id', adminId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return res.status(404).json({ error: '회원 정보를 찾을 수 없습니다.' });
    }

    const updates: Record<string, unknown> = {};

    // ── 아이디 ──
    const userId = str(body, 'user_id');
    if (userId !== undefined && userId !== (current.user_id ?? '')) {
      if (!userId) {
        return res.status(400).json({ error: '아이디를 입력해주세요.' });
      }
      const { data: dup, error: dupError } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userId)
        .neq('id', adminId)
        .limit(1)
        .maybeSingle();
      if (dupError) throw dupError;
      if (dup) {
        return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
      }
      updates.user_id = userId;
    }

    // ── 전화번호 (users.number + auth.users.phone 동시 변경) ──
    const rawPhone = str(body, 'number');
    let nextPhone: string | null = null;
    if (rawPhone !== undefined) {
      const normalized = rawPhone ? normalizePhone(rawPhone) : '';
      if (!normalized) {
        return res.status(400).json({ error: '전화번호를 입력해주세요.' });
      }
      if (normalized !== (current.number ?? '')) {
        const { data: dup, error: dupError } = await supabase
          .from('users')
          .select('id')
          .eq('number', normalized)
          .neq('id', adminId)
          .limit(1)
          .maybeSingle();
        if (dupError) throw dupError;
        if (dup) {
          return res.status(409).json({ error: '이미 가입된 전화번호입니다.' });
        }
        nextPhone = normalized;
        updates.number = normalized;
      }
    }

    // ── 이메일 ──
    const email = str(body, 'email');
    let nextEmail: string | null = null;
    if (email !== undefined && email !== (current.email ?? '')) {
      if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
      }
      nextEmail = email;
      updates.email = email;
    }

    // ── 사업자 정보 (중복 검사 없이 그대로 반영) ──
    // is_accept / accept_notified 는 건드리지 않는다. 일반 회원용 모달은 수정 시
    // 이 둘을 false 로 내려 재심사를 걸지만, 관리자 본인 계정은 인증 상태를 유지한다.
    for (const key of ['company_name', 'name', 'business_number', 'business_address', 'biz_file'] as const) {
      const value = str(body, key);
      if (value !== undefined && value !== (current[key] ?? '')) {
        updates[key] = value;
      }
    }

    // ── 약관 동의 플래그 ──
    for (const key of ['auth_term', 'policy_term'] as const) {
      if (typeof body[key] === 'boolean') updates[key] = body[key];
    }

    // auth.users 를 먼저 바꾼다. 여기서 실패하면 users 행은 그대로 두어
    //   "로그인은 예전 번호, 프로필은 새 번호" 같은 어긋난 상태를 만들지 않는다.
    if (nextPhone || nextEmail) {
      const authPayload: { phone?: string; email?: string; phone_confirm?: boolean; email_confirm?: boolean } = {};
      if (nextPhone) {
        authPayload.phone = nextPhone;
        authPayload.phone_confirm = true; // 관리자 본인 변경이므로 OTP 재인증을 생략한다
      }
      if (nextEmail) {
        authPayload.email = nextEmail;
        authPayload.email_confirm = true;
      }
      const { error: authError } = await supabase.auth.admin.updateUserById(adminId, authPayload);
      if (authError) {
        const msg = authError.message || '';
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          return res.status(409).json({ error: '이미 사용 중인 이메일 또는 전화번호입니다.' });
        }
        throw authError;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ ok: true, changed: [] });
    }

    const { error: updateError } = await supabase.from('users').update(updates).eq('id', adminId);
    if (updateError) throw updateError;

    return res.status(200).json({ ok: true, changed: Object.keys(updates) });
  } catch (err) {
    console.error('admin/update-self-profile error:', err);
    return res.status(500).json({ error: toKoreanErrorMessage(err) });
  }
}
