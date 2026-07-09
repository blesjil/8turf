import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      // Tenant document uploads go through a server action; default limit is 1MB.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
