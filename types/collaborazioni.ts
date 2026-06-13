export type StatoCollaborazione = "invitata" | "accettata" | "revocata";

export type Collaborazione = {
  id: string;
  cantiere_committente_id: string;
  azienda_committente_id: string;
  cantiere_committente_nome: string;
  azienda_committente_nome: string;
  email_invito: string;
  azienda_collaboratrice_id: string | null;
  azienda_collaboratrice_nome: string;
  cantiere_collaboratore_id: string | null;
  cantiere_collaboratore_nome: string;
  stato: StatoCollaborazione;
  novita_per_collaboratore: boolean;
  novita_per_committente: boolean;
  creato_il: string;
  accettato_il: string | null;
};
