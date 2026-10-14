import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const colab = await req.json();
    const { data, error } = await supabaseAdmin
      .from('colaboradores')
      .update({
        nome: colab.nome,
        cpf: colab.cpf,
        email: colab.email,
        cargo: colab.cargo,
        departamento: colab.departamento,
        jornada_inicio: colab.jornada_inicio || colab.jornadaInicio,
        jornada_fim: colab.jornada_fim || colab.jornadaFim,
        pin: colab.pin,
        avatar: colab.avatar,
        status: colab.status,
        tipo_contrato: colab.tipo_contrato || colab.tipoContrato,
        fotos_faciais: colab.fotos_faciais || colab.fotosFaciais,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await supabaseAdmin.from('registros_ponto').delete().eq('colaborador_id', id);
    const { error } = await supabaseAdmin.from('colaboradores').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
