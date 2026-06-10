// Stringa libera: snapshot del nome tipo al momento della registrazione
// (i tipi sono gestiti a DB, tabella tipi_macchinario)
export type TipoMacchinario = string;

export type CostoMacchinarioCommessa = {
  id: string;
  cantiere_id: string;
  rapporto_intervento_id: string | null;
  macchinario_id: string | null;
  tipo_macchinario: TipoMacchinario;
  descrizione: string;
  data_utilizzo: string;
  ore_utilizzo: number;
  tariffa_oraria: number | null;
  costo_totale: number | null;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CostoMacchinarioCommessaPubblico = Pick<
  CostoMacchinarioCommessa,
  | "id"
  | "cantiere_id"
  | "rapporto_intervento_id"
  | "macchinario_id"
  | "tipo_macchinario"
  | "descrizione"
  | "data_utilizzo"
  | "ore_utilizzo"
  | "note"
  | "created_by"
  | "created_at"
  | "updated_at"
>;

export type CostoMacchinarioCommessaInput = {
  cantiere_id: string;
  rapporto_intervento_id: string | null;
  macchinario_id: string | null;
  tipo_macchinario: TipoMacchinario;
  descrizione: string;
  data_utilizzo: string;
  ore_utilizzo: number;
  tariffa_oraria: number | null;
  costo_totale: number | null;
  note: string;
};
