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
    // imgg.fr = host screenshot showcase pada Landing Page.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "imgg.fr",
        pathname: "/r/**",
      },
    ],
  },
};

export default nextConfig;
