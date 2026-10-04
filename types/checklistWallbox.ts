import type { CHECKLIST_WALLBOX_STATI } from "@/constants/checklistWallbox";

export type StatoChecklistWallbox =
  (typeof CHECKLIST_WALLBOX_STATI)[keyof typeof CHECKLIST_WALLBOX_STATI];

export type ModalitaPosaWallbox = "PARETE" | "TERRA";

export type FormatoChecklistWallbox = "EDISON" | "A2C";

export type PosizionamentoTipoWallbox =
  | "BOX_SINGOLO"
  | "CONDOMINIO"
  | "PARCHEGGIO_APERTO"
  | "ALTRO";

export type MaterialeChecklistWallbox = {
  descrizione: string;
  quantita: string;
};

export type ChecklistWallbox = {
  id: string;
  azienda_id: string;
  ragione_sociale: string;
  piva: string;
  codice_ditta: string;
  nome: string;
  cognome: string;
  via: string;
  comune: string;
  cap: string;
  provincia: string;
  telefono: string;
  email_cliente: string;
  posizionamento: string;
  posizionamento_tipo: PosizionamentoTipoWallbox | null;
  modalita_posa: ModalitaPosaWallbox | null;
  potenza_contatore_kw: string;
  stabile_cpi: boolean | null;
  obbligo_progetto_elettrico: boolean | null;
  autorizzazioni_necessarie: boolean | null;
  messa_a_terra: boolean | null;
  misura_terra_ohm: string;
  installazione_possibile: boolean | null;
  descrizione_percorso_cavi: string;
  note: string;
  materiali: MaterialeChecklistWallbox[];
  cavo_altro_descrizione: string;
  cavo_altro_quantita: string;
  interruttore_altro_descrizione: string;
  interruttore_altro_quantita: string;
  materiali_altro: MaterialeChecklistWallbox[];
  planimetria_data_url: string | null;
  luogo: string;
  data_sopralluogo: string | null;
  formato_stampa: FormatoChecklistWallbox;
  firma_tecnico_data_url: string | null;
  firma_tecnico_nome: string | null;
  firma_tecnico_at: string | null;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string | null;
  firma_cliente_at: string | null;
  stato: StatoChecklistWallbox;
  created_by: string | null;
  inviato_il: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistWallboxInput = {
  ragione_sociale: string;
  piva: string;
  codice_ditta: string;
  nome: string;
  cognome: string;
  via: string;
  comune: string;
  cap: string;
  provincia: string;
  telefono: string;
  email_cliente: string;
  posizionamento: string;
  posizionamento_tipo: PosizionamentoTipoWallbox | null;
  modalita_posa: ModalitaPosaWallbox | null;
  potenza_contatore_kw: string;
  stabile_cpi: boolean | null;
  obbligo_progetto_elettrico: boolean | null;
  autorizzazioni_necessarie: boolean | null;
  messa_a_terra: boolean | null;
  misura_terra_ohm: string;
  installazione_possibile: boolean | null;
  descrizione_percorso_cavi: string;
  note: string;
  materiali: MaterialeChecklistWallbox[];
  cavo_altro_descrizione: string;
  cavo_altro_quantita: string;
  interruttore_altro_descrizione: string;
  interruttore_altro_quantita: string;
  materiali_altro: MaterialeChecklistWallbox[];
  planimetria_data_url: string | null;
  luogo: string;
  data_sopralluogo: string | null;
  formato_stampa: FormatoChecklistWallbox;
};
