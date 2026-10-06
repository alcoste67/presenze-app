export type StatoPropostaCorrezione = "IN_ATTESA" | "CONFERMATA" | "RIFIUTATA" | "ANNULLATA";

export type TurnoApertoInfo = {
  dipendenteNome: string;
  apertoDalle: string;
  oreNette: number;
  proposteInAttesa: {
    id: string;
    orarioProposto: string;
    creatoIl: string;
  }[];
};

export type DatiCorrezioneTimbratura = {
  dipendenteNome: string;
  turnoAperto: TurnoApertoInfo | null;
};

export type PropostaCorrezioneInfo = {
  id: string;
  stato: StatoPropostaCorrezione;
  orarioProposto: string;
  propostoDaNome: string;
  apertoDalle: string;
};
