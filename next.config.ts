import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import { execSync } from 'node:child_process';

/** Deterministic per-commit build id; also versions the service worker caches. */
function resolveBuildId(): string {
  const fromEnv =
    process.env.BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.SOURCE_COMMIT;
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}
const buildId = resolveBuildId();

/**
 * Deployment-agnostic config: the Supabase host is read from the environment,
 * never hard-coded.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabase = new URL(supabaseUrl);
const isLocalSupabase = ['127.0.0.1', 'localhost', '0.0.0.0'].includes(supabase.hostname);
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  // Next.js inlines bootstrap scripts; nonces would make every page dynamic.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase.origin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase.origin}${isDev ? ' ws: wss:' : ''}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev || isLocalSupabase ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Camera is denied everywhere except the staff scanner (next rule).
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  generateBuildId: async () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  serverExternalPackages: ['exceljs', 'pdfmake', 'sharp'],
  experimental: {
    useOffline: true,
    optimizePackageImports: ['lucide-react', 'recharts'],
    serverActions: { bodySizeLimit: '3mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 85],
    minimumCacheTTL: 86_400,
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1920],
    imageSizes: [48, 64, 96, 128, 160, 220, 256, 320],
    remotePatterns: [
      {
        protocol: supabase.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabase.hostname,
        port: supabase.port,
        pathname: '/storage/v1/object/public/**',
      },
    ],
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/staff/scan',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/(pass|my-pass|checkin|staff|admin|api)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

export default withBundleAnalyzer(nextConfig);
