import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// .env set na ho to app crash nahi karega, setup warning dikhayega
export const configured = Boolean(url && key && !url.includes("YOUR-PROJECT"));

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-key"
);
