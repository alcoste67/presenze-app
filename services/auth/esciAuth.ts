import { supabase } from "@/lib/supabase";

export async function esciAuth(): Promise<void> {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
