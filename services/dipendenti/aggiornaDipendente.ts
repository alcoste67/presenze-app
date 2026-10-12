import { supabase } from "@/lib/supabase";
import {
  Dipendente,
  DipendenteInput,
} from "@/types/dipendenti";

type Params = {
  dipendenteId: string;
  dipendente: DipendenteInput;
};

export async function aggiornaDipendente({
  dipendenteId,
  dipendente,
}: Params): Promise<Dipendente> {
  const { data, error } = await supabase
    .from("dipendenti")
    .update({
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      email: dipendente.email,
      ruolo: dipendente.ruolo,
      attivo: dipendente.attivo,
      tipo_conteggio_ore:
        dipendente.tipo_conteggio_ore,
      costo_orario: dipendente.costo_orario,
      ral: dipendente.ral,
      avvisa_admin_timbratura: dipendente.avvisa_admin_timbratura,
      usa_auto_propria: dipendente.usa_auto_propria,
      tariffa_km_rimborso: dipendente.tariffa_km_rimborso,
      veicolo_descrizione: dipendente.veicolo_descrizione,
    })
    .eq("id", dipendenteId)
    .select(
      "id, nome, cognome, email, ruolo, attivo, tipo_conteggio_ore, auth_user_id, created_at, costo_orario, ral, avvisa_admin_timbratura, usa_auto_propria, tariffa_km_rimborso, veicolo_descrizione"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as Dipendente;
}
