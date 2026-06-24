import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-app law reader and the sidebar read the .txt files at runtime, so
  // trace them into the serverless bundle on Vercel. (The /api/ask RAG route
  // does NOT need them — it reads from Supabase.)
  outputFileTracingIncludes: {
    "/": ["src/content/laws/**/*"],
    "/zakoni/[slug]": ["src/content/laws/**/*"],
  },
};

export default nextConfig;
