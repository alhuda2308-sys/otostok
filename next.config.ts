import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // Foto unit/logo disimpan di Supabase Storage (produksi) — wajib
    // di-whitelist agar next/image bisa mengoptimalkan (resize + WebP/AVIF
    // + cache CDN). Path lokal /upload/... (dev) tidak perlu pattern.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
