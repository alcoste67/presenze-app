import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient stores the session in document.cookie (not localStorage)
// so the middleware's createServerClient can read it from request.cookies.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
