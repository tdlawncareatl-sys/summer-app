import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this folder. Without this, Next 16 walks up
  // and resolves against the parent PersonalAI directory, which broke clean
  // localhost preview for summer-app.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
