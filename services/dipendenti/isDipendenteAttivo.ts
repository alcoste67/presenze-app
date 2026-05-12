import { supabase } from "@/lib/supabase";

export async function isDipendenteAttivo(
  email: string
): Promise<boolean> {
  const emailNormalizzata = email
    .trim()
    .toLowerCase();

  if (!emailNormalizzata) {
    return false;
  }

  const { data, error } = await supabase
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
