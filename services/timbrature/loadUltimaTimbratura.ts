import { supabase } from "@/lib/supabase";

export async function loadUltimaTimbratura(
  userId: string
) {
  const { data, error } = await supabase
    .from("timbrature")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}