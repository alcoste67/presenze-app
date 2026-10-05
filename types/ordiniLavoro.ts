import type { ORDINI_LAVORO_STATI } from "@/constants/ordiniLavoro";

export type StatoOrdineLavoro =
  (typeof ORDINI_LAVORO_STATI)[keyof typeof ORDINI_LAVORO_STATI];

export type ModalitaPagamentoOrdineLavoro = "BOLLETTA" | "CARTA";

export type VoceElencoOrdineLavoro = {
  descrizione: string;
  importo: string;
};

export type OrdineLavoroEdison = {
  id: string;
  azienda_id: string;
  checklist_wallbox_id: string | null;

  intervento_numero: string;
  data: string | null;
  ora_dalle: string;
  ora_alle: string;

  tecnico_societa: string;
  tecnico_nome: string;

  cliente_nome_cognome: string;
  cliente_indirizzo: string;
  cliente_civico: string;
  cliente_comune: string;
  cliente_cap: string;
  cliente_provincia: string;
  cliente_telefono: string;
  cliente_email: string;

  tipologia_24_7: boolean;
  tipologia_caldaia: boolean;
  tipologia_scaldabagno: boolean;
  tipologia_climatizzatore: boolean;
  tipologia_elettrodomestico: boolean;
  tipologia_varie: boolean;

  dettaglio_manodopera_compresa: boolean;
  dettaglio_manodopera_a_pagamento: boolean;
  dettaglio_ore_manodopera_extra: string;
  dettaglio_pezzi_ricambio: boolean;
  dettaglio_preventivo: boolean;
  dettaglio_riparazione: boolean;
  dettaglio_manutenzione: boolean;

  dettaglio_impianti: string;
  dettaglio_intervento_eseguito: string;

  elenco_interventi: VoceElencoOrdineLavoro[];

  prescrizione_sicurezza: boolean | null;
  prescrizione_motivo: string;

  osservazioni: string;

  modalita_pagamento: ModalitaPagamentoOrdineLavoro | null;

  luogo: string;

  firma_tecnico_data_url: string | null;
  firma_tecnico_nome: string | null;
  firma_tecnico_at: string | null;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string | null;
  firma_cliente_at: string | null;

  stato: StatoOrdineLavoro;
  created_by: string | null;
  inviato_il: string | null;
  created_at: string;
  updated_at: string;
};

export type OrdineLavoroEdisonInput = {
  checklist_wallbox_id: string | null;
  intervento_numero: string;
  data: string | null;
  ora_dalle: string;
  ora_alle: string;
  tecnico_societa: string;
  tecnico_nome: string;
  cliente_nome_cognome: string;
  cliente_indirizzo: string;
  cliente_civico: string;
  cliente_comune: string;
  cliente_cap: string;
  cliente_provincia: string;
  cliente_telefono: string;
  cliente_email: string;
  tipologia_24_7: boolean;
  tipologia_caldaia: boolean;
  tipologia_scaldabagno: boolean;
  tipologia_climatizzatore: boolean;
  tipologia_elettrodomestico: boolean;
  tipologia_varie: boolean;
  dettaglio_manodopera_compresa: boolean;
  dettaglio_manodopera_a_pagamento: boolean;
  dettaglio_ore_manodopera_extra: string;
  dettaglio_pezzi_ricambio: boolean;
  dettaglio_preventivo: boolean;
  dettaglio_riparazione: boolean;
  dettaglio_manutenzione: boolean;
  dettaglio_impianti: string;
  dettaglio_intervento_eseguito: string;
  elenco_interventi: VoceElencoOrdineLavoro[];
  prescrizione_sicurezza: boolean | null;
  prescrizione_motivo: string;
  osservazioni: string;
  modalita_pagamento: ModalitaPagamentoOrdineLavoro | null;
  luogo: string;
};
