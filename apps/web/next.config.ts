import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const API_URL = process.env.API_URL ?? 'http://localhost:4100';

const nextConfig: NextConfig = {
  // REST goes through this origin so the refresh cookie is first-party (Socket.IO connects to the API directly).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  // Pin Turbopack to this repo so nothing outside it is ever resolved.
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
  turbopack: {
    root: fileURLToPath(new URL('../..', import.meta.url)),
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
