import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://dev-hub.storymee.com'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
