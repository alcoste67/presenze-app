export type ModuloFotovoltaico = {
  id: string;
  marca: string;
  modello: string;
  potenza_wp: number;
  lunghezza_mm: number;
  larghezza_mm: number;
  spessore_mm: number | null;
  peso_kg: number | null;
  attivo: boolean;
  created_at: string;
  updated_at: string;
};

export type ModuloFotovoltaicoInput = {
  marca: string;
  modello: string;
  potenza_wp: number;
  lunghezza_mm: number;
  larghezza_mm: number;
  spessore_mm: number | null;
  peso_kg: number | null;
  attivo: boolean;
};

// Risultato dell'estrazione AI dalla scheda tecnica PDF: sempre una
// preview editabile, mai salvata automaticamente.
export type ModuloFotovoltaicoImportPreview = {
  marca?: string;
  modello?: string;
  potenza_wp?: number;
  lunghezza_mm?: number;
  larghezza_mm?: number;
  spessore_mm?: number;
  peso_kg?: number;
};
