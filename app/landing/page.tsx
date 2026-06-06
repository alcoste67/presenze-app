import Link from "next/link"

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconDocument() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconArchive() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )
}

function IconMonitor() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

// ─── Static data ──────────────────────────────────────────────────────────────

const AI_FEATURES = [
  {
    titolo: "Importa qualsiasi computo",
    descrizione:
      "Carica un PDF o Excel: l'AI estrae e categorizza automaticamente tutte le lavorazioni, pronte per il cantiere.",
    icona: <IconUpload />,
  },
  {
    titolo: "Prezzi sempre aggiornati",
    descrizione:
      "Cerca automaticamente i prezzi DEI aggiornati per ogni voce. Zero ricerche manuali, zero errori di listino.",
    icona: <IconSearch />,
  },
  {
    titolo: "Rapporti in un click",
    descrizione:
      "Firma digitale direttamente in cantiere. Il cliente firma sul telefono, il PDF è generato e inviato all'istante.",
    icona: <IconDocument />,
  },
] as const

const OP_FEATURES = [
  { titolo: "Timbrature digitali", descrizione: "Entrate, pause e uscite in tempo reale dal cantiere.", icona: <IconClock /> },
  { titolo: "SAL avanzamento", descrizione: "Traccia le lavorazioni e congela lo stato a fine mese.", icona: <IconChart /> },
  { titolo: "Gestione macchinari", descrizione: "Ore e costi dei macchinari imputati automaticamente.", icona: <IconGear /> },
  { titolo: "Multi-azienda", descrizione: "Subappalti e collaborazioni: ogni azienda vede i suoi dati.", icona: <IconBuilding /> },
  { titolo: "Storico completo", descrizione: "Ogni evento registrato, consultabile e scaricabile.", icona: <IconArchive /> },
  { titolo: "Back-office web", descrizione: "Dashboard completa da browser per chi gestisce l'ufficio.", icona: <IconMonitor /> },
]

const PIANI = [
  {
    nome: "Trial",
    prezzo: "€0",
    periodicita: "3 mesi",
    dettaglio: "max 2 utenti",
    dopoTrial: "Poi solo €19/mese",
    badge: null,
    cta: "Inizia gratis",
    href: "/registrati",
    evidenziato: false,
  },
  {
    nome: "Base",
    prezzo: "€19",
    periodicita: "al mese",
    dettaglio: "max 5 utenti",
    dopoTrial: null,
    badge: null,
    cta: "Scegli Base",
    href: "/registrati",
    evidenziato: false,
  },
  {
    nome: "Pro",
    prezzo: "€59",
    periodicita: "al mese",
    dettaglio: "max 15 utenti",
    dopoTrial: null,
    badge: "Più scelto",
    cta: "Scegli Pro",
    href: "/registrati",
    evidenziato: true,
  },
  {
    nome: "Enterprise",
    prezzo: "€149",
    periodicita: "al mese",
    dettaglio: "utenti illimitati",
    dopoTrial: null,
    badge: null,
    cta: "Contattaci",
    href: "/registrati",
    evidenziato: false,
  },
] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white font-sans antialiased">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#1e2d4a]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight text-white">Cantivo</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Accedi
            </Link>
            <Link
              href="/registrati"
              className="inline-flex h-9 items-center rounded-md bg-[#e95624] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Inizia gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-[#1e2d4a] px-6 pb-28 pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <img src="/cantivo-logo-w.png" alt="Cantivo" width={140} height={140} className="object-contain" />
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-[#e95624]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e95624]" />
            Powered by Claude AI
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Il cantiere in tasca.
            <br />
            <span className="text-[#e95624]">L&apos;intelligenza artificiale</span>
            <br />
            al lavoro.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg font-light leading-relaxed text-white/60">
            Timbrature, rapporti, SAL e computi metrici gestiti dall&apos;AI.
            Tutto su mobile, anche offline.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/registrati"
              className="inline-flex h-13 items-center rounded-lg bg-[#e95624] px-8 text-base font-bold text-white shadow-lg shadow-[#e95624]/30 transition-opacity hover:opacity-90"
            >
              Inizia gratis — 3 mesi
            </Link>
            <Link
              href="#come-funziona"
              className="inline-flex h-13 items-center rounded-lg border border-white/20 px-8 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              Guarda come funziona
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="border-y border-neutral-200 bg-neutral-50 px-6 py-5">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-neutral-400">
          Progettato per
        </p>
        <p className="text-center text-sm font-medium text-neutral-700 flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
          <span>Impiantisti</span>
          <span>·</span>
          <span>Elettricisti</span>
          <span>·</span>
          <span>Idraulici</span>
          <span>·</span>
          <span>Muratori</span>
          <span>·</span>
          <span>Serramentisti</span>
        </p>
      </section>

      {/* ── AI Features ── */}
      <section id="come-funziona" className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#e95624]">Intelligenza artificiale</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900">
              L&apos;AI che capisce l&apos;edilizia
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-500">
              Non un chatbot generico. Un assistente addestrato sui processi reali del cantiere.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {AI_FEATURES.map((f) => (
              <div
                key={f.titolo}
                className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#e95624]/10 text-[#e95624]">
                  {f.icona}
                </div>
                <h3 className="mb-3 text-xl font-bold text-neutral-900">{f.titolo}</h3>
                <p className="leading-relaxed text-neutral-500">{f.descrizione}</p>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#e95624] transition-all duration-300 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Operative Features ── */}
      <section className="bg-neutral-50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#e95624]">Funzionalità operative</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900">
              Tutto ciò che serve, niente di superfluo
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OP_FEATURES.map((f) => (
              <div
                key={f.titolo}
                className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-6"
              >
                <div className="mt-0.5 flex-shrink-0 text-[#e95624]">{f.icona}</div>
                <div>
                  <h3 className="font-bold text-neutral-900">{f.titolo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{f.descrizione}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#e95624]">Prezzi</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900">
              Semplici, trasparenti, scalabili
            </h2>
            <div className="mt-4 inline-flex items-center rounded-full bg-[#e95624]/10 px-5 py-2">
              <span className="text-sm font-bold text-[#e95624]">
                Prezzi di lancio — offerta limitata ai primi 100 clienti
              </span>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PIANI.map((piano) => (
              <div
                key={piano.nome}
                className={`relative flex flex-col rounded-2xl p-7 ${
                  piano.evidenziato
                    ? "bg-[#1e2d4a] text-white shadow-2xl shadow-black/20 ring-2 ring-[#e95624]"
                    : "border border-neutral-200 bg-white"
                }`}
              >
                {piano.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[#e95624] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      {piano.badge}
                    </span>
                  </div>
                )}
                <p className={`text-sm font-semibold uppercase tracking-widest ${piano.evidenziato ? "text-[#e95624]" : "text-neutral-400"}`}>
                  {piano.nome}
                </p>
                <div className="mt-4 flex items-end gap-1">
                  <span className={`text-5xl font-extrabold ${piano.evidenziato ? "text-white" : "text-neutral-900"}`}>
                    {piano.prezzo}
                  </span>
                  <span className={`mb-1.5 text-sm ${piano.evidenziato ? "text-white/50" : "text-neutral-400"}`}>
                    /{piano.periodicita}
                  </span>
                </div>
                <p className={`mt-2 text-sm ${piano.evidenziato ? "text-white/50" : "text-neutral-400"}`}>
                  {piano.dettaglio}
                </p>
                {piano.dopoTrial && (
                  <p className="mt-1 text-xs text-neutral-400">{piano.dopoTrial}</p>
                )}
                <div className="mt-8">
                  <Link
                    href={piano.href}
                    className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-bold transition-opacity hover:opacity-90 ${
                      piano.evidenziato
                        ? "bg-[#e95624] text-white"
                        : "border border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100"
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

      {/* ── CTA finale ── */}
      <section className="bg-[#1e2d4a] px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-5xl font-extrabold leading-tight tracking-tight text-white">
            Inizia oggi,
            <br />
            <span className="text-[#e95624]">gratis per 3 mesi</span>
          </h2>
          <p className="mt-5 text-lg text-white/50">
            Nessuna carta di credito. Nessun vincolo. Solo il tuo cantiere più organizzato.
          </p>
          <Link
            href="/registrati"
            className="mt-10 inline-flex h-14 items-center rounded-xl bg-[#e95624] px-10 text-lg font-bold text-white shadow-xl shadow-[#e95624]/25 transition-opacity hover:opacity-90"
          >
            Inizia gratis
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#162038] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-white/30">© Cantivo 2026</p>
          <div className="flex gap-6 text-sm text-white/40">
            <Link href="/login" className="transition-colors hover:text-white">Accedi</Link>
            <Link href="/registrati" className="transition-colors hover:text-white">Registrati</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/termini" className="transition-colors hover:text-white">Termini</Link>
          </div>
          <p className="text-xs text-white/20">Powered by Anthropic Claude</p>
        </div>
        <p className="text-xs text-white/20 text-center mt-1">
          Cantivo è un servizio di A2C Sistemi S.r.l. · P.IVA 13078970962
        </p>
      </footer>

    </div>
  )
}
