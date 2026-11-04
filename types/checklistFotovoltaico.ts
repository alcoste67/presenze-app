import type { CHECKLIST_FOTOVOLTAICO_STATI } from "@/constants/checklistFotovoltaico";

export type StatoChecklistFotovoltaico =
  (typeof CHECKLIST_FOTOVOLTAICO_STATI)[keyof typeof CHECKLIST_FOTOVOLTAICO_STATI];

export type MaterialeChecklistFotovoltaico = {
  descrizione: string;
  quantita: string;
};

export type ChecklistFotovoltaico = {
  id: string;
  azienda_id: string;

  ragione_sociale: string;
  piva: string;
  nome: string;
  cognome: string;
  via: string;
  comune: string;
  cap: string;
  provincia: string;
  telefono: string;
  email_cliente: string;

  tipo_copertura: string;
  orientamento_falda: string;
  inclinazione_falda_gradi: number | null;
  superficie_falda_mq: number | null;
  ombreggiamenti_presenti: boolean | null;
  note_ombreggiamenti: string;

  potenza_contatore_kw: string;
  quadro_conforme: boolean | null;
  impianto_a_norma: boolean | null;
  dichiarazione_conformita: boolean | null;
  autorizzazioni_necessarie: boolean | null;
  messa_a_terra: boolean | null;
  struttura_idonea: boolean | null;
  opere_adeguamento_necessarie: boolean | null;

  consumo_f1_kwh: number | null;
  consumo_f2_kwh: number | null;
  consumo_f3_kwh: number | null;
  pompa_calore_attiva: boolean;
  pompa_calore_kwh_anno: number;
  auto_elettrica_attiva: boolean;
  auto_elettrica_kwh_anno: number;
  induzione_attiva: boolean;
  induzione_kwh_anno: number;
  altro_attivo: boolean;
  altro_descrizione: string;
  altro_kwh_anno: number;
  resa_kwh_per_kwp: number;
  fattore_occupazione_falda: number;
  margine_batteria: number;
  modulo_fotovoltaico_id: string | null;

  fabbisogno_totale_kwh: number | null;
  potenza_consigliata_kwp: number | null;
  potenza_massima_kwp: number | null;
  numero_moduli_max: number | null;
  batteria_consigliata_kwh: number | null;

  materiali: MaterialeChecklistFotovoltaico[];

  planimetria_data_url: string | null;

  note: string;
  luogo: string;
  data_sopralluogo: string | null;

  firma_tecnico_data_url: string | null;
  firma_tecnico_nome: string | null;
  firma_tecnico_at: string | null;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string | null;
  firma_cliente_at: string | null;

  stato: StatoChecklistFotovoltaico;
  created_by: string | null;
  inviato_il: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistFotovoltaicoInput = {
  ragione_sociale: string;
  piva: string;
  nome: string;
  cognome: string;
  via: string;
  comune: string;
  cap: string;
  provincia: string;
  telefono: string;
  email_cliente: string;

  tipo_copertura: string;
  orientamento_falda: string;
  inclinazione_falda_gradi: number | null;
  superficie_falda_mq: number | null;
  ombreggiamenti_presenti: boolean | null;
  note_ombreggiamenti: string;

  potenza_contatore_kw: string;
  quadro_conforme: boolean | null;
  impianto_a_norma: boolean | null;
  dichiarazione_conformita: boolean | null;
  autorizzazioni_necessarie: boolean | null;
  messa_a_terra: boolean | null;
  struttura_idonea: boolean | null;
  opere_adeguamento_necessarie: boolean | null;

  consumo_f1_kwh: number | null;
  consumo_f2_kwh: number | null;
  consumo_f3_kwh: number | null;
  pompa_calore_attiva: boolean;
  pompa_calore_kwh_anno: number;
  auto_elettrica_attiva: boolean;
  auto_elettrica_kwh_anno: number;
  induzione_attiva: boolean;
  induzione_kwh_anno: number;
  altro_attivo: boolean;
  altro_descrizione: string;
  altro_kwh_anno: number;
  resa_kwh_per_kwp: number;
  fattore_occupazione_falda: number;
  margine_batteria: number;
  modulo_fotovoltaico_id: string | null;

  materiali: MaterialeChecklistFotovoltaico[];

  planimetria_data_url: string | null;

  note: string;
  luogo: string;
  data_sopralluogo: string | null;
};
