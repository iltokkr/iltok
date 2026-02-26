import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const url = request.nextUrl;

  // 114114kr.com (www 포함) 도메인에서 루트(/) 접속 시 채용정보(/board)로 리다이렉트
  const is114114Domain = host.includes('114114kr.com');
  if (is114114Domain && url.pathname === '/') {
    return NextResponse.redirect(new URL('/board', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
