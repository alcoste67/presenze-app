import type {
  AuthChangeEvent,
  Session,
} from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type AuthSessioneHandler = (
  event: AuthChangeEvent,
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
    (event, session) => {
      void onChange(event, session);
    }
  );

  return subscription;
}
