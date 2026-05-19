export type TimbraturaLavorazione = {
  id: string;
  timbratura_id: string;
  lavorazione_id: string;
  percentuale_avanzamento: number | null;
  created_at: string;
};

export type TimbraturaLavorazioneInput = {
  lavorazioneId: string;
  percentualeAvanzamento: number | null;
};
