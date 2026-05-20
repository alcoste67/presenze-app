export const API_ROUTES = {
  CREA_DIPENDENTE_CON_AUTH:
    "/api/dipendenti/crea-con-auth",
  ELIMINA_CANTIERE_SE_VUOTO:
    "/api/cantieri/elimina-se-vuoto",
  ELIMINA_DIPENDENTE_SE_VUOTO:
    "/api/dipendenti/elimina-se-vuoto",
  LAVORAZIONI_ESTRAI_DA_COMPUTO:
    "/api/lavorazioni/estrai-da-computo",
  REPORT_LIBRO_PRESENZE:
    "/api/report/libro-presenze",
  REPORT_PRESENZE:
    "/api/report/presenze",
  VERIFICA_DIPENDENTE_ATTIVO:
    "/api/dipendenti/verifica-attivo",
} as const;

export const API_HEADERS = {
  AUTHORIZATION: "Authorization",
  CONTENT_TYPE: "Content-Type",
  APPLICATION_JSON: "application/json",
  BEARER_PREFIX: "Bearer ",
} as const;
