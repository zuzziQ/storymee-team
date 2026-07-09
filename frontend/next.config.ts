import type { NextConfig } from "next";

const nextConfig: any = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
