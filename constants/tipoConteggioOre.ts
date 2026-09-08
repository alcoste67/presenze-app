export const TIPO_CONTEGGIO_ORE = {
  REALE: "REALE",
  GIORNATA_FORFAIT_8H: "GIORNATA_FORFAIT_8H",
  GIORNATA_FORFAIT_4H: "GIORNATA_FORFAIT_4H",
} as const;

type TipoConteggioOreValue =
  (typeof TIPO_CONTEGGIO_ORE)[keyof typeof TIPO_CONTEGGIO_ORE];

export const LABEL_TIPO_CONTEGGIO_ORE: Record<
  TipoConteggioOreValue,
  string
> = {
  [TIPO_CONTEGGIO_ORE.REALE]: "Reale",
  [TIPO_CONTEGGIO_ORE.GIORNATA_FORFAIT_8H]:
    "Giornata forfait 8h",
  [TIPO_CONTEGGIO_ORE.GIORNATA_FORFAIT_4H]:
    "Giornata forfait 4h",
};

export const TIPO_CONTEGGIO_ORE_TESTI = {
  LABEL: "Tipo conteggio ore",
} as const;
