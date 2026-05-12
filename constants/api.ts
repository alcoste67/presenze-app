export const API_ROUTES = {
  CREA_DIPENDENTE_CON_AUTH:
    "/api/dipendenti/crea-con-auth",
} as const;

export const API_HEADERS = {
  AUTHORIZATION: "Authorization",
  CONTENT_TYPE: "Content-Type",
  APPLICATION_JSON: "application/json",
  BEARER_PREFIX: "Bearer ",
} as const;
