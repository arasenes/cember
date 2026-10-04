import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(SUPABASE_URL || "http://localhost", SUPABASE_KEY || "yok", {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
