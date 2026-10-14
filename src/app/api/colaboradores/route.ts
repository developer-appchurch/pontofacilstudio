import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const empresaId = req.nextUrl.searchParams.get('empresa_id');
    let query = supabaseAdmin.from('colaboradores').select('*');
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
    const colab = await req.json();
    const { data, error } = await supabaseAdmin
      .from('colaboradores')
      .insert({
        empresa_id: colab.empresa_id || colab.empresaId,
        nome: colab.nome,
        cpf: colab.cpf,
        email: colab.email,
        cargo: colab.cargo,
        departamento: colab.departamento,
        jornada_inicio: colab.jornada_inicio || colab.jornadaInicio || '08:00:00',
        jornada_fim: colab.jornada_fim || colab.jornadaFim || '17:00:00',
        pin: colab.pin || '1234',
        avatar: colab.avatar,
        status: colab.status || 'ativo',
        tipo_contrato: colab.tipo_contrato || colab.tipoContrato || 'CLT',
        fotos_faciais: colab.fotos_faciais || colab.fotosFaciais || [],
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
