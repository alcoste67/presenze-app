export const AUTH_OTP = {
  CODICE_LENGTH: 6,
  RESEND_COOLDOWN_SECONDS: 60,
  COOLDOWN_INTERVAL_MS: 1000,
  CODICE_PATTERN: "[0-9]*",
  VERIFY_TYPE_EMAIL: "email",
} as const;

export const AUTH_ERROR_CODES = {
  OTP_EXPIRED: "otp_expired",
  INVALID_CREDENTIALS: "invalid_credentials",
  USER_NOT_FOUND: "user_not_found",
  EMAIL_ADDRESS_INVALID:
    "email_address_invalid",
  EMAIL_ADDRESS_NOT_AUTHORIZED:
    "email_address_not_authorized",
  OVER_REQUEST_RATE_LIMIT:
    "over_request_rate_limit",
  OVER_EMAIL_SEND_RATE_LIMIT:
    "over_email_send_rate_limit",
} as const;

export const AUTH_HTTP_STATUS = {
  TROPPE_RICHIESTE: 429,
} as const;

export const AUTH_TESTI = {
  TITOLO: "PRESENZE APP",
  EMAIL_LABEL: "Email",
  EMAIL_PLACEHOLDER: "Inserisci email",
  CODICE_LABEL: "Codice OTP",
  CODICE_PLACEHOLDER: "000000",
  INVIA_CODICE: "Invia codice",
  INVIO_CODICE: "Invio codice...",
  REINVIA_CODICE: "Reinvia codice",
  VERIFICA_CODICE: "Verifica codice",
  VERIFICA_IN_CORSO: "Verifica codice...",
  COOLDOWN_PREFIX: "Reinvia tra",
  COOLDOWN_SUFFIX: "s",
  CODICE_INVIATO:
    "Codice inviato. Controlla la tua email.",
  ERRORI: {
    EMAIL_OBBLIGATORIA:
      "Inserisci l'email.",
    CODICE_OBBLIGATORIO:
      "Inserisci il codice a 6 cifre.",
    RATE_LIMIT:
      "Hai richiesto troppi codici. Attendi prima di riprovare.",
    CODICE_NON_VALIDO:
      "Codice non valido o scaduto.",
    EMAIL_NON_AUTORIZZATA:
      "Email non autorizzata al login.",
    GENERICO:
      "Errore durante il login. Riprova.",
  },
} as const;
