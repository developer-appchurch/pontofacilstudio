import { NextResponse } from 'next/server';
import { supabaseAdmin, SUPABASE_URL } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Health check e status de conexão
export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from('empresas')
      .select('*', { count: 'exact', head: true });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, url: SUPABASE_URL });
    }
    return NextResponse.json({ ok: true, empresasCount: count ?? 0, url: SUPABASE_URL });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
