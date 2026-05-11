import type {
  Session,
  User,
} from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { AUTH_OTP } from "@/constants/auth";

type VerificaCodiceOtpResult = {
  user: User | null;
  session: Session | null;
};

type VerificaCodiceOtpParams = {
  email: string;
  token: string;
};

export async function verificaCodiceOtp({
  email,
  token,
}: VerificaCodiceOtpParams): Promise<VerificaCodiceOtpResult> {
  const { data, error } =
    await supabase.auth.verifyOtp({
      email,
      token,
      type: AUTH_OTP.VERIFY_TYPE_EMAIL,
    });

  if (error) {
    throw error;
  }

  return data;
}
