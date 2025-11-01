import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'motion'],
  },
  // Enable React Compiler optimizations
  reactStrictMode: true,
};

export default nextConfig;
