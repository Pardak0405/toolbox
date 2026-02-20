import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./config/security";

const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  images: {
    unoptimized: true
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const securityHeaders = buildSecurityHeaders(isDev);
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
