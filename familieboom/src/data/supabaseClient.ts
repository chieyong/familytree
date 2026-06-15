import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Eén gedeelde client. De anon/publishable key staat veilig in de browser:
 * RLS is de poortwachter (zie 04-backend-schema.md §3). Null als de env-vars
 * ontbreken, zodat de app op de fixtures terug kan vallen.
 */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
