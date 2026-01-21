import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  reactCompiler: true,
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
  // Turbopack configuration (Next.js 16 default)
  turbopack: {},
  // Bundle analyzer and optimization
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'crypto'],
  // Amplify-specific optimizations
  trailingSlash: false,
  images: {
    unoptimized: false, // Amplify supports Next.js Image Optimization
  },
  // Body size limits are now handled in middleware or individual API routes
  // Requirement 15.1: Request body size limits
  // Security headers
  // Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ],
      },
    ];
  },
};

export default nextConfig;
