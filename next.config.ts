import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /api/ask route reads the law texts from disk at runtime. Ensure those
  // files are traced into the serverless bundle on Vercel so fs reads work in
  // production (they are not code-imported, so Next can't infer them otherwise).
  outputFileTracingIncludes: {
    "/api/ask": ["src/content/laws/**/*"],
  },
};

export default nextConfig;
