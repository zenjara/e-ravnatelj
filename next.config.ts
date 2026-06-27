import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Law texts now live in Supabase (read at runtime from the DB), so no law
     files need to be traced into the serverless bundle. */
};

export default nextConfig;
