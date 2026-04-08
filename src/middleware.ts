import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromCookie } from '@/lib/jwt';

const protectedRoutes = [
  '/dashboard',
  '/alerts',
  '/compliance',
  '/cloud-cost',
  '/data-sources',
  '/tickets',
  '/profile',
  '/settings',
  '/super-admin',
  '/sessions',
  '/threat-lake',
  '/assets',
  '/reports',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for API routes, static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production') {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    if (protocol === 'http' && host) {
      return NextResponse.redirect(`https://${host}${pathname}${request.nextUrl.search}`, 301);
    }
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    const token = extractTokenFromCookie(request.headers.get('cookie'));
    if (!token || !verifyToken(token).valid) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
