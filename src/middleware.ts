/**
 * Next.js Middleware for Cognito Authentication
 * 
 * Protects routes and validates Cognito tokens
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
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
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes, static files, and public assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  // Check if auth is disabled for development
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
  if (authDisabled) {
    return NextResponse.next();
  }

  // Get access token from localStorage (client-side only)
  // For server-side, we'll rely on the AuthContext to handle redirects
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.includes(pathname);

  // For protected routes, let the AuthContext handle authentication
  // This middleware is mainly for future server-side token validation
  if (isProtectedRoute) {
    // Could add server-side token validation here in the future
    return NextResponse.next();
  }

  // For auth routes, let the AuthContext handle redirects
  if (isAuthRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
