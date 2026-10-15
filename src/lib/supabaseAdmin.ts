import 'server-only';
import { createClient } from '@supabase/supabase-js';

import supabaseConfig from './supabaseConfig.json';

// Supabase Admin - executa estritamente no servidor (Route Handlers) com a chave service_role.
// Nunca importar este módulo em componentes de cliente.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  supabaseConfig.url ||
  'https://juebzskzwzcvllwkcqhd.supabase.co';

const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  supabaseConfig.serviceRoleKey ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  supabaseConfig.anonKey ||
  'sb_publishable_vrRSjKvvMlq31aUYXAIJGQ_oluuQsl6';

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
