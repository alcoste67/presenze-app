import Link from "next/link";

// ─── Static data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    titolo: "Timbrature digitali",
    descrizione:
      "Niente fogli, niente errori. Ogni entrata, pausa e uscita registrata in tempo reale dal cantiere.",
    icona: "⏱",
  },
  {
    titolo: "Rapporti intervento",
    descrizione:
      "Firma digitale in cantiere. Il cliente firma sul telefono, il PDF è subito pronto.",
    icona: "📋",
  },
  {
    titolo: "Avanzamento lavori",
    descrizione:
      "SAL sempre aggiornato. Traccia le lavorazioni e congela lo stato a fine mese.",
    icona: "📈",
  },
  {
    titolo: "Gestione macchinari",
    descrizione:
      "Ore e costi dei macchinari sotto controllo. Imputazione automatica per cantiere.",
    icona: "🏗",
  },
  {
    titolo: "PDF automatici",
    descrizione:
      "Commesse e rapporti pronti in un click. Branding personalizzato con il tuo logo.",
    icona: "📄",
  },
  {
    titolo: "Multi-azienda",
    descrizione:
      "Subappalti e collaborazioni senza confusione. Ogni azienda vede solo i suoi dati.",
    icona: "🏢",
  },
] as const;

const PIANI = [
  {
    nome: "Trial",
    prezzo: "€0",
    periodicita: "3 mesi",
    utenti: "max 2 utenti",
    badge: null,
    cta: "Inizia gratis",
    href: "/registrati",
    evidenziato: false,
  },
  {
    nome: "Base",
    prezzo: "€19",
    periodicita: "al mese",
    utenti: "max 2 utenti",
    badge: null,
    cta: "Scegli Base",
    href: "/registrati",
    evidenziato: false,
  },
  {
    nome: "Pro",
    prezzo: "€59",
    periodicita: "al mese",
    utenti: "max 15 utenti",
    badge: "Più scelto",
    cta: "Scegli Pro",
    href: "/registrati",
    evidenziato: true,
  },
  {
    nome: "Enterprise",
    prezzo: "€149",
    periodicita: "al mese",
    utenti: "utenti illimitati",
    badge: null,
    cta: "Contattaci",
    href: "/registrati",
    evidenziato: false,
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-dvh">

      {/* ── Hero ── */}
      <section className="bg-[#1a1a2e] px-6 py-24 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70">
            Gestionale per cantieri e presenze
          </div>
          <h1 className="font-heading text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Cantivo
          </h1>
          <p className="mt-4 text-xl font-light text-white/70">
            Il gestionale che lavora quanto te
          </p>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/50">
            Timbrature, rapporti, SAL e PDF automatici. Tutto in un posto,
            su qualsiasi dispositivo, anche in cantiere.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/registrati"
              className="inline-flex h-12 items-center justify-center rounded-md bg-brand-500 px-8 text-base font-medium text-white transition-colors hover:bg-brand-600"
            >
              Inizia gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 bg-white/5 px-8 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Accedi
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/40">
            Trial gratuito 3 mesi · Nessuna carta di credito
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-bg-base px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-medium text-text-primary">
              Tutto ciò che serve in cantiere
            </h2>
            <p className="mt-2 text-text-muted">
              Progettato per chi lavora sul campo, non davanti a un computer.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.titolo}
                className="rounded-lg border border-border bg-bg-card p-6"
              >
                <div className="mb-3 text-2xl">{f.icona}</div>
                <h3 className="font-heading text-base font-medium text-text-primary">
                  {f.titolo}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                  {f.descrizione}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-bg-subtle px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-medium text-text-primary">
              Prezzi semplici, nessuna sorpresa
            </h2>
            <p className="mt-2 text-text-muted">
              Inizia gratis, scala quando vuoi.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PIANI.map((piano) => (
              <div
                key={piano.nome}
                className={`relative flex flex-col rounded-lg border bg-bg-card p-6 ${
                  piano.evidenziato
                    ? "border-brand-500 shadow-[0_0_0_1px] shadow-brand-500"
                    : "border-border"
                }`}
              >
                {piano.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">
                      {piano.badge}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-muted">{piano.nome}</p>
                  <p className="mt-2 font-heading text-3xl font-semibold text-text-primary">
                    {piano.prezzo}
                  </p>
                  <p className="text-sm text-text-muted">{piano.periodicita}</p>
                  <p className="mt-3 text-sm text-text-secondary">{piano.utenti}</p>
                </div>
                <div className="mt-6">
                  <Link
                    href={piano.href}
                    className={`block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                      piano.evidenziato
                        ? "bg-brand-500 text-white hover:bg-brand-600"
                        : "border border-border bg-bg-base text-text-primary hover:bg-bg-subtle"
                    }`}
                  >
                    {piano.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#1a1a2e] px-6 py-12">
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-white/50">© Cantivo 2026</p>
          <div className="flex gap-6 text-sm text-white/50">
            <Link href="/login" className="transition-colors hover:text-white">
              Accedi
            </Link>
            <Link href="/registrati" className="transition-colors hover:text-white">
              Registrati
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
