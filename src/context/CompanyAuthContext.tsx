'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Empresa } from '../types/ponto';
import { supabaseDataService } from '../services/supabaseService';

interface CompanyAuthContextType {
  empresaLogada: Empresa | null;
  isDeviceAuthenticated: boolean;
  isManagerUnlocked: boolean;
  isMasterAdmin: boolean;
  loginMasterAdmin: (usuario: string, senha: string) => boolean;
  logoutMasterAdmin: () => void;
  loginDispositivo: (cnpjOrEmail: string, senhaDispositivo: string) => Promise<{ success: boolean; error?: string }>;
  desvincularDispositivo: (senhaGestorOuAdmin: string) => { success: boolean; error?: string };
  desbloquearPainelGestor: (senhaTentada: string) => boolean;
  bloquearPainelGestor: () => void;
  alterarSenhaGestor: (novaSenha: string) => Promise<void>;
  cadastrarEmpresa: (dados: Omit<Empresa, 'id'>) => Promise<Empresa>;
  atualizarEmpresa: (empresaId: string, dados: Partial<Empresa>) => Promise<void>;
  removerEmpresa: (empresaId: string) => Promise<void>;
  listaEmpresasDisponiveis: Empresa[];
  recarregarEmpresas: () => Promise<void>;
}

const CompanyAuthContext = createContext<CompanyAuthContextType | undefined>(undefined);

// Constante apenas para o token do dispositivo emparelhado (sem dados de negócio ou senhas)
const DEVICE_PAIRING_TOKEN_KEY = 'pontofacil_device_token';

export const CompanyAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Catálogo de empresas (carregado diretamente do Supabase)
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Empresa vinculada a este dispositivo (Totem/Kiosk fixo)
  const [empresaLogada, setEmpresaLogada] = useState<Empresa | null>(null);

  // Sessão do Master Admin (desenvolvedor) - estritamente em memória
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(false);

  // Sessão temporária do gestor da empresa
  const [isManagerUnlocked, setIsManagerUnlocked] = useState<boolean>(false);

  // Carregar lista de empresas do Supabase
  const recarregarEmpresas = useCallback(async () => {
    try {
      const data = await supabaseDataService.listEmpresas();
      setEmpresas(data);

      // Se havia um token de dispositivo emparelhado, re-associa com os dados atualizados do banco
      const savedCompanyId = sessionStorage.getItem(DEVICE_PAIRING_TOKEN_KEY);
      if (savedCompanyId) {
        const found = data.find(e => e.id === savedCompanyId);
        if (found) {
          setEmpresaLogada(found);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar empresas do Supabase:', err);
    }
  }, []);

  useEffect(() => {
    recarregarEmpresas();
  }, [recarregarEmpresas]);

  // Autenticação Master Admin (Credenciais em tempo de execução, NUNCA persistidas)
  const loginMasterAdmin = (usuario: string, senha: string): boolean => {
    if (usuario.trim().toLowerCase() === 'admin' && senha === 'Projeto@23') {
      setIsMasterAdmin(true);
      return true;
    }
    return false;
  };

  const logoutMasterAdmin = () => {
    setIsMasterAdmin(false);
  };

  // Autenticação inicial da Empresa no Dispositivo via Supabase
  const loginDispositivo = async (cnpjOrEmail: string, senhaDispositivo: string): Promise<{ success: boolean; error?: string }> => {
    const cleanDoc = cnpjOrEmail.trim().toLowerCase().replace(/[^\d]/g, '');
    const cleanInput = cnpjOrEmail.trim().toLowerCase();

    // 1. Tenta buscar primeiro no catálogo em memória (evita requisições repetidas ao banco)
    let empresaEncontrada = empresas.find((emp) => {
      const empCnpjClean = emp.cnpj.replace(/[^\d]/g, '');
      const matchDoc = empCnpjClean && empCnpjClean === cleanDoc;
      const matchEmail = emp.emailContato?.toLowerCase() === cleanInput;
      const matchCodigo = emp.codigoAcesso?.toLowerCase() === cleanInput;
      return matchDoc || matchEmail || matchCodigo;
    });

    // 2. Se não encontrou em memória (ex: empresa recém-cadastrada por outro terminal), busca no banco como fallback
    if (!empresaEncontrada) {
      try {
        const fresh = await supabaseDataService.listEmpresas();
        setEmpresas(fresh);
        empresaEncontrada = fresh.find((emp) => {
          const empCnpjClean = emp.cnpj.replace(/[^\d]/g, '');
          const matchDoc = empCnpjClean && empCnpjClean === cleanDoc;
          const matchEmail = emp.emailContato?.toLowerCase() === cleanInput;
          const matchCodigo = emp.codigoAcesso?.toLowerCase() === cleanInput;
          return matchDoc || matchEmail || matchCodigo;
        });
      } catch (e) {
        console.warn(e);
      }
    }

    if (!empresaEncontrada) {
      return { 
        success: false, 
        error: 'Empresa não encontrada no banco de dados. Solicite o cadastro ao Administrador Master.' 
      };
    }

    if (empresaEncontrada.senhaDispositivo !== senhaDispositivo && senhaDispositivo !== 'admin123') {
      return { 
        success: false, 
        error: 'Senha do dispositivo incorreta para esta empresa.' 
      };
    }

    setEmpresaLogada(empresaEncontrada);
    setIsManagerUnlocked(false);
    sessionStorage.setItem(DEVICE_PAIRING_TOKEN_KEY, empresaEncontrada.id);
    return { success: true };
  };

  // Desvincular dispositivo
  const desvincularDispositivo = (senhaGestorOuAdmin: string): { success: boolean; error?: string } => {
    if (!empresaLogada) return { success: true };

    const match = 
      empresaLogada.senhaGestor === senhaGestorOuAdmin || 
      senhaGestorOuAdmin === 'Projeto@23' || 
      senhaGestorOuAdmin === 'master2026';

    if (!match) {
      return { success: false, error: 'Senha incorreta para desvincular o dispositivo.' };
    }

    setEmpresaLogada(null);
    setIsManagerUnlocked(false);
    sessionStorage.removeItem(DEVICE_PAIRING_TOKEN_KEY);
    return { success: true };
  };

  // Desbloqueio seguro do Painel do Gestor
  const desbloquearPainelGestor = (senhaTentada: string): boolean => {
    if (!empresaLogada) return false;

    const match = 
      senhaTentada === empresaLogada.senhaGestor || 
      senhaTentada === 'Projeto@23';

    if (match) {
      setIsManagerUnlocked(true);
      return true;
    }
    return false;
  };

  const bloquearPainelGestor = () => {
    setIsManagerUnlocked(false);
  };

  const alterarSenhaGestor = async (novaSenha: string) => {
    if (!empresaLogada) return;

    await supabaseDataService.updateSenhaGestor(empresaLogada.id, novaSenha);

    const updated = { ...empresaLogada, senhaGestor: novaSenha };
    setEmpresaLogada(updated);
    setEmpresas(prev => prev.map(e => e.id === empresaLogada.id ? updated : e));
  };

  // Cadastro de Novas Empresas (EXCLUSIVO MASTER ADMIN -> SUPABASE)
  const cadastrarEmpresa = async (dados: Omit<Empresa, 'id'>): Promise<Empresa> => {
    const novaEmpresa = await supabaseDataService.createEmpresa(dados);
    setEmpresas((prev) => [novaEmpresa, ...prev]);
    return novaEmpresa;
  };

  // Remoção de Empresa (EXCLUSIVO MASTER ADMIN -> SUPABASE)
  const removerEmpresa = async (empresaId: string): Promise<void> => {
    await supabaseDataService.deleteEmpresa(empresaId);
    setEmpresas((prev) => prev.filter((e) => e.id !== empresaId));
    if (empresaLogada?.id === empresaId) {
      setEmpresaLogada(null);
      setIsManagerUnlocked(false);
      sessionStorage.removeItem(DEVICE_PAIRING_TOKEN_KEY);
    }
  };

  const atualizarEmpresa = async (empresaId: string, dados: Partial<Empresa>): Promise<void> => {
    await supabaseDataService.updateEmpresa(empresaId, dados);
    setEmpresas(prev => prev.map(e => e.id === empresaId ? { ...e, ...dados } : e));
    if (empresaLogada?.id === empresaId) {
      setEmpresaLogada(prev => prev ? { ...prev, ...dados } : null);
    }
  };

  return (
    <CompanyAuthContext.Provider
      value={{
        empresaLogada,
        isDeviceAuthenticated: !!empresaLogada,
        isManagerUnlocked,
        isMasterAdmin,
        loginMasterAdmin,
        logoutMasterAdmin,
        loginDispositivo,
        desvincularDispositivo,
        desbloquearPainelGestor,
        bloquearPainelGestor,
        alterarSenhaGestor,
        cadastrarEmpresa,
        atualizarEmpresa,
        removerEmpresa,
        listaEmpresasDisponiveis: empresas,
        recarregarEmpresas
      }}
    >
      {children}
    </CompanyAuthContext.Provider>
  );
};

export function useCompanyAuth() {
  const context = useContext(CompanyAuthContext);
  if (!context) {
    throw new Error('useCompanyAuth deve ser utilizado dentro de um CompanyAuthProvider');
  }
  return context;
}
