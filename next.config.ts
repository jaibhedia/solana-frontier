import type { NextConfig } from 'next';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpack = require('webpack');

const nextConfig: NextConfig = {
  serverExternalPackages: ['tweetnacl', 'bs58'],
  turbopack: {},

  webpack(config) {
    // pino-pretty is an optional dep of pino (used by WalletConnect) — not needed in browser
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^pino-pretty$/ }));
    // suppress the ox/tempo dynamic-require critical-dependency warning from @reown/appkit
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /ox\/_esm\/tempo/ },
    ];
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/favicon.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
