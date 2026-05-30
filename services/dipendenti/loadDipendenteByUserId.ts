import { supabase } from "@/lib/supabase";

export type DipendenteBase = {
  nome: string;
  cognome: string;
  ruolo: string;
};

export async function loadDipendenteByUserId(
  userId: string
): Promise<DipendenteBase | null> {
  const { data, error } = await supabase
    .from("dipendenti")
    .select("nome, cognome, ruolo")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
