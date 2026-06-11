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
  cliente_id: string | null;
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

export type RapportoInterventoOperatore = {
  id: string;
  rapporto_intervento_id: string;
  dipendente_id: string | null;
  nome_snapshot: string;
  email_snapshot: string | null;
  ore_minuti: number;
  ordine: number;
  created_at: string;
};

export type RapportoInterventoFoto = {
  id: string;
  rapporto_intervento_id: string;
  immagine_data_url: string;
  descrizione: string;
  ordine: number;
  created_at: string;
};

export type RapportoInterventoMateriale = {
  id: string;
  rapporto_intervento_id: string;
  descrizione: string;
  quantita: number;
  unita_misura: string;
  ordine: number;
  created_at: string;
};

export type RapportoInterventoExtra = {
  id: string;
  rapporto_intervento_id: string;
  descrizione: string;
  ore_minuti: number;
  note: string;
  ordine: number;
  created_at: string;
};

export type RapportoInterventoCompleto =
  RapportoIntervento & {
    lavorazioni: RapportoInterventoLavorazione[];
    operatori: RapportoInterventoOperatore[];
    foto: RapportoInterventoFoto[];
    materiali: RapportoInterventoMateriale[];
    extra: RapportoInterventoExtra[];
  };

export type RapportoInterventoLavorazioneInput = {
  lavorazione_id: string | null;
  descrizione_snapshot: string;
  ore_uomo_minuti: number;
  ordine: number;
};

export type RapportoInterventoFotoInput = {
  immagine_data_url: string;
  descrizione: string;
  ordine: number;
};

export type RapportoInterventoOperatoreInput = {
  dipendente_id: string | null;
  nome_snapshot: string;
  email_snapshot: string | null;
  ore_minuti: number;
  ordine: number;
};

export type RapportoInterventoMaterialeInput = {
  descrizione: string;
  quantita: number;
  unita_misura: string;
  ordine: number;
};

export type RapportoInterventoExtraInput = {
  descrizione: string;
  ore_minuti: number;
  note: string;
  ordine: number;
};

export type RapportoInterventoInput = {
  cantiere_id: string;
  data_intervento: string;
  cliente_committente: string;
  cliente_id: string | null;
  responsabile_nome: string;
  viaggio_minuti: number;
  diritto_uscita: boolean;
  note: string;
  firma_responsabile_data_url: string | null;
  firma_responsabile_nome: string | null;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string | null;
  lavorazioni: RapportoInterventoLavorazioneInput[];
  operatori: RapportoInterventoOperatoreInput[];
  foto: RapportoInterventoFotoInput[];
  materiali: RapportoInterventoMaterialeInput[];
  extra: RapportoInterventoExtraInput[];
};

export type RapportoInterventoLavorazioneSnapshot =
  RapportoInterventoLavorazioneInput;

export type CalcoloOreFatturabiliIntervento = {
  regola_fatturazione: RegolaFatturazioneIntervento;
  ore_fatturabili_minuti: number;
};
