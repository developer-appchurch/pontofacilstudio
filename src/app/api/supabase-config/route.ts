import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const configPath = path.join(process.cwd(), 'src', 'lib', 'supabaseConfig.json');

function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Erro ao ler supabaseConfig.json:', err);
  }
  return {
    url: 'https://ykxrbbhrkucwlgjseimr.supabase.co',
    anonKey: 'sb_publishable_vrRSjKvvMlq31aUYXAIJGQ_oluuQsl6',
    serviceRoleKey: ''
  };
}

export async function GET() {
  const cfg = readConfig();
  return NextResponse.json({
    url: cfg.url || '',
    hasAnonKey: Boolean(cfg.anonKey),
    anonKeyPreview: cfg.anonKey ? `${cfg.anonKey.slice(0, 15)}...` : '',
    hasServiceRoleKey: Boolean(cfg.serviceRoleKey),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, anonKey, serviceRoleKey } = body;

    const current = readConfig();
    const updated = {
      url: typeof url === 'string' && url.trim() ? url.trim() : current.url,
      anonKey: typeof anonKey === 'string' && anonKey.trim() ? anonKey.trim() : current.anonKey,
      serviceRoleKey: typeof serviceRoleKey === 'string' ? serviceRoleKey.trim() : current.serviceRoleKey
    };

    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');

    return NextResponse.json({
      ok: true,
      message: 'Configurações do Supabase atualizadas com sucesso!',
      url: updated.url
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Falha ao gravar arquivo de configuração' },
      { status: 500 }
    );
  }
}
