import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// Política de conteúdo: o navegador só carrega recursos destas origens.
// Qualquer script, iframe ou imagem de anúncio ou rastreador de terceiros é bloqueado.
const supabase = 'https://*.supabase.co';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ''}https://www.youtube.com https://s.ytimg.com https://open.spotify.com https://open.spotifycdn.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} https://i.ytimg.com https://i.scdn.co https://mosaic.scdn.co https://*.spotifycdn.com https://tile.openstreetmap.org`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} wss://*.supabase.co https://www.youtube.com${isDev ? ' ws:' : ''}`,
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://open.spotify.com',
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabase} https://accounts.google.com`,
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
