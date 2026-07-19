import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  experimental: {
    serverActions: {
      // Tenant document uploads go through a server action; default limit is 1MB.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
