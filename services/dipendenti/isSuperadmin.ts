import { supabase } from "@/lib/supabase";

const RUOLO_SUPERADMIN = "SUPERADMIN" as const;

export async function isSuperadmin(
  email: string,
  supabaseClient: typeof supabase = supabase
): Promise<boolean> {
  const emailNormalizzata = email.trim().toLowerCase();

  const { data, error } = await supabaseClient
    .from("dipendenti")
    .select("id")
    .ilike("email", emailNormalizzata)
    .eq("ruolo", RUOLO_SUPERADMIN)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}
