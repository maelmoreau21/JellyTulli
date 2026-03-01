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
  serverExternalPackages: ['node-cron', 'geoip-country'],
};

export default nextConfig;
