export type SalFreezeMensile = {
  id: string;
  cantiere_id: string;
  period_start: string;
  period_end: string;
  freeze_at: string;
  created_by: string | null;
  note: string;
  metadata: Record<string, unknown> | null;
  annullato_at: string | null;
  annullato_by: string | null;
};

export type SalFreezeLavorazione = {
  id: string;
  freeze_id: string;
  lavorazione_id: string | null;
  lavorazione_nome_snapshot: string;
  percentuale_precedente: number;
  percentuale_attuale: number;
  delta_percentuale: number;
  ore_uomo_minuti: number;
  ordine: number;
  created_at: string;
};

export type SalFreezeFoto = {
  id: string;
  freeze_id: string;
  cantiere_id?: string;
  sal_foto_id?: string;
  lavorazione_id?: string | null;
  data_riferimento: string;
  storage_path_snapshot: string;
  descrizione: string;
  ordine: number;
  selected_at?: string | null;
  created_at?: string;
};

export type SalFreezeFotoPreview = SalFreezeFoto & {
  preview_url: string | null;
};

export type SalFreezeMacchinario = {
  id: string;
  freeze_id: string;
  macchinario_id: string | null;
  tipo_macchinario_snapshot: string;
  descrizione_snapshot: string;
  ore_utilizzo: number;
  note: string;
  ordine: number;
  created_at: string;
};

export type SalFreezeDettaglio = {
  freeze: SalFreezeMensile;
  lavorazioni: SalFreezeLavorazione[];
  foto: SalFreezeFotoPreview[];
  macchinari: SalFreezeMacchinario[];
};

export type SalFreezeExportCommittente = {
  freeze: SalFreezeMensile;
  cantiere: {
    id: string;
    nome: string;
  } | null;
  lavorazioni: SalFreezeLavorazione[];
  foto: SalFreezeFotoPreview[];
};
