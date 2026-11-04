import { supabase } from "@/lib/supabase";
import type { AziendaBranding } from "@/services/checklistFotovoltaico/pdf/generaPdfChecklistFotovoltaico";

type SupabaseClient = typeof supabase;
type ColoriAzienda = { primary?: string };

/** Marchio (nome/logo/colore) dell'azienda per l'intestazione del PDF
 * della checklist, con fallback ai default Cantivo se non personalizzati. */
export async function caricaAziendaBrandingFotovoltaico(
  aziendaId: string,
  supabaseClient: SupabaseClient
): Promise<AziendaBranding> {
  const { data } = await supabaseClient
    .from("aziende")
    .select("nome, logo_url, colori")
    .eq("id", aziendaId)
    .maybeSingle();

  const colori = (data?.colori as ColoriAzienda | null) || null;

  return {
    nome: data?.nome || "Cantivo",
    logoUrl: data?.logo_url || null,
    colorePrimario: colori?.primary || null,
  };
}
