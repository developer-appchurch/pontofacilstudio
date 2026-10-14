import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Empresa, Colaborador, RegistroPonto, RegraToleranciaConfig, Perfil } from '../types/ponto';
import { initialEmpresas, initialColaboradores, initialRegistros } from '../data/mockData';
import { defaultConfiguracao } from '../utils/toleranceEngine';

// =========================================================================
// SUPABASE HYBRID DATA SERVICE (100% SUPABASE / POSTGRESQL)
// - Prioriza rotas de API do backend (/api/* com service role seguro)
// - Fallback para cliente Supabase no navegador (anon key)
// - Zero vazamento de secret key no navegador
// =========================================================================

// State fallbacks mantidos em memória para resiliência
let memoryEmpresas: Empresa[] = [...initialEmpresas];
let memoryColaboradores: Colaborador[] = [...initialColaboradores];
let memoryRegistros: RegistroPonto[] = [...initialRegistros];
let memoryConfig: RegraToleranciaConfig = { ...defaultConfiguracao };
let memoryPerfis: Perfil[] = [
  {
    id: 'perf-1',
    empresaId: '11111111-1111-1111-1111-111111111111',
    nome: 'Gestor Acme',
    email: 'gestor@acme.com.br',
    role: 'gestor'
  }
];

export const supabaseDataService = {
  // -----------------------------------------------------------------------
  // EMPRESAS (Master Admin & Device Auth)
  // -----------------------------------------------------------------------
  async checkSchemaStatus(): Promise<{ hasColumns: boolean; missingColumns?: string[] }> {
    try {
      const res = await fetch('/api/empresas/schema-status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend inacessível
    }
    return { hasColumns: false };
  },

  async listEmpresas(): Promise<Empresa[]> {
    // 1. Tentar via backend API seguro
    try {
      const res = await fetch('/api/empresas');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          const list: Empresa[] = json.data.map((d: any) => {
            const cached = memoryEmpresas.find(m => m.id === d.id || m.cnpj === d.cnpj);
            return {
              id: d.id,
              nome: d.nome,
              cnpj: d.cnpj,
              emailContato: d.email_contato || d.email || cached?.emailContato || '',
              codigoAcesso: d.codigo_acesso || d.codigo_totem || cached?.codigoAcesso || '',
              senhaDispositivo: d.senha_dispositivo || cached?.senhaDispositivo || '',
              senhaGestor: d.senha_gestor || cached?.senhaGestor || '',
              cidade: d.cidade || cached?.cidade || 'Brasil'
            };
          });
          memoryEmpresas = list;
          return list;
        }
      }
    } catch {
      // Backend não acessível, tenta cliente direto
    }

    // 2. Tentar via Supabase client (anon)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const list: Empresa[] = data.map((d: any) => {
            const cached = memoryEmpresas.find(m => m.id === d.id || m.cnpj === d.cnpj);
            return {
              id: d.id,
              nome: d.nome,
              cnpj: d.cnpj,
              emailContato: d.email_contato || d.email || cached?.emailContato || '',
              codigoAcesso: d.codigo_acesso || d.codigo_totem || cached?.codigoAcesso || '',
              senhaDispositivo: d.senha_dispositivo || cached?.senhaDispositivo || '',
              senhaGestor: d.senha_gestor || cached?.senhaGestor || '',
              cidade: d.cidade || cached?.cidade || 'Brasil'
            };
          });
          memoryEmpresas = list;
          return list;
        }
      } catch (err) {
        console.warn('Erro ao consultar via cliente Supabase:', err);
      }
    }

    return [...memoryEmpresas];
  },

  async updateEmpresa(id: string, updates: Partial<Empresa>): Promise<void> {
    try {
      await fetch(`/api/empresas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      memoryEmpresas = memoryEmpresas.map(e => e.id === id ? { ...e, ...updates } : e);
    } catch (err) {
      console.error('Erro ao atualizar empresa:', err);
    }
  },

  async createEmpresa(empresa: Omit<Empresa, 'id'>): Promise<Empresa> {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'emp-' + Date.now();
    let newEmpresa: Empresa = { ...empresa, id: tempId };

    // 1. Tentar via backend API seguro (usa service role no Node.js sem restrições de browser)
    try {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empresa)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          newEmpresa.id = json.data.id;
          memoryEmpresas = [newEmpresa, ...memoryEmpresas.filter(e => e.cnpj !== empresa.cnpj)];
          return newEmpresa;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (apiErr: any) {
      // Se deu erro real de banco (ex: duplicação de CNPJ), repassa o erro
      if (apiErr?.message && !apiErr.message.includes('fetch')) {
        throw new Error(`Erro ao cadastrar empresa no Supabase: ${apiErr.message}`);
      }
    }

    // 2. Fallback: tentar via Supabase client (anon)
    if (isSupabaseConfigured && supabase) {
      let { data, error } = await supabase
        .from('empresas')
        .insert({
          nome: empresa.nome,
          cnpj: empresa.cnpj,
          plano: 'enterprise',
          email_contato: empresa.emailContato,
          codigo_acesso: empresa.codigoAcesso,
          senha_dispositivo: empresa.senhaDispositivo,
          senha_gestor: empresa.senhaGestor,
          cidade: empresa.cidade || 'Brasil'
        })
        .select()
        .single();

      if (error && (error.message?.includes('column') || error.code === 'PGRST204')) {
        const retry = await supabase
          .from('empresas')
          .insert({
            nome: empresa.nome,
            cnpj: empresa.cnpj,
            plano: 'enterprise'
          })
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        throw new Error(`Erro ao cadastrar empresa no Supabase: ${error.message}`);
      }

      if (data?.id) {
        newEmpresa.id = data.id;
      }
    }

    // Registra perfil do gestor
    if (empresa.emailContato) {
      memoryPerfis.push({
        id: 'perf-' + Date.now(),
        empresaId: newEmpresa.id,
        nome: `Gestor - ${empresa.nome}`,
        email: empresa.emailContato,
        role: 'gestor'
      });
    }

    memoryEmpresas = [newEmpresa, ...memoryEmpresas];
    return newEmpresa;
  },

  async deleteEmpresa(id: string): Promise<void> {
    // 1. Tentar backend API
    try {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        memoryEmpresas = memoryEmpresas.filter(e => e.id !== id);
        return;
      }
    } catch {
      // Ignora erro de rede e tenta cliente
    }

    // 2. Tentar Supabase client (com cascata manual de colaboradores e registros)
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('configuracoes_jornada').delete().eq('empresa_id', id);
        await supabase.from('registros_ponto').delete().eq('empresa_id', id);
        await supabase.from('colaboradores').delete().eq('empresa_id', id);
        await supabase.from('perfis').delete().eq('empresa_id', id);
      } catch (cascadeErr) {
        console.warn('Erro ao limpar dependências antes de excluir empresa:', cascadeErr);
      }

      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao deletar empresa no Supabase: ${error.message}`);
      }
    }

    memoryEmpresas = memoryEmpresas.filter(e => e.id !== id);
    memoryPerfis = memoryPerfis.filter(p => p.empresaId !== id);
    memoryColaboradores = memoryColaboradores.filter(c => c.empresaId !== id);
    memoryRegistros = memoryRegistros.filter(r => r.empresaId !== id);
  },

  async updateSenhaGestor(empresaId: string, novaSenha: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('empresas')
          .update({ senha_gestor: novaSenha })
          .eq('id', empresaId);
      } catch (err) {
        console.warn('Atualização de senha no Supabase:', err);
      }
    }

    memoryEmpresas = memoryEmpresas.map(e => e.id === empresaId ? { ...e, senhaGestor: novaSenha } : e);
  },

  // -----------------------------------------------------------------------
  // PERFIS (Gestores, Admins, Colaboradores no Supabase)
  // -----------------------------------------------------------------------
  async listPerfis(empresaId: string): Promise<Perfil[]> {
    if (!isSupabaseConfigured || !supabase) {
      return memoryPerfis.filter(p => p.empresaId === empresaId);
    }

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      return memoryPerfis.filter(p => p.empresaId === empresaId);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      empresaId: p.empresa_id,
      nome: p.nome,
      email: p.email,
      role: p.role,
      createdAt: p.created_at
    }));
  },

  async createPerfil(perfil: Omit<Perfil, 'id' | 'createdAt'>): Promise<Perfil> {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'perf-' + Date.now();
    const newPerfil: Perfil = { ...perfil, id: tempId, createdAt: new Date().toISOString() };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('perfis')
        .insert({
          empresa_id: perfil.empresaId,
          nome: perfil.nome,
          email: perfil.email,
          role: perfil.role
        })
        .select()
        .single();

      if (error) {
        console.warn('Erro ao inserir perfil:', error.message);
      } else if (data) {
        newPerfil.id = data.id;
        newPerfil.createdAt = data.created_at;
      }
    }

    memoryPerfis = [newPerfil, ...memoryPerfis];
    return newPerfil;
  },

  // -----------------------------------------------------------------------
  // COLABORADORES (Isolados estritamente por company_id)
  // -----------------------------------------------------------------------
  async listColaboradores(companyId: string): Promise<Colaborador[]> {
    // 1. Tentar via backend API
    try {
      const res = await fetch(`/api/colaboradores?empresa_id=${companyId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          return json.data.map((c: any) => ({
            id: c.id,
            empresaId: c.empresa_id,
            nome: c.nome,
            cpf: c.cpf,
            email: c.email || '',
            cargo: c.cargo,
            departamento: c.departamento,
            jornadaInicio: c.jornada_inicio?.substring(0, 5) || '08:00',
            jornadaFim: c.jornada_fim?.substring(0, 5) || '17:00',
            pin: c.pin || '1234',
            avatar: c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            fotosFaciais: c.fotos_faciais || [],
            status: c.status || 'ativo',
            tipoContrato: c.tipo_contrato || 'CLT'
          }));
        }
      }
    } catch {
      // Fallback
    }

    // 2. Tentar via cliente Supabase
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('empresa_id', companyId)
        .order('nome', { ascending: true });

      if (!error && data) {
        return data.map((c: any) => ({
          id: c.id,
          empresaId: c.empresa_id,
          nome: c.nome,
          cpf: c.cpf,
          email: c.email || '',
          cargo: c.cargo,
          departamento: c.departamento,
          jornadaInicio: c.jornada_inicio?.substring(0, 5) || '08:00',
          jornadaFim: c.jornada_fim?.substring(0, 5) || '17:00',
          pin: c.pin || '1234',
          avatar: c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          fotosFaciais: c.fotos_faciais || [],
          status: c.status || 'ativo',
          tipoContrato: c.tipo_contrato || 'CLT'
        }));
      }
    }

    return memoryColaboradores.filter(c => c.empresaId === companyId);
  },

  async createColaborador(companyId: string, colab: Colaborador): Promise<Colaborador> {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'colab-' + Date.now();
    const newColab: Colaborador = { ...colab, id: tempId, empresaId: companyId };

    // 1. Tentar via backend API
    try {
      const res = await fetch('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: companyId,
          nome: colab.nome,
          cpf: colab.cpf,
          email: colab.email,
          cargo: colab.cargo,
          departamento: colab.departamento,
          jornada_inicio: colab.jornadaInicio,
          jornada_fim: colab.jornadaFim,
          pin: colab.pin,
          avatar: colab.avatar,
          status: colab.status,
          tipo_contrato: colab.tipoContrato,
          fotos_faciais: colab.fotosFaciais || []
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          newColab.id = json.data.id;
          memoryColaboradores = [newColab, ...memoryColaboradores];
          return newColab;
        }
      }
    } catch {
      // Fallback
    }

    // 2. Tentar via Supabase client
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('colaboradores')
        .insert({
          empresa_id: companyId,
          nome: colab.nome,
          cpf: colab.cpf,
          email: colab.email,
          cargo: colab.cargo,
          departamento: colab.departamento,
          jornada_inicio: colab.jornadaInicio,
          jornada_fim: colab.jornadaFim,
          pin: colab.pin,
          avatar: colab.avatar,
          fotos_faciais: colab.fotosFaciais || [],
          status: colab.status,
          tipo_contrato: colab.tipoContrato
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao cadastrar colaborador no Supabase: ${error.message}`);
      }

      if (data) {
        newColab.id = data.id;
      }
    }

    memoryColaboradores = [newColab, ...memoryColaboradores];
    return newColab;
  },

  async deleteColaborador(companyId: string, id: string): Promise<void> {
    // 1. Backend API
    try {
      const res = await fetch(`/api/colaboradores/${id}`, { method: 'DELETE' });
      if (res.ok) {
        memoryColaboradores = memoryColaboradores.filter(c => c.id !== id);
        return;
      }
    } catch {
      // Continua
    }

    // 2. Supabase client
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('colaboradores')
        .delete()
        .eq('id', id)
        .eq('empresa_id', companyId);

      if (error) {
        throw new Error(`Erro ao excluir colaborador no Supabase: ${error.message}`);
      }
    }

    memoryColaboradores = memoryColaboradores.filter(c => c.id !== id);
  },

  // -----------------------------------------------------------------------
  // REGISTROS DE PONTO (Motor de Ponto & TimeClock Logs)
  // -----------------------------------------------------------------------
  async listRegistros(companyId: string): Promise<RegistroPonto[]> {
    // 1. Tentar via backend API
    try {
      const res = await fetch(`/api/registros?empresa_id=${companyId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          return json.data.map((r: any) => ({
            id: r.id,
            empresaId: r.empresa_id,
            colaboradorId: r.colaborador_id,
            colaboradorNome: r.colaborador_nome,
            data: r.data,
            horario: r.horario,
            tipo: r.tipo,
            metodo: r.metodo,
            status: r.status,
            diferencaMinutos: r.diferenca_minutos,
            observacao: r.observacao,
            localizacao: r.localizacao
          }));
        }
      }
    } catch {
      // Fallback
    }

    // 2. Tentar via cliente Supabase
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('registros_ponto')
        .select('*')
        .eq('empresa_id', companyId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          empresaId: r.empresa_id,
          colaboradorId: r.colaborador_id,
          colaboradorNome: r.colaborador_nome,
          data: r.data,
          horario: r.horario,
          tipo: r.tipo,
          metodo: r.metodo,
          status: r.status,
          diferencaMinutos: r.diferenca_minutos,
          observacao: r.observacao,
          localizacao: r.localizacao
        }));
      }
    }

    return memoryRegistros.filter(r => r.empresaId === companyId);
  },

  async createRegistro(companyId: string, reg: Omit<RegistroPonto, 'id'>): Promise<RegistroPonto> {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'reg-' + Date.now();
    const newReg: RegistroPonto = { ...reg, id: tempId, empresaId: companyId };

    // 1. Backend API
    try {
      const res = await fetch('/api/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: companyId,
          colaborador_id: reg.colaboradorId,
          colaborador_nome: reg.colaboradorNome,
          data: reg.data,
          horario: reg.horario,
          tipo: reg.tipo,
          metodo: reg.metodo,
          status: reg.status,
          diferenca_minutos: reg.diferencaMinutos,
          observacao: reg.observacao || null,
          localizacao: reg.localizacao || 'Terminal Totem'
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          newReg.id = json.data.id;
          memoryRegistros = [newReg, ...memoryRegistros];
          return newReg;
        }
      }
    } catch {
      // Fallback
    }

    // 2. Supabase client
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('registros_ponto')
        .insert({
          empresa_id: companyId,
          colaborador_id: reg.colaboradorId,
          colaborador_nome: reg.colaboradorNome,
          data: reg.data,
          horario: reg.horario,
          tipo: reg.tipo,
          metodo: reg.metodo,
          status: reg.status,
          diferenca_minutos: reg.diferencaMinutos,
          observacao: reg.observacao || null,
          localizacao: reg.localizacao || 'Terminal Totem'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao registrar ponto no Supabase: ${error.message}`);
      }

      if (data) {
        newReg.id = data.id;
      }
    }

    memoryRegistros = [newReg, ...memoryRegistros];
    return newReg;
  },

  // -----------------------------------------------------------------------
  // CONFIGURAÇÕES DE JORNADA / REGRAS DE TOLERÂNCIA
  // -----------------------------------------------------------------------
  async getConfig(companyId: string): Promise<RegraToleranciaConfig> {
    // 1. Backend API
    try {
      const res = await fetch(`/api/configuracoes?empresa_id=${companyId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          return {
            toleranciaNormalMinutos: json.data.tolerancia_normal_minutos,
            toleranciaAtrasoLeveMinutos: json.data.tolerancia_atraso_leve_minutos,
            atrasoCriticoMinutos: json.data.atraso_critico_minutos,
            antecipacaoPermitidaMinutos: json.data.antecipacao_permitida_minutos
          };
        }
      }
    } catch {
      // Fallback
    }

    // 2. Supabase client
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('configuracoes_jornada')
        .select('*')
        .eq('empresa_id', companyId)
        .maybeSingle();

      if (!error && data) {
        return {
          toleranciaNormalMinutos: data.tolerancia_normal_minutos,
          toleranciaAtrasoLeveMinutos: data.tolerancia_atraso_leve_minutos,
          atrasoCriticoMinutos: data.atraso_critico_minutos,
          antecipacaoPermitidaMinutos: data.antecipacao_permitida_minutos
        };
      }
    }

    return { ...memoryConfig };
  },

  async updateConfig(companyId: string, newConfig: RegraToleranciaConfig): Promise<void> {
    memoryConfig = { ...newConfig };

    // 1. Backend API
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: companyId,
          tolerancia_normal_minutos: newConfig.toleranciaNormalMinutos,
          tolerancia_atraso_leve_minutos: newConfig.toleranciaAtrasoLeveMinutos,
          atraso_critico_minutos: newConfig.atrasoCriticoMinutos,
          antecipacao_permitida_minutos: newConfig.antecipacaoPermitidaMinutos
        })
      });
      if (res.ok) return;
    } catch {
      // Fallback
    }

    // 2. Supabase client
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('configuracoes_jornada')
        .upsert({
          empresa_id: companyId,
          tolerancia_normal_minutos: newConfig.toleranciaNormalMinutos,
          tolerancia_atraso_leve_minutos: newConfig.toleranciaAtrasoLeveMinutos,
          atraso_critico_minutos: newConfig.atrasoCriticoMinutos,
          antecipacao_permitida_minutos: newConfig.antecipacaoPermitidaMinutos
        });

      if (error) {
        throw new Error(`Erro ao atualizar configurações no Supabase: ${error.message}`);
      }
    }
  }
};
