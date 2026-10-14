import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isMissingColumnError } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Listar empresas
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('empresas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Criar empresa
export async function POST(req: NextRequest) {
  try {
    const empresa = await req.json();
    let missingColumns = false;
    let { data, error } = await supabaseAdmin
      .from('empresas')
      .insert({
        nome: empresa.nome,
        cnpj: empresa.cnpj,
        plano: empresa.plano || 'enterprise',
        email_contato: empresa.emailContato,
        codigo_acesso: empresa.codigoAcesso,
        senha_dispositivo: empresa.senhaDispositivo,
        senha_gestor: empresa.senhaGestor,
        cidade: empresa.cidade || 'Brasil',
      })
      .select()
      .single();

    // Se a tabela tiver somente as colunas mínimas do schema (id, nome, cnpj, plano)
    if (isMissingColumnError(error)) {
      missingColumns = true;
      const retry = await supabaseAdmin
        .from('empresas')
        .insert({
          nome: empresa.nome,
          cnpj: empresa.cnpj,
          plano: empresa.plano || 'enterprise',
        })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    // Criar configuração inicial de jornada
    if (data?.id) {
      try {
        await supabaseAdmin.from('configuracoes_jornada').insert({
          empresa_id: data.id,
          tolerancia_normal_minutos: 5,
          tolerancia_atraso_leve_minutos: 9,
          atraso_critico_minutos: 10,
          antecipacao_permitida_minutos: 15,
        });
      } catch {
        // Ignora caso já exista
      }
    }

    return NextResponse.json({ data, missingColumns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
