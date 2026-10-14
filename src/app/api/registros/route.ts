import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const empresaId = req.nextUrl.searchParams.get('empresa_id');
    let query = supabaseAdmin.from('registros_ponto').select('*');
    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const reg = await req.json();
    const { data, error } = await supabaseAdmin
      .from('registros_ponto')
      .insert({
        empresa_id: reg.empresa_id || reg.empresaId,
        colaborador_id: reg.colaborador_id || reg.colaboradorId,
        colaborador_nome: reg.colaborador_nome || reg.colaboradorNome,
        data: reg.data,
        horario: reg.horario,
        tipo: reg.tipo,
        metodo: reg.metodo,
        status: reg.status,
        diferenca_minutos: reg.diferenca_minutos ?? reg.diferencaMinutos ?? 0,
        observacao: reg.observacao,
        localizacao: reg.localizacao,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
