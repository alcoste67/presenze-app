"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { CATEGORIE_LAVORAZIONE_STANDARD } from "@/constants/categorieLavorazione";

import { loadCategorieLavorazione } from "@/services/categorie/loadCategorieLavorazione";
import { creaCategoriaLavorazione } from "@/services/categorie/creaCategoriaLavorazione";
import { aggiornaCategoriaLavorazione } from "@/services/categorie/aggiornaCategoriaLavorazione";
import { eliminaCategoriaLavorazione } from "@/services/categorie/eliminaCategoriaLavorazione";

import type { CategoriaLavorazione } from "@/types/categorie";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { getMessaggioErrore } from "@/lib/errors";

export default function BackofficeCategoriePage() {
  const toast = useToast();

  const [categorie, setCategorie] = useState<CategoriaLavorazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [nuovoNome, setNuovoNome] = useState("");
  const [inModificaId, setInModificaId] = useState<string | null>(null);
  const [nomeModifica, setNomeModifica] = useState("");
  const [daEliminare, setDaEliminare] = useState<CategoriaLavorazione | null>(null);

  const carica = async () => {
    try {
      setLoading(true);
      const dati = await loadCategorieLavorazione();
      setCategorie(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore caricamento categorie"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAggiungi = async (event: FormEvent) => {
    event.preventDefault();
    const nome = nuovoNome.trim();
    if (!nome) return;

    if (categorie.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Categoria già presente");
      return;
    }

    try {
      setSalvataggio(true);
      const creata = await creaCategoriaLavorazione({
        nome,
        ordine: categorie.length,
      });
      setCategorie((c) => [...c, creata]);
      setNuovoNome("");
      toast.success("Categoria aggiunta");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore creazione categoria"));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (categoria: CategoriaLavorazione) => {
    setInModificaId(categoria.id);
    setNomeModifica(categoria.nome);
  };

  const annullaModifica = () => {
    setInModificaId(null);
    setNomeModifica("");
  };

  const handleSalvaModifica = async (id: string) => {
    const nome = nomeModifica.trim();
    if (!nome) return;

    try {
      setSalvataggio(true);
      const aggiornata = await aggiornaCategoriaLavorazione({ id, nome });
      setCategorie((c) => c.map((cat) => (cat.id === id ? aggiornata : cat)));
      annullaModifica();
      toast.success("Categoria aggiornata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiornamento categoria"));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleElimina = async () => {
    if (!daEliminare) return;
    try {
      setSalvataggio(true);
      await eliminaCategoriaLavorazione({ id: daEliminare.id });
      setCategorie((c) => c.filter((cat) => cat.id !== daEliminare.id));
      toast.success("Categoria eliminata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore eliminazione categoria"));
    } finally {
      setSalvataggio(false);
      setDaEliminare(null);
    }
  };

  const handleCaricaStandard = async () => {
    const esistenti = new Set(categorie.map((c) => c.nome.toLowerCase()));
    const daCreare = CATEGORIE_LAVORAZIONE_STANDARD.filter(
      (nome) => !esistenti.has(nome.toLowerCase())
    );
    if (daCreare.length === 0) {
      toast.error("Le categorie standard sono già presenti");
      return;
    }

    try {
      setSalvataggio(true);
      const create: CategoriaLavorazione[] = [];
      let ordine = categorie.length;
      for (const nome of daCreare) {
        create.push(await creaCategoriaLavorazione({ nome, ordine }));
        ordine += 1;
      }
      setCategorie((c) => [...c, ...create]);
      toast.success(`${create.length} categorie standard caricate`);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore caricamento standard"));
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">Back-office</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">Timbrature</Button>
            </Link>
          </>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Categorie lavorazioni
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Macro-aree usate per etichettare e filtrare le lavorazioni (es.
            IMPIANTI ELETTRICI, DATI, DOMOTICA). Sono valide per tutta l&apos;azienda.
          </p>
        </div>

        <Card className="p-4 space-y-4">
          <form onSubmit={handleAggiungi} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-primary mb-1">
                Nuova categoria
              </label>
              <Input
                value={nuovoNome}
                onChange={(e) => setNuovoNome(e.target.value)}
                placeholder="Es. IMPIANTI ELETTRICI"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              loading={salvataggio}
              disabled={!nuovoNome.trim()}
            >
              Aggiungi
            </Button>
          </form>

          {categorie.length === 0 && !loading && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles className="h-4 w-4" />}
              loading={salvataggio}
              onClick={() => void handleCaricaStandard()}
            >
              Carica categorie standard
            </Button>
          )}
        </Card>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <p className="text-sm text-text-muted p-4">Caricamento…</p>
          ) : categorie.length === 0 ? (
            <p className="text-sm text-text-muted p-4">
              Nessuna categoria. Aggiungine una o carica le standard.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {categorie.map((categoria) => (
                <li
                  key={categoria.id}
                  className="flex items-center gap-2 p-3 hover:bg-bg-subtle transition-colors"
                >
                  {inModificaId === categoria.id ? (
                    <>
                      <Input
                        value={nomeModifica}
                        onChange={(e) => setNomeModifica(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Check className="h-4 w-4" />}
                        loading={salvataggio}
                        onClick={() => void handleSalvaModifica(categoria.id)}
                      >
                        Salva
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<X className="h-4 w-4" />}
                        disabled={salvataggio}
                        onClick={annullaModifica}
                      >
                        Annulla
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-text-primary">
                        {categoria.nome}
                      </span>
                      <button
                        type="button"
                        aria-label="Modifica"
                        className="p-2 text-text-muted hover:text-text-primary transition-colors"
                        onClick={() => avviaModifica(categoria)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Elimina"
                        className="p-2 text-text-muted hover:text-error-600 transition-colors"
                        onClick={() => setDaEliminare(categoria)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      {daEliminare && (
        <ConfirmDialog
          title="Elimina categoria"
          message={`Eliminare la categoria «${daEliminare.nome}»? Le lavorazioni già etichettate manterranno il nome scritto, ma non sarà più nell'elenco.`}
          confirmLabel="Elimina"
          onConfirm={() => void handleElimina()}
          onCancel={() => setDaEliminare(null)}
        />
      )}
    </div>
  );
}
