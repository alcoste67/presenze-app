export type BloccoGiornoPrecedente =
  | {
      tipo: "TURNO_APERTO";
      apertoDalle: string;
      oreNette: number;
    }
  | {
      tipo: "GIORNATA_VUOTA";
      data: string;
    };
