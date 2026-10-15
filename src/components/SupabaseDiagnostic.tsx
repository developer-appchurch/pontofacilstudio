'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Database, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  ExternalLink, Copy, Check, ShieldCheck, ArrowRight, Activity,
  Settings, Key, Link as LinkIcon, Save
} from 'lucide-react';
import { DiagnosticoResultado } from '@/app/api/diagnostico/route';
import { SQL_MIGRATION_EMPRESAS } from './MasterAdminPanel';

interface SupabaseDiagnosticProps {
  className?: string;
  onStatusChange?: (isOk: boolean) => void;
}

export function SupabaseDiagnostic({ className = '', onStatusChange }: SupabaseDiagnosticProps) {
  const [loading, setLoading] = useState(true);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoResultado | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Form de Configuração Manual do Supabase
  const [inputUrl, setInputUrl] = useState('');
  const [inputAnonKey, setInputAnonKey] = useState('');
  const [inputServiceKey, setInputServiceKey] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');
  const [configErrMsg, setConfigErrMsg] = useState('');

  // Garante que o teste roda APENAS UMA VEZ na inicialização (sem conferência contínua)
  const hasExecutedInitialTest = useRef(false);

  const carregarConfigAtual = async () => {
    try {
      const res = await fetch('/api/supabase-config');
      if (res.ok) {
        const data = await res.json();
        if (data.url) setInputUrl(data.url);
      }
    } catch {
      // Ignora erro
    }
  };

  const executarDiagnostico = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostico');
      if (res.ok) {
        const dados: DiagnosticoResultado = await res.json();
        setDiagnostico(dados);
        if (dados.url) setInputUrl(dados.url);
        if (onStatusChange) {
          onStatusChange(Boolean(dados.ok));
        }
      } else {
        const erroFallback: DiagnosticoResultado = {
          ok: false,
          conectado: false,
          latencyMs: 0,
          url: '',
          timestamp: new Date().toLocaleTimeString('pt-BR'),
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
            mensagem: `Erro na resposta do servidor HTTP ${res.status}`,
          },
          tabelasFaltantes: ['empresas', 'colaboradores', 'registros_ponto', 'configuracoes_jornada'],
          detalhesErro: `O endpoint de diagnóstico retornou status ${res.status}.`,
          sugestaoAcao: 'Verifique se as variáveis de ambiente do Supabase estão configuradas.',
        };
        setDiagnostico(erroFallback);
        if (onStatusChange) onStatusChange(false);
      }
    } catch (err: any) {
      const erroRede: DiagnosticoResultado = {
        ok: false,
        conectado: false,
        latencyMs: 0,
        url: '',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
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
          mensagem: 'Falha de rede ao consultar o backend de diagnóstico',
        },
        tabelasFaltantes: [],
        detalhesErro: err?.message || 'Falha de comunicação',
        sugestaoAcao: 'Certifique-se de que a aplicação está executando e tente novamente.',
      };
      setDiagnostico(erroRede);
      if (onStatusChange) onStatusChange(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Executa uma única vez ao montar o componente
    if (!hasExecutedInitialTest.current) {
      hasExecutedInitialTest.current = true;
      executarDiagnostico();
      carregarConfigAtual();
    }
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_EMPRESAS);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMsg('');
    setConfigErrMsg('');

    try {
      const res = await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputUrl,
          anonKey: inputAnonKey || undefined,
          serviceRoleKey: inputServiceKey || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setConfigSuccessMsg('Configuração atualizada com sucesso! Re-executando teste de conexão...');
        setTimeout(() => {
          setConfigSuccessMsg('');
          executarDiagnostico();
        }, 1200);
      } else {
        setConfigErrMsg(data.error || 'Erro ao salvar configuração.');
      }
    } catch (err: any) {
      setConfigErrMsg(err?.message || 'Falha ao salvar configuração.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Identificar se o erro é o clássico de Project URL divergente da chave
  const isKeyMismatch = Boolean(
    diagnostico?.detalhesErro?.toLowerCase().includes('another supabase project') ||
    diagnostico?.detalhesErro?.toLowerCase().includes('invalid api key')
  );

  // Estado 1: Carregando teste inicial
  if (loading && !diagnostico) {
    return (
      <div className={`p-5 rounded-3xl bg-slate-900/80 border border-slate-800 text-slate-200 shadow-xl flex items-center justify-between ${className}`}>
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">Diagnosticando Conexão Supabase</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                Teste Único
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Testando leitura, escrita e estrutura das tabelas no banco de dados...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOk = Boolean(diagnostico?.ok);

  return (
    <div
      className={`rounded-3xl border shadow-2xl transition-all duration-300 overflow-hidden ${
        isOk
          ? 'bg-gradient-to-br from-emerald-950/60 via-slate-950 to-emerald-950/40 border-emerald-500/40 text-emerald-100 shadow-emerald-950/30'
          : 'bg-gradient-to-br from-rose-950/60 via-slate-950 to-rose-950/40 border-rose-500/50 text-rose-100 shadow-rose-950/30'
      } ${className}`}
    >
      {/* Top Banner Status */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div
              className={`p-3.5 rounded-2xl shrink-0 shadow-lg ${
                isOk
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isOk ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {isOk
                    ? 'Conexão Supabase 100% Ativa (Leitura & Escrita Habilitadas)'
                    : 'Atenção: Falha de Conexão ou Tabelas Ausentes no Supabase'}
                </h3>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    isOk
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {isOk ? 'Status: Conectado' : 'Ação Necessária'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/60 text-slate-400 border border-slate-800">
                  {diagnostico?.latencyMs || 0} ms • Testado às {diagnostico?.timestamp}
                </span>
              </div>

              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                {isOk ? (
                  <>
                    O aplicativo realizou o teste completo de <strong>leitura e gravação</strong> no Supabase com sucesso.
                    Todas as tabelas críticas (<code className="font-mono text-emerald-300">empresas</code>,{' '}
                    <code className="font-mono text-emerald-300">colaboradores</code>,{' '}
                    <code className="font-mono text-emerald-300">registros_ponto</code>,{' '}
                    <code className="font-mono text-emerald-300">configuracoes_jornada</code>) estão ativas e sincronizadas.
                  </>
                ) : (
                  <>
                    {diagnostico?.detalhesErro ||
                      'Não foi possível validar a comunicação com as tabelas do Supabase.'}{' '}
                    {diagnostico?.sugestaoAcao}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={executarDiagnostico}
              disabled={loading}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition border disabled:opacity-50 ${
                isOk
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-500/40'
              }`}
              title="Executa um novo teste sob demanda (sem conferência contínua)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>{loading ? 'Testando...' : 'Re-testar Conexão'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition ${
                showConfig 
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' 
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80'
              }`}
              title="Configurar Project URL e Chaves do Supabase"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurar URL</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700/80 transition"
            >
              {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
            </button>
          </div>
        </div>

        {/* ALERTA CRÍTICO: Project URL incompatível com a chave */}
        {isKeyMismatch && (
          <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-amber-100 text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center space-x-2 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Chave Inválida para esta URL do Supabase (Project Mismatch)</span>
            </div>
            <p className="leading-relaxed text-slate-200">
              A chave informada (<code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-amber-300">sb_publishable_...</code>) 
              pertence ao <strong>seu projeto criado no Supabase</strong>, porém a URL configurada no aplicativo ainda aponta para o projeto de demonstração antigo:
              <code className="block bg-slate-900 px-2 py-1 rounded font-mono text-rose-300 mt-1">{diagnostico?.url}</code>
            </p>
            <p className="text-slate-300">
              💡 <strong>Como resolver:</strong> Abra a aba <strong>"Configurar URL"</strong> acima (ou cole no formulário abaixo) a <strong>Project URL</strong> do seu projeto no Supabase (encontrada em <em>Project Settings &gt; API &gt; Project URL</em>, no formato <code className="text-amber-300 font-mono">https://[seu-id].supabase.co</code>).
            </p>
          </div>
        )}

        {/* Status Pills / Grid Rápido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800/60">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center space-x-2.5">
            <div
              className={`w-2 h-2 rounded-full ${
                diagnostico?.leitura.empresas ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500'
              }`}
            />
            <div className="text-[11px] leading-tight">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Tabela Empresas</span>
              <span className={diagnostico?.leitura.empresas ? 'text-emerald-300 font-semibold' : 'text-rose-400 font-semibold'}>
                {diagnostico?.leitura.empresas ? 'Leitura OK' : 'Ausente'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center space-x-2.5">
            <div
              className={`w-2 h-2 rounded-full ${
                diagnostico?.leitura.colaboradores ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500'
              }`}
            />
            <div className="text-[11px] leading-tight">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Colaboradores & Ponto</span>
              <span className={diagnostico?.leitura.colaboradores ? 'text-emerald-300 font-semibold' : 'text-rose-400 font-semibold'}>
                {diagnostico?.leitura.colaboradores ? 'Leitura OK' : 'Ausente'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center space-x-2.5">
            <div
              className={`w-2 h-2 rounded-full ${
                diagnostico?.escrita.ok ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500'
              }`}
            />
            <div className="text-[11px] leading-tight">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Permissão de Escrita</span>
              <span className={diagnostico?.escrita.ok ? 'text-emerald-300 font-semibold' : 'text-rose-400 font-semibold'}>
                {diagnostico?.escrita.ok ? 'Escrita Habilitada' : 'Bloqueada'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center space-x-2.5">
            <div
              className={`w-2 h-2 rounded-full ${
                diagnostico?.leitura.colunasAcessoEmpresas ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500'
              }`}
            />
            <div className="text-[11px] leading-tight">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Colunas Totem/Credenciais</span>
              <span
                className={
                  diagnostico?.leitura.colunasAcessoEmpresas ? 'text-emerald-300 font-semibold' : 'text-rose-400 font-semibold'
                }
              >
                {diagnostico?.leitura.colunasAcessoEmpresas ? 'Colunas OK' : 'Incompletas'}
              </span>
            </div>
          </div>
        </div>

        {/* Aviso de Economia de Recursos (Sem Conferência Contínua) */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Conferência contínua em segundo plano <strong>desativada</strong> para poupar chamadas de rede. Testes futuros são acionados apenas sob demanda.
            </span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE CONFIGURAÇÃO DE URL & CHAVES DO SUPABASE */}
      {showConfig && (
        <div className="bg-slate-900/95 border-t border-slate-800/80 p-5 sm:p-6 space-y-4 animate-fadeIn text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white flex items-center space-x-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Configurar Credenciais do Projeto Supabase</span>
            </h4>
            <span className="text-slate-400 text-[11px]">
              Atualiza a URL e as chaves em tempo real
            </span>
          </div>

          <form onSubmit={handleSalvarConfig} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1 flex items-center space-x-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Project URL do Supabase (Obrigatória)</span>
              </label>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://exemplo-id-projeto.supabase.co"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                No painel do Supabase, copie de: <strong>Project Settings &gt; API &gt; Project URL</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Publishable / Anon Key (Pública)</span>
                </label>
                <input
                  type="text"
                  value={inputAnonKey}
                  onChange={(e) => setInputAnonKey(e.target.value)}
                  placeholder="sb_publishable_... ou eyJhbGci..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Deixe em branco para manter a atual (<code className="text-emerald-300">sb_publishable_...</code>).
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Service Role Key (Opcional - Backend Admin)</span>
                </label>
                <input
                  type="password"
                  value={inputServiceKey}
                  onChange={(e) => setInputServiceKey(e.target.value)}
                  placeholder="sb_secret_... ou eyJhbGci..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Chave com permissão total para rotas de API do servidor.
                </p>
              </div>
            </div>

            {configSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{configSuccessMsg}</span>
              </div>
            )}

            {configErrMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center space-x-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{configErrMsg}</span>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingConfig ? 'Salvando...' : 'Salvar e Conectar'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Painel Expansível de Detalhes Técnicos & Script de Resolução */}
      {showDetails && (
        <div className="bg-slate-900/95 border-t border-slate-800/80 p-5 sm:p-6 space-y-4 animate-fadeIn text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Detalhamento Técnico de Diagnóstico</span>
            </h4>
            <span className="text-[11px] font-mono text-slate-400">{diagnostico?.url}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="font-semibold text-slate-200 text-xs">Status por Tabela:</div>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex justify-between items-center">
                  <span className="font-mono text-slate-400">public.empresas:</span>
                  <span className={diagnostico?.leitura.empresas ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.leitura.empresas ? '✓ Conectada' : '✗ Não encontrada'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-mono text-slate-400">public.colaboradores:</span>
                  <span className={diagnostico?.leitura.colaboradores ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.leitura.colaboradores ? '✓ Conectada' : '✗ Não encontrada'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-mono text-slate-400">public.registros_ponto:</span>
                  <span className={diagnostico?.leitura.registrosPonto ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.leitura.registrosPonto ? '✓ Conectada' : '✗ Não encontrada'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-mono text-slate-400">public.configuracoes_jornada:</span>
                  <span className={diagnostico?.leitura.configuracoes ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.leitura.configuracoes ? '✓ Conectada' : '✗ Não encontrada'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-mono text-slate-400">public.perfis:</span>
                  <span className={diagnostico?.leitura.perfis ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.leitura.perfis ? '✓ Conectada' : '✗ Não encontrada'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="font-semibold text-slate-200 text-xs">Capacidades e Gravação:</div>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex justify-between items-center">
                  <span className="text-slate-400">Permissão de Leitura (SELECT):</span>
                  <span className={diagnostico?.leitura.ok ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.leitura.ok ? 'Habilitada (100%)' : 'Incompleta'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-400">Permissão de Escrita (INSERT/DELETE probe):</span>
                  <span className={diagnostico?.escrita.ok ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                    {diagnostico?.escrita.ok ? 'Habilitada (100%)' : 'Bloqueada'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-400">Mensagem da Operação:</span>
                  <span className="font-mono text-[10px] text-slate-300 truncate max-w-[180px]" title={diagnostico?.escrita.mensagem}>
                    {diagnostico?.escrita.mensagem || '--'}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {!isOk && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300 text-xs">
                  Script SQL para criação e migração no Supabase:
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 border border-slate-700 transition"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-[11px] text-amber-200/90 overflow-x-auto max-h-48 whitespace-pre">
{SQL_MIGRATION_EMPRESAS}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
