// Accesso al pannello multi-azienda (/superadmin): NON deve dipendere dal
// ruolo "Superadmin" di un dipendente (quello è un ruolo interno alla
// singola azienda, liberamente assegnabile da qualsiasi admin cliente —
// usarlo per il pannello piattaforma avrebbe permesso a un cliente
// qualsiasi di darsi accesso a TUTTE le aziende). L'unica lista valida è
// questa env var, impostata solo su Vercel dal titolare della piattaforma.
function getEmailAutorizzate(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email: string): boolean {
  const emailNormalizzata = email.trim().toLowerCase();
  return getEmailAutorizzate().includes(emailNormalizzata);
}
