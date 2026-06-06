import Link from "next/link";

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

        <p className="text-text-muted leading-relaxed">
          La presente Privacy Policy è in fase di redazione. Cantivo è un servizio di A2C Sistemi S.r.l. · P.IVA 13078970962. Per informazioni:{" "}
          <a href="mailto:privacy@cantivo.it" className="text-brand-500 hover:underline">
            privacy@cantivo.it
          </a>
        </p>

      </div>
    </div>
  );
}
