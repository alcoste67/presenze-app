import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { supabase } from "@/lib/supabase";

export async function isAdmin(
  email: string,
  supabaseClient: typeof supabase = supabase
): Promise<boolean> {
  const emailNormalizzata = email
    .trim()
    .toLowerCase();

  const { data, error } = await supabaseClient
    .from("dipendenti")
    .select("id")
    .ilike("email", emailNormalizzata)
    .eq("ruolo", RUOLI_DIPENDENTE.ADMIN)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
