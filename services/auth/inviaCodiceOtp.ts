import { supabase } from "@/lib/supabase";

export async function inviaCodiceOtp(
  email: string
): Promise<void> {
  const { error } =
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

  if (error) {
    throw error;
  }
}
