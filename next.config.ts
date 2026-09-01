import type { NextConfig } from "next";

// Route che generano PDF con foto compresse via sharp
const ROUTE_SHARP = [
  "/api/rapporti-intervento/invia",
  "/api/report/rapporto-intervento-pdf",
  "/api/report/sal-freeze-pdf",
  "/api/report/commessa-pdf",
];

// Binario nativo sharp per le funzioni serverless Vercel (linux-x64):
// il file tracing di Turbopack non lo include automaticamente, va forzato
// altrimenti sharp fallisce al caricamento in produzione (ERR_DLOPEN_FAILED)
const FILE_SHARP_LINUX = [
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

const nextConfig: NextConfig = {
  // sharp è nativo: tienilo esterno al bundle server (compressione foto PDF)
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: Object.fromEntries(
    ROUTE_SHARP.map((route) => [route, FILE_SHARP_LINUX])
  ),
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
