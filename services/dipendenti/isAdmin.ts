import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { supabase } from "@/lib/supabase";

export async function isAdmin(
  email: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("dipendenti")
    .select("id")
    .eq("email", email)
    .eq("ruolo", RUOLI_DIPENDENTE.ADMIN)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
