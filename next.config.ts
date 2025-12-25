import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone output for Amplify compatibility
  // output: 'standalone', // Not compatible with AWS Amplify
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
};

export default nextConfig;
