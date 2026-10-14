import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Configurações de jornada
export async function GET(req: NextRequest) {
  try {
    const empresaId = req.nextUrl.searchParams.get('empresa_id');
    const { data, error } = await supabaseAdmin
      .from('configuracoes_jornada')
      .select('*')
      .eq('empresa_id', empresaId as string)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ data: data || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const conf = await req.json();
    const empresaId = conf.empresa_id || conf.empresaId;
    const { data, error } = await supabaseAdmin
      .from('configuracoes_jornada')
      .upsert(
        {
          empresa_id: empresaId,
          tolerancia_normal_minutos: conf.tolerancia_normal_minutos ?? conf.toleranciaNormalMinutos,
          tolerancia_atraso_leve_minutos: conf.tolerancia_atraso_leve_minutos ?? conf.toleranciaAtrasoLeveMinutos,
          atraso_critico_minutos: conf.atraso_critico_minutos ?? conf.atrasoCriticoMinutos,
          antecipacao_permitida_minutos: conf.antecipacao_permitida_minutos ?? conf.antecipacaoPermitidaMinutos,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'empresa_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
