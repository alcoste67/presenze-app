export type StatoPropostaCorrezione = "IN_ATTESA" | "CONFERMATA" | "RIFIUTATA";

export type TurnoApertoInfo = {
  dipendenteNome: string;
  apertoDalle: string;
  oreNette: number;
  propostaInAttesa: {
    id: string;
    orarioProposto: string;
    creatoIl: string;
  } | null;
};

export type PropostaCorrezioneInfo = {
  id: string;
  stato: StatoPropostaCorrezione;
  orarioProposto: string;
  propostoDaNome: string;
  apertoDalle: string;
};
