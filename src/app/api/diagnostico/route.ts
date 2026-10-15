import { NextResponse } from 'next/server';
import { supabaseAdmin, SUPABASE_URL } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export interface DiagnosticoResultado {
  ok: boolean;
  conectado: boolean;
  latencyMs: number;
  url: string;
  timestamp: string;
  leitura: {
    ok: boolean;
    empresas: boolean;
    colaboradores: boolean;
    registrosPonto: boolean;
    configuracoes: boolean;
    perfis: boolean;
    colunasAcessoEmpresas: boolean;
  };
  escrita: {
    ok: boolean;
    testada: boolean;
    mensagem: string;
  };
  tabelasFaltantes: string[];
  detalhesErro?: string;
  sugestaoAcao?: string;
}

export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toLocaleTimeString('pt-BR');

  const resultado: DiagnosticoResultado = {
    ok: false,
    conectado: false,
    latencyMs: 0,
    url: SUPABASE_URL,
    timestamp,
    leitura: {
      ok: false,
      empresas: false,
      colaboradores: false,
      registrosPonto: false,
      configuracoes: false,
      perfis: false,
      colunasAcessoEmpresas: false,
    },
    escrita: {
      ok: false,
      testada: false,
      mensagem: 'Não testada',
    },
    tabelasFaltantes: [],
  };

  try {
    // 1. Teste de Leitura da Tabela 'empresas' com as colunas essenciais
    const [resEmpresas, resColabs, resRegistros, resConfig, resPerfis] = await Promise.all([
      supabaseAdmin
        .from('empresas')
        .select('id, nome, cnpj, email_contato, codigo_acesso, senha_dispositivo, senha_gestor, cidade')
        .limit(1),
      supabaseAdmin
        .from('colaboradores')
        .select('id, nome, cpf, empresa_id')
        .limit(1),
      supabaseAdmin
        .from('registros_ponto')
        .select('id, tipo, data, horario')
        .limit(1),
      supabaseAdmin
        .from('configuracoes_jornada')
        .select('id, empresa_id, tolerancia_normal_minutos')
        .limit(1),
      supabaseAdmin
        .from('perfis')
        .select('id, email, role')
        .limit(1),
    ]);

    // Análise da tabela empresas
    if (!resEmpresas.error) {
      resultado.leitura.empresas = true;
      resultado.leitura.colunasAcessoEmpresas = true;
    } else {
      // Verificar se o erro foi de tabela inexistente ou apenas coluna faltando
      const msg = resEmpresas.error.message.toLowerCase();
      if (msg.includes('relation') || msg.includes('does not exist') || resEmpresas.error.code === '42P01') {
        resultado.tabelasFaltantes.push('empresas');
      } else {
        // Tabela existe mas pode estar faltando coluna
        const resBasico = await supabaseAdmin.from('empresas').select('id, nome, cnpj').limit(1);
        if (!resBasico.error) {
          resultado.leitura.empresas = true;
          resultado.leitura.colunasAcessoEmpresas = false;
        } else {
          resultado.tabelasFaltantes.push('empresas');
        }
      }
    }

    // Análise das demais tabelas
    if (!resColabs.error) {
      resultado.leitura.colaboradores = true;
    } else {
      resultado.tabelasFaltantes.push('colaboradores');
    }

    if (!resRegistros.error) {
      resultado.leitura.registrosPonto = true;
    } else {
      resultado.tabelasFaltantes.push('registros_ponto');
    }

    if (!resConfig.error) {
      resultado.leitura.configuracoes = true;
    } else {
      resultado.tabelasFaltantes.push('configuracoes_jornada');
    }

    if (!resPerfis.error) {
      resultado.leitura.perfis = true;
    } else {
      resultado.tabelasFaltantes.push('perfis');
    }

    // Leitura geral é OK se as tabelas principais estiverem acessíveis
    resultado.leitura.ok =
      resultado.leitura.empresas &&
      resultado.leitura.colaboradores &&
      resultado.leitura.registrosPonto &&
      resultado.leitura.configuracoes;

    // 2. Teste de Escrita (INSERT/DELETE probe)
    // Se a tabela empresas existir, realizamos um probe de escrita e exclusão imediata
    if (resultado.leitura.empresas) {
      resultado.escrita.testada = true;
      const probeId = '00000000-0000-0000-0000-000000000099';
      const probeCnpj = '00.000.000/0000-99';

      const { error: insertError } = await supabaseAdmin.from('empresas').upsert({
        id: probeId,
        nome: '__probe_diagnostico__',
        cnpj: probeCnpj,
        email_contato: 'probe@diagnostico.internal',
        codigo_acesso: 'PROBE99',
        senha_dispositivo: 'probe123',
        senha_gestor: 'probe123',
        cidade: 'Diagnostico'
      }, { onConflict: 'cnpj' });

      if (!insertError) {
        // Remove imediatamente o registro de probe
        await supabaseAdmin.from('empresas').delete().eq('id', probeId);
        resultado.escrita.ok = true;
        resultado.escrita.mensagem = 'Escrita e exclusão de teste realizadas com sucesso no Supabase';
      } else {
        resultado.escrita.ok = false;
        resultado.escrita.mensagem = `Falha na gravação: ${insertError.message}`;
      }
    } else {
      resultado.escrita.testada = false;
      resultado.escrita.mensagem = 'Teste de escrita suspenso porque a tabela "empresas" não foi encontrada';
    }

    resultado.latencyMs = Date.now() - startTime;
    resultado.conectado = resultado.leitura.empresas;
    resultado.ok = resultado.leitura.ok && resultado.escrita.ok && resultado.leitura.colunasAcessoEmpresas;

    if (!resultado.ok) {
      if (resultado.tabelasFaltantes.length > 0) {
        resultado.detalhesErro = `Tabelas ausentes no banco de dados: ${resultado.tabelasFaltantes.join(', ')}.`;
        resultado.sugestaoAcao = 'Execute o script "supabase_schema.sql" no SQL Editor do seu projeto Supabase para criar as tabelas.';
      } else if (!resultado.leitura.colunasAcessoEmpresas) {
        resultado.detalhesErro = 'A tabela "empresas" existe, mas faltam as colunas de credenciais (codigo_acesso, senha_dispositivo, senha_gestor).';
        resultado.sugestaoAcao = 'Execute os comandos ALTER TABLE no SQL Editor do Supabase.';
      } else if (!resultado.escrita.ok) {
        resultado.detalhesErro = resultado.escrita.mensagem;
        resultado.sugestaoAcao = 'Verifique as políticas RLS ou permissões da chave configurada no Supabase.';
      }
    }

    return NextResponse.json(resultado);
  } catch (err: any) {
    resultado.latencyMs = Date.now() - startTime;
    resultado.ok = false;
    resultado.conectado = false;
    resultado.detalhesErro = err?.message || 'Erro inesperado ao consultar o Supabase.';
    resultado.sugestaoAcao = 'Verifique a URL e a chave de acesso do Supabase no ambiente.';
    return NextResponse.json(resultado, { status: 200 });
  }
}
