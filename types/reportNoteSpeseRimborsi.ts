import type { NotaSpesa } from "@/types/noteSpese";
import type { RimborsoKmRiga } from "@/types/rimborsiKm";

export type ReportSpeseRimborsiFiltri = {
  anno: number;
  mese: number;
};

export type DipendenteReportSpeseRimborsi = {
  dipendenteId: string;
  dipendente: string;
  noteSpese: NotaSpesa[];
  totaleNoteSpese: number;
  rimborsoKm: RimborsoKmRiga | null;
};
