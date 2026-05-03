import { ATTIVITA } from "@/constants/attivita";

export type TipoAttivita =
  (typeof ATTIVITA)[keyof typeof ATTIVITA];
