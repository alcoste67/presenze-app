// Il tipo macchinario è gestito a DB (tabella tipi_macchinario, per
// azienda). La stringa `tipo` resta come snapshot/compatibilità con i
// vecchi codici (SCAVATORE, PLE, ...).
export type TipoMacchinario = string;

export type TipoMacchinarioRecord = {
  id: string;
  nome: string;
  attivo: boolean;
};

export type Macchinario = {
  id: string;
  nome: string;
  tipo: TipoMacchinario;
  tipo_id: string | null;
  descrizione: string;
  costo_orario: number | null;
  attivo: boolean;
  created_at: string;
  updated_at: string;
};

export type MacchinarioPubblico = Pick<
  Macchinario,
  "id" | "nome" | "tipo" | "tipo_id" | "descrizione" | "attivo"
> & {
  tipo_nome: string | null;
};

export type MacchinarioInput = {
  nome: string;
  tipo: TipoMacchinario;
  tipo_id: string | null;
  descrizione: string;
  costo_orario: number | null;
  attivo: boolean;
};
