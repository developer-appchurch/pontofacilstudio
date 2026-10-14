import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Verificar status das colunas da tabela empresas no Supabase
export async function GET() {
  try {
    const { error } = await supabaseAdmin
      .from('empresas')
      .select('email_contato, codigo_acesso, senha_dispositivo, senha_gestor, cidade')
      .limit(1);

    if (error) {
      return NextResponse.json({
        hasColumns: false,
        error: error.message,
        missingColumns: ['email_contato', 'codigo_acesso', 'senha_dispositivo', 'senha_gestor', 'cidade'],
      });
    }

    return NextResponse.json({ hasColumns: true });
  } catch (err: any) {
    return NextResponse.json({ hasColumns: false, error: err.message }, { status: 500 });
  }
}
