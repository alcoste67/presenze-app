import type { User } from "@supabase/supabase-js";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export async function loadUtenteAuth(): Promise<User | null> {
  const { data, error } =
    await supabase.auth.getUser();

  if (error && !isAuthSessionMissingError(error)) {
    throw error;
  }

  return data.user;
}
