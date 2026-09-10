export type PianificazioneMembro = {
  dipendenteId: string;
  nome: string;
};

export type PianificazioneMacchinario = {
  macchinarioId: string;
  nome: string;
};

export type PianificazioneLavoro = {
  id: string;
  cantiereId: string;
  cantiereNome: string;
  data: string;
  note: string;
  squadra: PianificazioneMembro[];
  macchinari: PianificazioneMacchinario[];
  creatoDaId: string;
  createdAt: string;
};

export type PianificazioniFiltri = {
  dataInizio: string;
  dataFine: string;
};

export type PianificazioneInput = {
  cantiereId: string;
  data: string;
  note: string;
  dipendentiIds: string[];
  macchinariIds: string[];
};

export type PianificazioniRisposta = {
  pianificazioni: PianificazioneLavoro[];
  puoModificare: boolean;
};
