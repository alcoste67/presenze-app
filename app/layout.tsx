import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ToastProvider } from "@/components/ui/Toast";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Cantivo",
  description: "Il gestionale che lavora quanto te. Timbrature, rapporti, SAL e computi metrici gestiti dall'AI.",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: "/cantivo-logo.png", type: "image/png" },
    ],
    apple: "/cantivo-logo.png",
    shortcut: "/cantivo-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${montserrat.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">
        <ToastProvider>{children}</ToastProvider>
        <Script
          src="https://embeds.iubenda.com/widgets/c376aaf4-4c91-4945-b867-9c5e1fb8215a.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
