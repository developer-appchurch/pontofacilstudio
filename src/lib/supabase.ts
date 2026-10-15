import { createClient } from '@supabase/supabase-js';

// =========================================================================
// CREDENCIAIS PÚBLICAS DO SUPABASE (USO ESTRITAMENTE NO CLIENTE / NAVEGADOR)
// =========================================================================
// AVISO IMPORTANTE: No navegador, APENAS a ANON KEY (pública) pode ser usada.
// Chaves de serviço/secret (sb_secret_*) são proibidas no browser pelo Supabase
// para proteger a segurança do banco e rodam exclusivamente no backend (Route Handlers em src/app/api).
// =========================================================================

import supabaseConfig from './supabaseConfig.json';

const DEFAULT_SUPABASE_URL = supabaseConfig.url || 'https://juebzskzwzcvllwkcqhd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = supabaseConfig.anonKey || 'sb_publishable_vrRSjKvvMlq31aUYXAIJGQ_oluuQsl6';

export const supabaseUrl: string =
  process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;

export const supabaseAnonKey: string =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Validar se a URL é válida e não é um placeholder
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !url.includes('seu-projeto');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = Boolean(isValidUrl(supabaseUrl) && supabaseAnonKey);

// Cliente oficial do Supabase para o navegador (utiliza exclusivamente a anon key)
export const supabase = isSupabaseConfigured && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

export const supabaseAnon = supabase;

export function getSupabaseStatus() {
  return {
    isConfigured: isSupabaseConfigured,
    url: supabaseUrl,
    hasKey: Boolean(supabaseAnonKey),
    isAdminReady: true
  };
}

export async function testSupabaseLiveConnection(): Promise<{ success: boolean; message: string; data?: any }> {
  // 1. Tentar primeiro via Backend API (que tem acesso completo com a chave de serviço)
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        return {
          success: true,
          message: `Conexão ativa com o Supabase! Projeto conectado em ${supabaseUrl} (${data.empresasCount} empresa(s) no banco).`,
          data
        };
      }
    }
  } catch {
    // Backend API não respondeu, continua para teste direto via cliente
  }

  // 2. Teste via cliente direto
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      message: 'O Supabase ainda não está ativo porque a URL ou a chave pública (anon) não foram configuradas.'
    };
  }

  try {
    const { data, error } = await supabase.from('empresas').select('id, nome, cnpj').limit(1);
    if (error) {
      return {
        success: false,
        message: `Falha de comunicação com o Supabase: ${error.message}`
      };
    }
    return {
      success: true,
      message: 'Conexão com o Supabase estabelecida com sucesso! Tabela public.empresas acessível.',
      data
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao conectar com o Supabase: ${err?.message || err}`
    };
  }
}
