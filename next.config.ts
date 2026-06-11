import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Foto su Supabase Storage (signed URL) — DEV e PROD
      {
        protocol: "https",
        hostname: "mkfedjazibcmstkjxkfm.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
      {
        protocol: "https",
        hostname: "skdtczhvxvawwjanciss.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
