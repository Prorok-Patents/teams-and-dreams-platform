import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/api/knowledge-graph/:path*",
        destination: `${backendUrl}/api/knowledge-graph/:path*`,
      },
      {
        source: "/api/site-knowledge/:path*",
        destination: `${backendUrl}/api/site-knowledge/:path*`,
      },
    ];
  },
};

export default nextConfig;
