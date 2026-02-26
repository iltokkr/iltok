import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const url = request.nextUrl;

  // 114114kr.com 도메인에서 루트(/) 접속 시 채용정보(/board)로 리다이렉트
  if ((host === '114114kr.com' || host === 'www.114114kr.com') && url.pathname === '/') {
    return NextResponse.redirect(new URL('/board', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
