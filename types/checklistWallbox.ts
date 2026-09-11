import type { CHECKLIST_WALLBOX_STATI } from "@/constants/checklistWallbox";

export type StatoChecklistWallbox =
  (typeof CHECKLIST_WALLBOX_STATI)[keyof typeof CHECKLIST_WALLBOX_STATI];

export type ModalitaPosaWallbox = "PARETE" | "TERRA";

export type MaterialeChecklistWallbox = {
  descrizione: string;
  quantita: string;
};

export type ChecklistWallbox = {
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
  posizionamento: string;
  modalita_posa: ModalitaPosaWallbox | null;
  potenza_contatore_kw: string;
  quadro_conforme: boolean | null;
  impianto_a_norma: boolean | null;
  dichiarazione_conformita: boolean | null;
  autorizzazioni_necessarie: boolean | null;
  messa_a_terra: boolean | null;
  installazione_possibile: boolean | null;
  opere_adeguamento_necessarie: boolean | null;
  note: string;
  materiali: MaterialeChecklistWallbox[];
  luogo: string;
  data_sopralluogo: string | null;
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
  nome: string;
  cognome: string;
  via: string;
  comune: string;
  cap: string;
  provincia: string;
  telefono: string;
  email_cliente: string;
  posizionamento: string;
  modalita_posa: ModalitaPosaWallbox | null;
  potenza_contatore_kw: string;
  quadro_conforme: boolean | null;
  impianto_a_norma: boolean | null;
  dichiarazione_conformita: boolean | null;
  autorizzazioni_necessarie: boolean | null;
  messa_a_terra: boolean | null;
  installazione_possibile: boolean | null;
  opere_adeguamento_necessarie: boolean | null;
  note: string;
  materiali: MaterialeChecklistWallbox[];
  luogo: string;
  data_sopralluogo: string | null;
};
