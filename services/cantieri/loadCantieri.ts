import { supabase } from "@/lib/supabase";

export async function loadCantieri() {
  const { data, error } = await supabase
    .from("cantieri")
    .select("id, nome")
    .eq("attivo", true)
    .order("nome", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data || [];
}
