import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Info site — every route is statically generated at build time.
  // Deployed natively on Vercel so next/image optimization (WebP/AVIF,
  // responsive sizes) works out of the box.
  reactStrictMode: true,
};

export default nextConfig;
