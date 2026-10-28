import { supabase } from "@/lib/supabase";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";

export type RestrizioneWallboxA2C = {
  /** true se l'azienda è ristretta alla sola checklist Wallbox A2C. */
  ristretto: boolean;
  /** true se, in un'azienda ristretta, l'utente è admin/superadmin: ha
   * accesso anche a "dipendenti" e vede tutto lo storico, non solo le
   * checklist create da lui. */
  isAdmin: boolean;
};

const RESTRIZIONE_DEFAULT: RestrizioneWallboxA2C = {
  ristretto: false,
  isAdmin: false,
};

/**
 * Risolve la restrizione Wallbox A2C per l'utente autenticato (vedi
 * migration 20261028000000_solo_checklist_wallbox_a2c.sql).
 */
export async function checkRestrizioneWallboxA2C(
  userId: string
): Promise<RestrizioneWallboxA2C> {
  try {
    const { data: dipendente } = await supabase
      .from("dipendenti")
      .select("ruolo, azienda_id")
      .eq("auth_user_id", userId)
      .eq("attivo", true)
      .maybeSingle();

    if (!dipendente?.azienda_id) return RESTRIZIONE_DEFAULT;

    const { data: azienda } = await supabase
      .from("aziende")
      .select("solo_checklist_wallbox_a2c")
      .eq("id", dipendente.azienda_id)
      .maybeSingle();

    const isAdmin =
      dipendente.ruolo === RUOLI_DIPENDENTE.ADMIN ||
      dipendente.ruolo === RUOLI_DIPENDENTE.SUPERADMIN;

    return {
      ristretto: Boolean(azienda?.solo_checklist_wallbox_a2c),
      isAdmin,
    };
  } catch {
    return RESTRIZIONE_DEFAULT;
  }
}
