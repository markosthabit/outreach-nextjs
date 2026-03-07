import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // For production build
  // Disable image optimization for Electron
  images: {
    unoptimized: true,
  },
  // API calls to NestJS
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'}/:path*`,
      },
    ];
  },
  // async redirects() {
  //   return [
  //      {
  //       source: '/',
  //       destination: '/login',
  //       permanent: true,
  //     },
  //   ]
  // },
};

export default nextConfig;