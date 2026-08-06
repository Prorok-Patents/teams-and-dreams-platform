import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8000/api/v1/:path*",
      },
      {
        source: "/api/knowledge-graph/:path*",
        destination: "http://localhost:8000/api/knowledge-graph/:path*",
      },
    ];
  },
};

export default nextConfig;

