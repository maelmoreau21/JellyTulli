import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Override the default 10MB body parser limit for API routes handling large uploads
  serverExternalPackages: ['stream-json', 'stream-chain', 'JSONStream'],
};

export default nextConfig;
