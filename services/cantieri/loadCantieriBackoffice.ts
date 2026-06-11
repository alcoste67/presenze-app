import { supabase } from "@/lib/supabase";
import { CantiereBackoffice } from "@/types/cantieri";

export async function loadCantieriBackoffice(): Promise<
  CantiereBackoffice[]
> {
  const { data, error } = await supabase
    .from("cantieri")
    .select(
      "id, nome, indirizzo, lavorazioni, attivo, cliente_id"
    )
    .order("nome", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data || []) as CantiereBackoffice[];
}
