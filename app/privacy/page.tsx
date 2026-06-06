import Link from "next/link";
import Script from "next/script";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg-base px-4 py-12">
      <div className="mx-auto max-w-2xl">

        <div className="mb-8 flex items-center gap-4">
          <Link href="https://cantivo.it" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            ← torna a cantivo.it
          </Link>
        </div>

        <img
          src="/cantivo-logo.png"
          alt="Cantivo"
          className="mb-6 h-12 w-auto object-contain"
        />

        <h1 className="font-heading text-3xl font-medium text-text-primary mb-6">
          Privacy Policy
        </h1>

        <div className="mt-6">
          <a
            href="https://www.iubenda.com/privacy-policy/34327883"
            className="iubenda-white iubenda-noiframe iubenda-embed"
            title="Privacy Policy"
          >
            Privacy Policy
          </a>
        </div>

        <Script
          src="https://cdn.iubenda.com/iubenda.js"
          strategy="afterInteractive"
        />

      </div>
    </div>
  );
}
