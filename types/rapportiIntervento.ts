import type {
  RAPPORTI_INTERVENTO_REGOLE,
  RAPPORTI_INTERVENTO_STATI,
} from "@/constants/rapportiIntervento";

export type StatoRapportoIntervento =
  (typeof RAPPORTI_INTERVENTO_STATI)[keyof typeof RAPPORTI_INTERVENTO_STATI];

export type RegolaFatturazioneIntervento =
  (typeof RAPPORTI_INTERVENTO_REGOLE)[keyof typeof RAPPORTI_INTERVENTO_REGOLE];

export type RapportoIntervento = {
  id: string;
  cantiere_id: string;
  cantiere_nome_snapshot: string;
  cantiere_indirizzo_snapshot: string;
  data_intervento: string;
  cliente_committente: string;
  responsabile_nome: string;
  ore_uomo_reali_minuti: number;
  viaggio_minuti: number;
  diritto_uscita: boolean;
  regola_fatturazione: RegolaFatturazioneIntervento;
  ore_fatturabili_minuti: number;
  note: string;
  firma_responsabile_data_url: string | null;
  firma_responsabile_nome: string | null;
  firma_responsabile_at: string | null;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string | null;
  firma_cliente_at: string | null;
  stato: StatoRapportoIntervento;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RapportoInterventoLavorazione = {
  id: string;
  rapporto_intervento_id: string;
  lavorazione_id: string | null;
  descrizione_snapshot: string;
  ore_uomo_minuti: number;
  ordine: number;
  created_at: string;
};

export type RapportoInterventoCompleto =
  RapportoIntervento & {
    lavorazioni: RapportoInterventoLavorazione[];
  };

export type RapportoInterventoLavorazioneInput = {
  lavorazione_id: string | null;
  descrizione_snapshot: string;
  ore_uomo_minuti: number;
  ordine: number;
};

export type RapportoInterventoInput = {
  cantiere_id: string;
  data_intervento: string;
  cliente_committente: string;
  responsabile_nome: string;
  viaggio_minuti: number;
  diritto_uscita: boolean;
  note: string;
  firma_responsabile_data_url: string | null;
  firma_responsabile_nome: string | null;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string | null;
  lavorazioni: RapportoInterventoLavorazioneInput[];
};

export type RapportoInterventoLavorazioneSnapshot =
  RapportoInterventoLavorazioneInput;

export type CalcoloOreFatturabiliIntervento = {
  regola_fatturazione: RegolaFatturazioneIntervento;
  ore_fatturabili_minuti: number;
};
