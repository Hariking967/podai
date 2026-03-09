import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Enable standalone output for Docker deployments
  output: "standalone",
};

export default nextConfig;
