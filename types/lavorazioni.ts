export type LavorazioneCantiere = {
  id: string;
  cantiere_id: string;
  nome: string;
  ordine: number;
  attiva: boolean;
  percentuale_completamento: number;
  created_at: string;
  categoria?: string | null;
  unita_misura?: string | null;
  quantita?: number | null;
  prezzo_unitario?: number | null;
  note?: string | null;
};

export type LavorazioneCantiereInput = {
  cantiere_id: string;
  nome: string;
  ordine: number;
  attiva: boolean;
  percentuale_completamento: number;
  categoria?: string | null;
  unita_misura?: string | null;
  quantita?: number | null;
  prezzo_unitario?: number | null;
  note?: string | null;
};

export type LavorazioneCantiereUpdate = Omit<
  LavorazioneCantiereInput,
  "cantiere_id"
>;

export type LavorazioneImportPreview = {
  nome: string;
  ordine: number;
  categoria?: string;
  unita_misura?: string;
  quantita?: number;
  prezzo_unitario?: number;
  note?: string;
};
