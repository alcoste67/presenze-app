export type LavorazioneCantiere = {
  id: string;
  cantiere_id: string;
  nome: string;
  ordine: number;
  attiva: boolean;
  percentuale_completamento: number;
  created_at: string;
};

export type LavorazioneCantiereInput = {
  cantiere_id: string;
  nome: string;
  ordine: number;
  attiva: boolean;
  percentuale_completamento: number;
};

export type LavorazioneCantiereUpdate = Omit<
  LavorazioneCantiereInput,
  "cantiere_id"
>;
