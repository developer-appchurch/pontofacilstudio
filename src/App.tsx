'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CompanyAuthProvider, useCompanyAuth } from './context/CompanyAuthContext';
import { DeviceCompanyLogin } from './components/DeviceCompanyLogin';
import { ManagerPasswordModal } from './components/ManagerPasswordModal';
import { UnpairDeviceModal } from './components/UnpairDeviceModal';
import { Header } from './components/Header';
import { TerminalKiosk } from './components/TerminalKiosk';
import { ManagerDashboard } from './components/ManagerDashboard';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { PullToRefresh } from './components/PullToRefresh';
import { Colaborador, RegistroPonto, RegraToleranciaConfig } from './types/ponto';
import { defaultConfiguracao } from './utils/toleranceEngine';
import { isSupabaseConfigured } from './lib/supabase';
import { supabaseDataService } from './services/supabaseService';

function AppContent() {
  const { 
    empresaLogada, 
    isDeviceAuthenticated, 
    isManagerUnlocked, 
    logoutMasterAdmin
  } = useCompanyAuth();

  const [activeView, setActiveView] = useState<'kiosk' | 'manager'>('kiosk');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Recente');

  // Modals de Segurança & Master Admin
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDesvincularModal, setShowDesvincularModal] = useState(false);
  const [showMasterAdmin, setShowMasterAdmin] = useState(false);

  // Sempre que solicitar acesso Master, limpa credenciais temporárias para exigir login novamente
  const handleOpenMasterAdmin = () => {
    logoutMasterAdmin();
    setShowMasterAdmin(true);
  };

  // State cache em memória filtrado pela empresa logada
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [config, setConfig] = useState<RegraToleranciaConfig>(defaultConfiguracao);

  // Referência para controlar se os dados da empresa atual já foram carregados na memória
  const loadedEmpresaIdRef = useRef<string | null>(null);

  // Carrega dados da empresa autenticada diretamente do Supabase apenas quando necessário
  const loadData = useCallback(async (empresaId: string) => {
    const timestampStr = new Date().toLocaleTimeString('pt-BR');
    setLastSyncTime(timestampStr);

    try {
      setIsSyncing(true);

      const [colabsData, regsData, configData] = await Promise.all([
        supabaseDataService.listColaboradores(empresaId),
        supabaseDataService.listRegistros(empresaId),
        supabaseDataService.getConfig(empresaId)
      ]);

      setColaboradores(colabsData);
      setRegistros(regsData);
      setConfig(configData);
    } catch (err) {
      console.error('Erro ao consultar dados no Supabase:', err);
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  }, []);

  // Garante que só busca dados na inicialização ou se a empresa vinculada mudar
  useEffect(() => {
    if (empresaLogada) {
      if (loadedEmpresaIdRef.current !== empresaLogada.id) {
        loadedEmpresaIdRef.current = empresaLogada.id;
        loadData(empresaLogada.id);
      }
    } else {
      loadedEmpresaIdRef.current = null;
      setLoading(false);
    }
  }, [empresaLogada?.id, loadData]);

  // Acesso ao Master Admin (Desenvolvedor)
  if (showMasterAdmin) {
    return (
      <MasterAdminPanel 
        onBackToApp={() => {
          logoutMasterAdmin();
          setShowMasterAdmin(false);
        }} 
      />
    );
  }

  // Se o dispositivo não estiver autenticado para uma empresa, exibe o Login do Dispositivo
  if (!isDeviceAuthenticated || !empresaLogada) {
    return <DeviceCompanyLogin onOpenMasterAdmin={handleOpenMasterAdmin} />;
  }

  // Filtragem estrita dos dados para a empresa autenticada no dispositivo
  const colaboradoresEmpresa = colaboradores.filter((c) => c.empresaId === empresaLogada.id);
  const registrosEmpresa = registros.filter((r) => r.empresaId === empresaLogada.id);

  // Controle de navegação seguro (exige senha para entrar no Painel do Gestor)
  const handleSelectView = (view: 'kiosk' | 'manager') => {
    if (view === 'manager') {
      if (!isManagerUnlocked) {
        setShowPasswordModal(true);
      } else {
        setActiveView('manager');
      }
    } else {
      setActiveView('kiosk');
    }
  };

  // Registrar batida de ponto com isolamento
  const handleRegistrarPonto = async (novoRegistro: Omit<RegistroPonto, 'id'>) => {
    try {
      const regCriado = await supabaseDataService.createRegistro(empresaLogada.id, novoRegistro);
      setRegistros((prev) => [regCriado, ...prev]);
    } catch (err: any) {
      console.error('Erro ao registrar ponto no Supabase:', err);
      alert('Erro ao registrar ponto: ' + err.message);
    }
  };

  // Cadastrar colaborador com isolamento
  const handleAddColaborador = async (colab: Colaborador) => {
    try {
      const novoColab = await supabaseDataService.createColaborador(empresaLogada.id, colab);
      setColaboradores((prev) => [novoColab, ...prev]);
      alert(`Colaborador cadastrado com sucesso no Supabase para ${empresaLogada.nome}!`);
    } catch (err: any) {
      console.error('Erro ao cadastrar colaborador no Supabase:', err);
      alert('Erro ao cadastrar colaborador: ' + err.message);
    }
  };

  // Excluir colaborador
  const handleDeleteColaborador = async (id: string) => {
    try {
      await supabaseDataService.deleteColaborador(empresaLogada.id, id);
      setColaboradores((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      console.error('Erro ao excluir colaborador no Supabase:', err);
      alert('Erro ao excluir colaborador: ' + err.message);
    }
  };

  const handleUpdateConfig = async (newConfig: RegraToleranciaConfig) => {
    setConfig(newConfig);
    try {
      await supabaseDataService.updateConfig(empresaLogada.id, newConfig);
    } catch (err: any) {
      console.error('Erro ao salvar configuração no Supabase:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        isSupabaseConnected={isSupabaseConfigured}
        lastSyncTime={lastSyncTime}
        onOpenDesvincularModal={() => setShowDesvincularModal(true)}
        onOpenMasterAdmin={handleOpenMasterAdmin}
      />

      <PullToRefresh
        onRefresh={() => loadData(empresaLogada.id)}
        isRefreshing={isSyncing}
      >
        <main className="flex-1 py-1 sm:py-3 md:py-6">
          {activeView === 'kiosk' ? (
            <TerminalKiosk
              colaboradores={colaboradoresEmpresa}
              registros={registrosEmpresa}
              onRegistrarPonto={handleRegistrarPonto}
              config={config}
              empresaAtiva={empresaLogada}
            />
          ) : (
            <ManagerDashboard
              colaboradores={colaboradoresEmpresa}
              registros={registrosEmpresa}
              config={config}
              empresaAtiva={empresaLogada}
              onUpdateConfig={handleUpdateConfig}
              onAddColaborador={handleAddColaborador}
              onDeleteColaborador={handleDeleteColaborador}
              onAddRegistroManual={handleRegistrarPonto}
            />
          )}
        </main>
      </PullToRefresh>

      {/* Modal de Desbloqueio do Painel do Gestor (Proteção por Senha) */}
      <ManagerPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setShowPasswordModal(false);
          setActiveView('manager');
        }}
      />

      {/* Modal para Desvincular Dispositivo (Seguro) */}
      <UnpairDeviceModal
        isOpen={showDesvincularModal}
        onClose={() => setShowDesvincularModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <CompanyAuthProvider>
      <AppContent />
    </CompanyAuthProvider>
  );
}
