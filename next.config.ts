import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Law texts now live in Supabase (read at runtime from the DB), so no law
     files need to be traced into the serverless bundle. */

  /* Keep the headless-Chrome packages external so the bundler doesn't try to
     pack Chromium (the Odluke PDF generator loads them at runtime on the
     Node.js serverless function). */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
