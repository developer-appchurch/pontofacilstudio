import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isMissingColumnError } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// Atualizar dados/credenciais da empresa
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updatePayload: Record<string, any> = {};
    if (body.nome !== undefined) updatePayload.nome = body.nome;
    if (body.emailContato !== undefined) updatePayload.email_contato = body.emailContato;
    if (body.codigoAcesso !== undefined) updatePayload.codigo_acesso = body.codigoAcesso;
    if (body.senhaDispositivo !== undefined) updatePayload.senha_dispositivo = body.senhaDispositivo;
    if (body.senhaGestor !== undefined) updatePayload.senha_gestor = body.senhaGestor;
    if (body.cidade !== undefined) updatePayload.cidade = body.cidade;

    let { data, error } = await supabaseAdmin
      .from('empresas')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (isMissingColumnError(error)) {
      const basicPayload: Record<string, any> = {};
      if (body.nome !== undefined) basicPayload.nome = body.nome;
      const retry = await supabaseAdmin
        .from('empresas')
        .update(basicPayload)
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Deletar empresa
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    // Deleta registros associados para não violar foreign keys
    await supabaseAdmin.from('configuracoes_jornada').delete().eq('empresa_id', id);
    await supabaseAdmin.from('registros_ponto').delete().eq('empresa_id', id);
    await supabaseAdmin.from('colaboradores').delete().eq('empresa_id', id);
    await supabaseAdmin.from('perfis').delete().eq('empresa_id', id);

    const { error } = await supabaseAdmin.from('empresas').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
