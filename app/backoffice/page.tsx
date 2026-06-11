"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart2,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Contact,
  FileText,
  Home,
  ListCheck,
  MapPin,
  ShieldAlert,
  Users,
} from "lucide-react";

import { COMMESSA_TESTI } from "@/constants/commessa";
import { LAVORAZIONI_TESTI } from "@/constants/lavorazioni";
import { MACCHINARI_TESTI } from "@/constants/macchinari";
import { PRODUTTIVITA_TESTI } from "@/constants/produttivita";
import { RAPPORTI_INTERVENTO_TESTI } from "@/constants/rapportiIntervento";
import { REPORT_LIBRO_PRESENZE_TESTI } from "@/constants/reportLibroPresenze";
import { REPORT_PRESENZE_TESTI } from "@/constants/reportPresenze";
import { SAL_FREEZE_TESTI } from "@/constants/salFreeze";
import { APP_ROUTES } from "@/constants/routes";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { CardMacchinariAdmin } from "@/components/backoffice/CardMacchinariAdmin";
import { CardControlloCostiAdmin } from "@/components/backoffice/CardControlloCostiAdmin";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isSuperadmin } from "@/services/dipendenti/isSuperadmin";

function ModuloCard({
  href,
  icon,
  nome,
  descrizione,
}: {
  href: string;
  icon: ReactNode;
  nome: string;
  descrizione: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 p-4 bg-bg-card border border-border rounded-lg transition-all duration-150 hover:border-border-strong hover:bg-bg-base hover:-translate-y-px"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
        {icon}
      </div>
      <div>
        <p className="font-heading text-[15px] font-medium text-text-primary">{nome}</p>
        <p className="mt-0.5 text-xs text-text-muted">{descrizione}</p>
      </div>
    </Link>
  );
}

export default function BackofficePage() {
  const [superadmin, setSuperadmin] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [loadingRuolo, setLoadingRuolo] = useState(true);

  useEffect(() => {
    const controlla = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!user?.email) return;
        const [adminOk, superadminOk] = await Promise.all([
          isAdmin(user.email),
          isSuperadmin(user.email),
        ]);
        setAdmin(adminOk);
        setSuperadmin(superadminOk);
      } catch {
        // silently ignore — user simply won't see the sections
      } finally {
        setLoadingRuolo(false);
      }
    };
    void controlla();
  }, []);

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.HOME}>
            <Button variant="secondary" size="sm">
              {RAPPORTI_INTERVENTO_TESTI.TIMBRATURE}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-6 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link
            href={APP_ROUTES.HOME}
            className="hover:text-text-primary transition-colors duration-150"
          >
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {PRODUTTIVITA_TESTI.BACKOFFICE}
          </span>
        </nav>

        {/* Titolo */}
        <div className="mb-8">
          <h1 className="font-heading text-[28px] font-medium text-text-primary">
            {PRODUTTIVITA_TESTI.BACKOFFICE}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Gestione anagrafiche, lavorazioni, SAL e reportistica
          </p>
        </div>

        {/* ── Vista responsabile: solo moduli operativi ── */}
        {!loadingRuolo && !admin && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Operatività
            </h2>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-3">
              <ModuloCard
                href="/backoffice/rapporti-intervento"
                icon={<ClipboardList className="h-5 w-5" />}
                nome={RAPPORTI_INTERVENTO_TESTI.TITOLO}
                descrizione={RAPPORTI_INTERVENTO_TESTI.CARD_DESCRIZIONE}
              />
              <ModuloCard
                href="/backoffice/costi-macchinari"
                icon={<Calculator className="h-5 w-5" />}
                nome={MACCHINARI_TESTI.TITOLO}
                descrizione={MACCHINARI_TESTI.CARD_DESCRIZIONE}
              />
            </div>
          </section>
        )}

        {admin && (
        <div className="flex flex-col gap-8">
          {/* ── Sezione 1: Anagrafiche ── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Anagrafiche
            </h2>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-3">
              <ModuloCard
                href="/backoffice/dipendenti"
                icon={<Users className="h-5 w-5" />}
                nome="Dipendenti"
                descrizione="Gestione anagrafica dipendenti"
              />
              <ModuloCard
                href="/backoffice/cantieri"
                icon={<MapPin className="h-5 w-5" />}
                nome="Cantieri"
                descrizione="Gestione anagrafica cantieri"
              />
              <ModuloCard
                href="/backoffice/clienti"
                icon={<Contact className="h-5 w-5" />}
                nome="Clienti"
                descrizione="Anagrafica clienti e committenti"
              />
              <CardMacchinariAdmin />
            </div>
          </section>

          {/* ── Sezione 2: Operatività ── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Operatività
            </h2>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-3">
              <ModuloCard
                href="/backoffice/lavorazioni"
                icon={<ListCheck className="h-5 w-5" />}
                nome={LAVORAZIONI_TESTI.TITOLO}
                descrizione={LAVORAZIONI_TESTI.CARD_DESCRIZIONE}
              />
              <ModuloCard
                href="/backoffice/rapporti-intervento"
                icon={<ClipboardList className="h-5 w-5" />}
                nome={RAPPORTI_INTERVENTO_TESTI.TITOLO}
                descrizione={RAPPORTI_INTERVENTO_TESTI.CARD_DESCRIZIONE}
              />
              <ModuloCard
                href="/backoffice/commessa"
                icon={<BarChart3 className="h-5 w-5" />}
                nome={COMMESSA_TESTI.TITOLO}
                descrizione={COMMESSA_TESTI.CARD_DESCRIZIONE}
              />
            </div>
          </section>

          {/* ── Sezione 3: Contabilità e report ── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Contabilità e report
            </h2>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-3">
              <ModuloCard
                href="/backoffice/sal"
                icon={<FileText className="h-5 w-5" />}
                nome="SAL corrente"
                descrizione="Avanzamento lavorazioni in tempo reale"
              />
              <ModuloCard
                href="/backoffice/sal-freeze"
                icon={<CalendarRange className="h-5 w-5" />}
                nome={SAL_FREEZE_TESTI.TITOLO}
                descrizione="Consolidato periodico per export contabile multi-cantiere"
              />
              <ModuloCard
                href="/backoffice/produttivita"
                icon={<BarChart2 className="h-5 w-5" />}
                nome={PRODUTTIVITA_TESTI.TITOLO}
                descrizione={PRODUTTIVITA_TESTI.CARD_DESCRIZIONE}
              />
              <ModuloCard
                href="/backoffice/presenze"
                icon={<CalendarDays className="h-5 w-5" />}
                nome={REPORT_PRESENZE_TESTI.TITOLO}
                descrizione={REPORT_PRESENZE_TESTI.CARD_DESCRIZIONE}
              />
              <ModuloCard
                href="/backoffice/libro-presenze"
                icon={<BookOpen className="h-5 w-5" />}
                nome={REPORT_LIBRO_PRESENZE_TESTI.TITOLO}
                descrizione={REPORT_LIBRO_PRESENZE_TESTI.CARD_DESCRIZIONE}
              />
              <ModuloCard
                href="/backoffice/costi-macchinari"
                icon={<Calculator className="h-5 w-5" />}
                nome={MACCHINARI_TESTI.TITOLO}
                descrizione={MACCHINARI_TESTI.CARD_DESCRIZIONE}
              />
              <CardControlloCostiAdmin />
            </div>
          </section>

          {/* ── Sezione 4: Piattaforma (solo superadmin) ── */}
          {superadmin && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Piattaforma
              </h2>
              <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-3">
                <ModuloCard
                  href={APP_ROUTES.SUPERADMIN}
                  icon={<ShieldAlert className="h-5 w-5" />}
                  nome="Superadmin"
                  descrizione="Gestione aziende e utenti della piattaforma"
                />
              </div>
            </section>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
