'use client';

import { useState } from 'react';
import { 
  Users, Calendar, Clock, AlertCircle, CheckCircle, 
  Plus, Search, FileText, Settings, Award, ArrowUpRight, 
  ArrowDownRight, Filter, Download, UserPlus, Trash2, Edit, Building2,
  Camera, Upload, Sparkles, Image as ImageIcon, ShieldCheck, Lock, KeyRound
} from 'lucide-react';
import { Colaborador, RegistroPonto, RegraToleranciaConfig, Empresa } from '../types/ponto';
import { formatarStatusLabel } from '../utils/toleranceEngine';
import { compressImageToWebP } from '../utils/imageCompressor';
import { formatCPF } from '../utils/masks';
import { useCompanyAuth } from '../context/CompanyAuthContext';
import { RelatoriosPonto } from './RelatoriosPonto';


interface ManagerDashboardProps {
  colaboradores: Colaborador[];
  registros: RegistroPonto[];
  config: RegraToleranciaConfig;
  empresaAtiva: Empresa;
  onUpdateConfig: (newConfig: RegraToleranciaConfig) => void;
  onAddColaborador: (colab: Colaborador) => void;
  onDeleteColaborador: (id: string) => void;
  onAddRegistroManual: (registro: Omit<RegistroPonto, 'id'>) => void;
}

export function ManagerDashboard({
  colaboradores,
  registros,
  config,
  empresaAtiva,
  onUpdateConfig,
  onAddColaborador,
  onDeleteColaborador,
  onAddRegistroManual,
}: ManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'espelho_ponto' | 'colaboradores' | 'banco_horas' | 'configuracoes'>('visao_geral');
  
  // Filters for Espelho de Ponto
  const [filtroColab, setFiltroColab] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showNovoColabModal, setShowNovoColabModal] = useState(false);
  const [showRegistroManualModal, setShowRegistroManualModal] = useState(false);

  // New Colaborador Form
  const [novoNome, setNovoNome] = useState('');
  const [novoCpf, setNovoCpf] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
  const [novoDepto, setNovoDepto] = useState('Tecnologia');
  const [novoInicio, setNovoInicio] = useState('08:00');
  const [novoFim, setNovoFim] = useState('17:00');
  const [novoPin, setNovoPin] = useState('1234');
  const [novoContrato, setNovoContrato] = useState<'CLT' | 'PJ' | 'Estágio'>('CLT');

  // Biometric Photos (WebP compressed - Minimum 3 required)
  interface FotoWebpItem {
    url: string;
    sizeOriginalKb: number;
    sizeWebpKb: number;
    descricao: string;
  }
  const [fotosFaciais, setFotosFaciais] = useState<FotoWebpItem[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [fotoError, setFotoError] = useState('');

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number, desc: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoError('');
    setIsCompressing(true);
    try {
      const { base64, sizeOriginalKb, sizeWebpKb } = await compressImageToWebP(file, 400, 400, 0.75);
      setFotosFaciais((prev) => {
        const copy = [...prev];
        copy[index] = { url: base64, sizeOriginalKb, sizeWebpKb, descricao: desc };
        return copy;
      });
    } catch (err: any) {
      setFotoError('Falha ao processar e comprimir imagem: ' + err.message);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCarregarFotosExemplo = async () => {
    setIsCompressing(true);
    setFotoError('');
    try {
      const samples = [
        { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', desc: '1. Face Frontal' },
        { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80', desc: '2. Perfil Leve' },
        { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', desc: '3. Sorriso / Expressão' },
      ];
      const items = await Promise.all(
        samples.map(async (s) => {
          const res = await compressImageToWebP(s.url, 400, 400, 0.75);
          return {
            url: res.base64,
            sizeOriginalKb: res.sizeOriginalKb,
            sizeWebpKb: res.sizeWebpKb,
            descricao: s.desc,
          };
        })
      );
      setFotosFaciais(items);
    } catch (e: any) {
      setFotoError('Erro ao carregar exemplos: ' + e.message);
    } finally {
      setIsCompressing(false);
    }
  };

  // Manual Record Form
  const [manualColabId, setManualColabId] = useState(colaboradores[0]?.id || '');
  const [manualData, setManualData] = useState(new Date().toISOString().split('T')[0]);
  const [manualHorario, setManualHorario] = useState('08:00');
  const [manualTipo, setManualTipo] = useState<'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida'>('entrada');
  const [manualObs, setManualObs] = useState('Ajuste manual pelo gestor');

  // Config State
  const [cfgNormal, setCfgNormal] = useState(config.toleranciaNormalMinutos);
  const [cfgLeve, setCfgLeve] = useState(config.toleranciaAtrasoLeveMinutos);
  const [cfgCritico, setCfgCritico] = useState(config.atrasoCriticoMinutos);
  const [cfgAntecipacao, setCfgAntecipacao] = useState(config.antecipacaoPermitidaMinutos);

  const { alterarSenhaGestor } = useCompanyAuth();
  const [novaSenhaGestor, setNovaSenhaGestor] = useState(empresaAtiva.senhaGestor || 'admin123');
  const [senhaSalvaSucesso, setSenhaSalvaSucesso] = useState(false);

  const handleSalvarSenhaGestor = (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenhaGestor.length < 4) {
      alert('A senha do gestor deve ter pelo menos 4 caracteres.');
      return;
    }
    alterarSenhaGestor(novaSenhaGestor);
    setSenhaSalvaSucesso(true);
    setTimeout(() => setSenhaSalvaSucesso(false), 3000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      toleranciaNormalMinutos: Number(cfgNormal),
      toleranciaAtrasoLeveMinutos: Number(cfgLeve),
      atrasoCriticoMinutos: Number(cfgCritico),
      antecipacaoPermitidaMinutos: Number(cfgAntecipacao),
    });
    alert('Configurações de tolerância atualizadas com sucesso!');
  };

  const handleCreateColaborador = (e: React.FormEvent) => {
    e.preventDefault();
    setFotoError('');

    // Validar se há pelo menos 3 fotos
    const validPhotos = fotosFaciais.filter((f) => f && f.url);
    if (validPhotos.length < 3) {
      setFotoError('Atenção: É obrigatório cadastrar as 3 fotos faciais do colaborador convertidas em WebP antes de salvar.');
      return;
    }

    const novo: Colaborador = {
      id: 'col-' + Date.now(),
      empresaId: empresaAtiva.id,
      nome: novoNome,
      cpf: novoCpf,
      email: novoEmail,
      cargo: novoCargo,
      departamento: novoDepto,
      jornadaInicio: novoInicio,
      jornadaFim: novoFim,
      pin: novoPin,
      avatar: validPhotos[0].url,
      fotosFaciais: validPhotos.map((f) => f.url),
      status: 'ativo',
      tipoContrato: novoContrato
    };
    onAddColaborador(novo);
    setShowNovoColabModal(false);
    setNovoNome('');
    setNovoCpf('');
    setNovoEmail('');
    setNovoCargo('');
    setFotosFaciais([]);
  };

  const handleCreateManualRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    const colab = colaboradores.find((c) => c.id === manualColabId);
    if (!colab) return;

    onAddRegistroManual({
      empresaId: empresaAtiva.id,
      colaboradorId: colab.id,
      colaboradorNome: colab.nome,
      data: manualData,
      horario: manualHorario + ':00',
      tipo: manualTipo,
      metodo: 'manual',
      status: 'no_horario',
      diferencaMinutos: 0,
      observacao: manualObs,
      localizacao: `${empresaAtiva.nome} (Ajuste Manual)`
    });

    setShowRegistroManualModal(false);
    alert('Registro manual adicionado com sucesso!');
  };

  // Metrics
  const totalColaboradores = colaboradores.length;
  const hojeStr = new Date().toISOString().split('T')[0];
  const registrosHoje = registros.filter((r) => r.data === hojeStr);
  const colaboradoresPresentesIds = new Set(registrosHoje.map((r) => r.colaboradorId));
  const totalPresentes = colaboradoresPresentesIds.size;
  const totalAtrasos = registrosHoje.filter((r) => r.status === 'atraso_leve' || r.status === 'atraso_critico').length;

  // Filtered records
  const filteredRegistros = registros.filter((r) => {
    const matchColab = filtroColab ? r.colaboradorId === filtroColab : true;
    const matchData = filtroData ? r.data === filtroData : true;
    const matchSearch = searchTerm 
      ? r.colaboradorNome.toLowerCase().includes(searchTerm.toLowerCase()) || r.horario.includes(searchTerm)
      : true;
    return matchColab && matchData && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      {/* Enterprise Workspace Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Workspace: {empresaAtiva.nome}</span>
            <span className="bg-blue-500/20 px-2 py-0.5 rounded text-[10px] text-blue-300 font-mono">
              CNPJ: {empresaAtiva.cnpj}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">Painel de Gestão e Ponto Eletrônico</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Exibindo dados estritamente restritos à empresa autenticada (Isolamento Multi-Tenant ativo).
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200 pb-4">
        {[
          { id: 'visao_geral', label: 'Visão Geral', icon: Clock },
          { id: 'espelho_ponto', label: 'Espelho de Ponto', icon: FileText },
          { id: 'colaboradores', label: 'Colaboradores', icon: Users },
          { id: 'banco_horas', label: 'Banco de Horas', icon: Award },
          { id: 'configuracoes', label: 'Regras de Tolerância', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: VISAO GERAL */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Colaboradores</div>
                <div className="text-3xl font-bold text-slate-900">{totalColaboradores}</div>
                <div className="text-xs text-emerald-600 font-medium mt-0.5">Todos ativos</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Presentes Hoje</div>
                <div className="text-3xl font-bold text-slate-900">{totalPresentes}</div>
                <div className="text-xs text-slate-400 mt-0.5">Batidas registradas hoje</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Atrasos / Tolerância</div>
                <div className="text-3xl font-bold text-slate-900">{totalAtrasos}</div>
                <div className="text-xs text-amber-600 font-medium mt-0.5">Requer atenção</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Banco de Horas</div>
                <div className="text-3xl font-bold text-slate-900">+42h</div>
                <div className="text-xs text-purple-600 font-medium mt-0.5">Saldo corporativo positivo</div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Feed */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Atividade Recente de Ponto</h3>
                <p className="text-sm text-slate-500">Últimos registros efetuados no sistema</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowRegistroManualModal(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Registro Manual</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 px-4">Colaborador</th>
                    <th className="pb-3 px-4">Tipo</th>
                    <th className="pb-3 px-4">Data & Horário</th>
                    <th className="pb-3 px-4">Método</th>
                    <th className="pb-3 px-4">Status / Tolerância</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {registros.slice(-8).reverse().map((reg) => {
                    const statusInfo = formatarStatusLabel(reg.status);
                    return (
                      <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-4 font-semibold text-slate-900">{reg.colaboradorNome}</td>
                        <td className="py-4 px-4 capitalize text-slate-600 font-medium">{reg.tipo.replace('_', ' ')}</td>
                        <td className="py-4 px-4 font-mono text-slate-700">{reg.data} às {reg.horario}</td>
                        <td className="py-4 px-4 uppercase text-xs text-slate-500 font-semibold">{reg.metodo}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ESPELHO DE PONTO & RELATÓRIOS DETALHADOS (PDF / EXCEL) */}
      {activeTab === 'espelho_ponto' && (
        <div className="animate-fadeIn">
          <RelatoriosPonto
            colaboradores={colaboradores}
            registros={registros}
            empresaAtiva={empresaAtiva}
            config={config}
          />
        </div>
      )}

      {/* TAB 3: COLABORADORES */}
      {activeTab === 'colaboradores' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Gestão de Colaboradores</h3>
              <p className="text-sm text-slate-500">Cadastre e gerencie a jornada e PIN dos colaboradores</p>
            </div>
            <button
              onClick={() => setShowNovoColabModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition flex items-center space-x-2 shadow-lg shadow-blue-600/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Colaborador</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {colaboradores.map((colab) => (
              <div key={colab.id} className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-4 mb-4">
                    <img
                      src={colab.avatar}
                      alt={colab.nome}
                      className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{colab.nome}</h4>
                      <p className="text-xs text-slate-500">{colab.cargo}</p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                        {colab.departamento}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 mb-6 bg-white p-4 rounded-xl border border-slate-200/60">
                    <div className="flex justify-between">
                      <span className="text-slate-400">CPF:</span>
                      <span className="font-mono font-medium text-slate-800">{colab.cpf}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Jornada Padrão:</span>
                      <span className="font-mono font-medium text-slate-800">{colab.jornadaInicio} às {colab.jornadaFim}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">PIN de Acesso:</span>
                      <span className="font-mono font-medium text-slate-800">••••</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contrato:</span>
                      <span className="font-semibold text-slate-800">{colab.tipoContrato}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 border-t border-slate-200 pt-4">
                  <button
                    onClick={() => {
                      if (confirm(`Deseja remover o colaborador ${colab.nome}?`)) {
                        onDeleteColaborador(colab.id);
                      }
                    }}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                    title="Excluir Colaborador"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BANCO DE HORAS */}
      {activeTab === 'banco_horas' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Módulo de Banco de Horas</h3>
            <p className="text-sm text-slate-500">Saldo consolidado positivo e negativo de horas extras e antecipações</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-4">Colaborador</th>
                  <th className="pb-3 px-4">Departamento</th>
                  <th className="pb-3 px-4">Saldo Acumulado</th>
                  <th className="pb-3 px-4">Status Banco</th>
                  <th className="pb-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {colaboradores.map((colab, idx) => {
                  // Saldo simulado determinístico baseado no ID
                  const saldosMock = [185, -45, 90, 240, 15, -10];
                  const saldoMinutos = saldosMock[idx % saldosMock.length];
                  const horas = Math.floor(Math.abs(saldoMinutos) / 60);
                  const mins = Math.abs(saldoMinutos) % 60;
                  const isPositivo = saldoMinutos >= 0;

                  return (
                    <tr key={colab.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-4 font-semibold text-slate-900">{colab.nome}</td>
                      <td className="py-4 px-4 text-slate-600">{colab.departamento}</td>
                      <td className="py-4 px-4 font-mono font-bold text-base">
                        <span className={isPositivo ? 'text-emerald-600' : 'text-rose-600'}>
                          {isPositivo ? '+' : '-'}{horas}h {mins}m
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          isPositivo 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {isPositivo ? 'Banco Positivo' : 'Banco Negativo'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => alert(`Ajustando banco de horas para ${colab.nome}`)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          Ajustar Saldo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: CONFIGURACOES DE TOLERANCIA */}
      {activeTab === 'configuracoes' && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-sm animate-fadeIn">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">Motor de Tolerância e Regras de Jornada</h3>
            <p className="text-sm text-slate-500">
              Configure as regras de tolerância automática para atrasos e antecipações conforme CLT e políticas da empresa.
            </p>
          </div>



          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Tolerância Normal de Entrada (minutos)
                </label>
                <input
                  type="number"
                  value={cfgNormal}
                  onChange={(e) => setCfgNormal(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Ex: até 5 min sem penalidade (considerado no horário).</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Limite de Atraso Leve / Tolerado (minutos)
                </label>
                <input
                  type="number"
                  value={cfgLeve}
                  onChange={(e) => setCfgLeve(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Ex: entre 6 e 9 minutos de atraso.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Início de Atraso Crítico (minutos)
                </label>
                <input
                  type="number"
                  value={cfgCritico}
                  onChange={(e) => setCfgCritico(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Ex: 10 minutos ou mais (desconto desde o 1º min).</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Antecipação Autorizada / Banco Positivo (minutos)
                </label>
                <input
                  type="number"
                  value={cfgAntecipacao}
                  onChange={(e) => setCfgAntecipacao(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Ex: até 15 minutos antes gera banco positivo.</p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition"
            >
              Salvar Regras de Tolerância
            </button>
          </form>

          {/* Card: Senha de Acesso do Gestor (Proteção do Painel Administrativo) */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <div className="flex items-center space-x-2.5 mb-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h4 className="text-lg font-bold text-slate-900">Segurança do Painel do Gestor</h4>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Esta senha é exigida toda vez que alguém tenta sair do Totem de Ponto para acessar este painel administrativo.
            </p>

            <form onSubmit={handleSalvarSenhaGestor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Senha de Acesso Restrito do Gestor
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={novaSenhaGestor}
                    onChange={(e) => setNovaSenhaGestor(e.target.value)}
                    placeholder="Digite a nova senha..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-medium text-sm focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Recomendado: utilize uma senha segura conhecida apenas pela gerência/RH.
                </p>
              </div>

              {senhaSalvaSucesso && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Senha de gestor alterada com sucesso!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-md"
              >
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Atualizar Senha de Gestor</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO COLABORADOR */}
      {showNovoColabModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Cadastrar Novo Colaborador</h3>
            <form onSubmit={handleCreateColaborador} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">CPF</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    value={novoCpf}
                    onChange={(e) => setNovoCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono tracking-wide"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">PIN (4 dígitos)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={novoPin}
                    onChange={(e) => setNovoPin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Cargo</label>
                <input
                  type="text"
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Departamento</label>
                  <select
                    value={novoDepto}
                    onChange={(e) => setNovoDepto(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                  >
                    <option value="Tecnologia">Tecnologia</option>
                    <option value="Gestão">Gestão</option>
                    <option value="RH">RH</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Contrato</label>
                  <select
                    value={novoContrato}
                    onChange={(e) => setNovoContrato(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                  >
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="Estágio">Estágio</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Início Jornada</label>
                  <input
                    type="time"
                    value={novoInicio}
                    onChange={(e) => setNovoInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Fim Jornada</label>
                  <input
                    type="time"
                    value={novoFim}
                    onChange={(e) => setNovoFim(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Seção Obrigatória de 3 Fotos Faciais em WebP */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1.5">
                      <Camera className="w-4 h-4 text-blue-600" />
                      <span>Biometria Facial Obrigatória (3 Fotos WebP)</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Convertidas e compactadas automaticamente em <strong>WebP</strong> leve para não onerar o banco.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCarregarFotosExemplo}
                    disabled={isCompressing}
                    className="text-[11px] px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold rounded-lg transition flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>3 Fotos Demo</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { index: 0, label: '1. Frontal' },
                    { index: 1, label: '2. Perfil Leve' },
                    { index: 2, label: '3. Expressão' },
                  ].map((slot) => {
                    const foto = fotosFaciais[slot.index];
                    return (
                      <div key={slot.index} className="flex flex-col items-center">
                        <label className="text-[10px] font-semibold text-slate-500 mb-1">{slot.label}</label>
                        <div className="w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white relative overflow-hidden flex flex-col items-center justify-center group hover:border-blue-400 transition cursor-pointer">
                          {foto ? (
                            <>
                              <img src={foto.url} alt={slot.label} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center p-1 text-center">
                                <span className="text-[9px] text-emerald-300 font-mono font-bold">WebP {foto.sizeWebpKb} KB</span>
                                <span className="text-[9px] text-slate-200 mt-0.5">Clique p/ trocar</span>
                              </div>
                              <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                                <CheckCircle className="w-3 h-3" />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center p-2 text-center text-slate-400">
                              <Upload className="w-5 h-5 mb-1" />
                              <span className="text-[10px] font-medium leading-tight">Anexar</span>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => handleFotoUpload(e, slot.index, slot.label)}
                          />
                        </div>
                        {foto && (
                          <span className="text-[9px] text-emerald-600 font-mono mt-1 font-semibold">
                            ✓ WebP: {foto.sizeWebpKb} KB
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {fotoError && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{fotoError}</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNovoColabModal(false);
                    setFotoError('');
                    setFotosFaciais([]);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCompressing}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {isCompressing ? 'Compactando WebP...' : 'Salvar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRO MANUAL */}
      {showRegistroManualModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Adicionar Ponto Manual</h3>
            <form onSubmit={handleCreateManualRegistro} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Colaborador</label>
                <select
                  value={manualColabId}
                  onChange={(e) => setManualColabId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                >
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Data</label>
                  <input
                    type="date"
                    value={manualData}
                    onChange={(e) => setManualData(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Horário</label>
                  <input
                    type="time"
                    value={manualHorario}
                    onChange={(e) => setManualHorario(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Tipo de Marcação</label>
                <select
                  value={manualTipo}
                  onChange={(e) => setManualTipo(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="entrada">Entrada</option>
                  <option value="inicio_almoco">Início Almoço</option>
                  <option value="fim_almoco">Fim Almoço</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Justificativa / Observação</label>
                <input
                  type="text"
                  value={manualObs}
                  onChange={(e) => setManualObs(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegistroManualModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-600/20"
                >
                  Salvar Ponto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
