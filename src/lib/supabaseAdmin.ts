import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin - executa estritamente no servidor (Route Handlers) com a chave service_role.
// Nunca importar este módulo em componentes de cliente.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://ykxrbbhrkucwlgjseimr.supabase.co';

const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key_to_prevent_startup_crash';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function isMissingColumnError(error: { message?: string; code?: string } | null) {
  return Boolean(
    error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204')
  );
}
