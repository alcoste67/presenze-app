import { supabase } from "@/lib/supabase";

type SupabaseClient = typeof supabase;

export async function isDipendenteAttivoSupabase(
  email: string,
  supabaseClient: SupabaseClient = supabase
): Promise<boolean> {
  const emailNormalizzata = email
    .trim()
    .toLowerCase();

  if (!emailNormalizzata) {
    return false;
  }

  const { data, error } = await supabaseClient
    .from("dipendenti")
    .select("id")
    .ilike("email", emailNormalizzata)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
