'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Crown, Building2, Plus, Trash2, Key, Shield, 
  CheckCircle2, LogOut, ArrowRight, Lock, Eye, EyeOff, AlertCircle,
  Copy, Check, ExternalLink, Edit2, Database, RefreshCw
} from 'lucide-react';
import { useCompanyAuth } from '../context/CompanyAuthContext';
import { Empresa } from '../types/ponto';
import { formatCNPJ, isCNPJComplete } from '../utils/masks';
import { supabaseDataService } from '../services/supabaseService';
import { SupabaseDiagnostic } from './SupabaseDiagnostic';

export const SQL_MIGRATION_EMPRESAS = `-- Adicionar colunas de acesso e credenciais na tabela public.empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS email_contato text,
ADD COLUMN IF NOT EXISTS codigo_acesso text,
ADD COLUMN IF NOT EXISTS senha_dispositivo text,
ADD COLUMN IF NOT EXISTS senha_gestor text,
ADD COLUMN IF NOT EXISTS cidade text DEFAULT 'Brasil';

-- Índice para busca rápida por código de acesso do Totem
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo_acesso ON public.empresas(codigo_acesso);`;

interface MasterAdminPanelProps {
  onBackToApp: () => void;
}

export function MasterAdminPanel({ onBackToApp }: MasterAdminPanelProps) {
  const { 
    isMasterAdmin, 
    loginMasterAdmin, 
    logoutMasterAdmin, 
    listaEmpresasDisponiveis, 
    cadastrarEmpresa, 
    atualizarEmpresa,
    removerEmpresa,
    recarregarEmpresas
  } = useCompanyAuth();

  // Login form state
  const [usuarioInput, setUsuarioInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Create Company modal state
  const [showModalNovaEmpresa, setShowModalNovaEmpresa] = useState(false);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [senhaDispositivo, setSenhaDispositivo] = useState('');
  const [senhaGestor, setSenhaGestor] = useState('');
  const [cidade, setCidade] = useState('São Paulo - SP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');



  // Modal de Edição de Credenciais da Empresa
  const [empresaParaEditar, setEmpresaParaEditar] = useState<Empresa | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editEmailContato, setEditEmailContato] = useState('');
  const [editCodigoAcesso, setEditCodigoAcesso] = useState('');
  const [editSenhaDispositivo, setEditSenhaDispositivo] = useState('');
  const [editSenhaGestor, setEditSenhaGestor] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Modal de Confirmação de Exclusão de Empresa (com cascata de colaboradores)
  const [empresaParaExcluir, setEmpresaParaExcluir] = useState<Empresa | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Revelar senhas
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };



  const abrirModalEditar = (emp: Empresa) => {
    setEmpresaParaEditar(emp);
    setEditNome(emp.nome);
    setEditCnpj(emp.cnpj);
    setEditEmailContato(emp.emailContato || '');
    setEditCodigoAcesso(emp.codigoAcesso || '');
    setEditSenhaDispositivo(emp.senhaDispositivo || '');
    setEditSenhaGestor(emp.senhaGestor || '');
    setEditCidade(emp.cidade || 'Brasil');
    setEditError('');
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaParaEditar) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      await atualizarEmpresa(empresaParaEditar.id, {
        nome: editNome,
        cnpj: editCnpj,
        emailContato: editEmailContato,
        codigoAcesso: editCodigoAcesso.toUpperCase(),
        senhaDispositivo: editSenhaDispositivo,
        senhaGestor: editSenhaGestor,
        cidade: editCidade
      });
      setSuccessNotice(`Credenciais da empresa "${editNome}" atualizadas com sucesso!`);
      setTimeout(() => setSuccessNotice(''), 4000);
      setEmpresaParaEditar(null);
    } catch (err: any) {
      setEditError(err.message || 'Erro ao atualizar credenciais.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const ok = loginMasterAdmin(usuarioInput, senhaInput);
    setSenhaInput('');
    if (!ok) {
      setLoginError('Credenciais de Master Admin incorretas.');
    } else {
      setUsuarioInput('');
    }
  };

  const handleCriarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError('');
    try {
      const nova = await cadastrarEmpresa({
        nome,
        cnpj,
        emailContato,
        codigoAcesso: codigoAcesso.toUpperCase(),
        senhaDispositivo,
        senhaGestor,
        cidade
      });

      setSuccessNotice(`Empresa ${nova.nome} cadastrada com sucesso!`);
      setTimeout(() => setSuccessNotice(''), 4000);
      setShowModalNovaEmpresa(false);

      // Limpar campos
      setNome('');
      setCnpj('');
      setEmailContato('');
      setCodigoAcesso('');
      setSenhaDispositivo('');
      setSenhaGestor('');
    } catch (err: any) {
      setModalError(err.message || 'Erro ao cadastrar empresa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmarExclusaoEmpresa = async () => {
    if (!empresaParaExcluir) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await removerEmpresa(empresaParaExcluir.id);
      setSuccessNotice(`Empresa "${empresaParaExcluir.nome}" e todos os seus colaboradores foram excluídos com sucesso.`);
      setTimeout(() => setSuccessNotice(''), 5000);
      setEmpresaParaExcluir(null);
    } catch (err: any) {
      console.error('Erro ao excluir empresa:', err);
      setDeleteError(err.message || 'Erro ao excluir a empresa no Supabase.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Se não estiver logado como Master Admin, exibe tela de login do desenvolvedor
  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-yellow-400"></div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
              <Crown className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Master Admin</h2>
            <p className="text-xs text-slate-400 mt-1">
              Acesso Exclusivo do Desenvolvedor para Gestão de Tenants
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Usuário Master
              </label>
              <input
                type="text"
                value={usuarioInput}
                onChange={(e) => setUsuarioInput(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Senha Master
              </label>
              <input
                type="password"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="••••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
            >
              <span>Entrar no Painel Master</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition text-center"
            >
              Voltar ao Aplicativo
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Painel Master Admin Autenticado
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">Master Admin • Gestão de Empresas</h1>
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  DEVELOPER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cadastre novas empresas e defina as credenciais que os gestores utilizarão nos dispositivos.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowModalNovaEmpresa(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition flex items-center space-x-2 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Nova Empresa</span>
            </button>
            <button
              onClick={() => {
                logoutMasterAdmin();
                onBackToApp();
              }}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition flex items-center space-x-1.5"
              title="Sair do Master Admin"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>



        {/* Componente Visual de Diagnóstico do Supabase (Leitura/Escrita e Sem Polling Contínuo) */}
        <SupabaseDiagnostic />

        {successNotice && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tabela de Empresas Cadastradas */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Empresas Habilitadas no Sistema</h3>
              <p className="text-xs text-slate-400">
                Total de {listaEmpresasDisponiveis.length} empresas cadastradas pelo desenvolvedor
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-4">Empresa / Cidade</th>
                  <th className="pb-3 px-4">CNPJ</th>
                  <th className="pb-3 px-4">E-mail de Acesso</th>
                  <th className="pb-3 px-4">Código Totem</th>
                  <th className="pb-3 px-4">Senha Dispositivo</th>
                  <th className="pb-3 px-4">Senha Gestor</th>
                  <th className="pb-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {listaEmpresasDisponiveis.map((emp) => {
                  const revealed = revealedPasswords[emp.id];
                  const temCredenciaisPendentes = !emp.codigoAcesso || !emp.senhaDispositivo;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-4 px-4 font-bold text-white">
                        <div className="flex items-center space-x-2">
                          <span>{emp.nome}</span>
                          {temCredenciaisPendentes && (
                            <span 
                              className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-normal"
                              title="Credenciais pendentes de preenchimento ou migração no Supabase"
                            >
                              Credenciais pendentes
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">{emp.cidade || 'Brasil'}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-300">{emp.cnpj}</td>
                      <td className="py-4 px-4 text-slate-300">
                        {emp.emailContato || <span className="text-slate-600 italic">Não informado</span>}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-cyan-400">
                        {emp.codigoAcesso || <span className="text-slate-600 italic">Pendente</span>}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-300">
                        {emp.senhaDispositivo 
                          ? (revealed ? emp.senhaDispositivo : '••••••••')
                          : <span className="text-slate-600 italic">Pendente</span>}
                      </td>
                      <td className="py-4 px-4 font-mono text-amber-400 font-semibold">
                        {emp.senhaGestor 
                          ? (revealed ? emp.senhaGestor : '••••••••')
                          : <span className="text-slate-600 italic">Pendente</span>}
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => toggleRevealPassword(emp.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                          title="Mostrar/Ocultar Senhas"
                        >
                          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirModalEditar(emp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition"
                          title={`Editar dados e credenciais de ${emp.nome}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError('');
                            setEmpresaParaExcluir(emp);
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition"
                          title={`Excluir ${emp.nome}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Botão de retorno ao app */}
        <div className="flex justify-end">
          <button
            onClick={onBackToApp}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            ← Voltar para a Visão do Terminal / Totem
          </button>
        </div>
      </div>

      {/* Modal: Cadastro de Nova Empresa */}
      {showModalNovaEmpresa && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative">
            <h3 className="text-xl font-bold text-white mb-1">Cadastrar Nova Empresa</h3>
            <p className="text-xs text-slate-400 mb-6">
              Defina os dados da empresa e as credenciais que o gestor usará para ativar o terminal e desbloquear o painel.
            </p>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCriarEmpresa} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                  Nome da Empresa / Razão Social
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Prime Tech Engenharia"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold uppercase text-slate-400">CNPJ</label>
                    {cnpj && (
                      <span className={`text-[10px] font-mono ${isCNPJComplete(cnpj) ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                        {cnpj.replace(/\D/g, '').length}/14
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-500 placeholder:tracking-normal"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Código Totem</label>
                  <input
                    type="text"
                    value={codigoAcesso}
                    onChange={(e) => setCodigoAcesso(e.target.value)}
                    placeholder="PRIME2026"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">E-mail de Acesso</label>
                  <input
                    type="email"
                    value={emailContato}
                    onChange={(e) => setEmailContato(e.target.value)}
                    placeholder="rh@empresa.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Cidade / UF</label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Belo Horizonte - MG"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Credenciais para os gestores */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-3">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Credenciais de Autenticação da Empresa
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Senha Dispositivo (Login Totem)</label>
                    <input
                      type="text"
                      value={senhaDispositivo}
                      onChange={(e) => setSenhaDispositivo(e.target.value)}
                      placeholder="Ex: prime2026"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Senha Painel do Gestor</label>
                    <input
                      type="text"
                      value={senhaGestor}
                      onChange={(e) => setSenhaGestor(e.target.value)}
                      placeholder="Ex: gestor123"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModalNovaEmpresa(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar e Cadastrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Editar Credenciais e Dados da Empresa */}
      {empresaParaEditar && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Editar Credenciais da Empresa</h3>
                  <p className="text-xs text-slate-400">Atualize os acessos e senhas para o Totem e Gestor</p>
                </div>
              </div>
              <button
                onClick={() => setEmpresaParaEditar(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Razão Social / Nome</label>
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">CNPJ</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={editCnpj}
                    onChange={(e) => setEditCnpj(formatCNPJ(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Código Totem</label>
                  <input
                    type="text"
                    value={editCodigoAcesso}
                    onChange={(e) => setEditCodigoAcesso(e.target.value)}
                    placeholder="Ex: PRIME2026"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">E-mail de Acesso</label>
                  <input
                    type="email"
                    value={editEmailContato}
                    onChange={(e) => setEditEmailContato(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Cidade / UF</label>
                  <input
                    type="text"
                    value={editCidade}
                    onChange={(e) => setEditCidade(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-3">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Credenciais de Autenticação
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Senha Dispositivo (Login Totem)</label>
                    <input
                      type="text"
                      value={editSenhaDispositivo}
                      onChange={(e) => setEditSenhaDispositivo(e.target.value)}
                      placeholder="Ex: 123456"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Senha Painel do Gestor</label>
                    <input
                      type="text"
                      value={editSenhaGestor}
                      onChange={(e) => setEditSenhaGestor(e.target.value)}
                      placeholder="Ex: Master@2025"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEmpresaParaEditar(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isSavingEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão de Empresa (com exclusão em cascata de colaboradores) */}
      {empresaParaExcluir && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-600"></div>

            <div className="flex items-center space-x-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Excluir Empresa</h3>
                <p className="text-xs text-rose-400 font-medium">Ação irreversível de exclusão total</p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-4 space-y-2">
              <div className="text-xs text-slate-300">
                Você está prestes a excluir a empresa:
              </div>
              <div className="text-sm font-bold text-white">{empresaParaExcluir.nome}</div>
              <div className="text-xs text-slate-400 font-mono">CNPJ: {empresaParaExcluir.cnpj}</div>
            </div>

            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-5 space-y-1.5 text-xs text-rose-300">
              <div className="flex items-center space-x-1.5 font-bold text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Exclusão em Cascata:</span>
              </div>
              <p className="leading-relaxed text-[11px] text-slate-300">
                Ao excluir esta empresa, <strong>todos os colaboradores cadastrados</strong>, seus registros de ponto, configurações de jornada e perfis vinculados serão <strong>permanentemente excluídos</strong> do sistema e do banco de dados Supabase.
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setEmpresaParaExcluir(null);
                  setDeleteError('');
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmarExclusaoEmpresa}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
