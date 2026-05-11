import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type AuthSessioneHandler = (
  session: Session | null
) => void | Promise<void>;

type AuthSubscription = {
  unsubscribe: () => void;
};

export function ascoltaSessioneAuth(
  onChange: AuthSessioneHandler
): AuthSubscription {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      void onChange(session);
    }
  );

  return subscription;
}
