import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  // The public TLS proxy compresses eligible responses and excludes secret-bearing routes.
  compress: false,
  // Recovery links carry a one-time secret: never print request URLs in development.
  logging: { incomingRequests: false },
  async headers() {
    return ["/login", "/register", "/forgot-password", "/reset-password", "/account"].map((source) => ({ source, headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ] }));
  },
};

export default nextConfig;
