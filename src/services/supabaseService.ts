import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Empresa, Colaborador, RegistroPonto, RegraToleranciaConfig, Perfil } from '../types/ponto';
import { defaultConfiguracao } from '../utils/toleranceEngine';

// =========================================================================
// SUPABASE DATABASE SERVICE (100% POSTGRESQL / SUPABASE - ZERO LOCALSTORAGE)
// =========================================================================

export const supabaseDataService = {
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
        if (Array.isArray(json.data)) {
          return json.data.map((d: any) => ({
            id: d.id,
            nome: d.nome,
            cnpj: d.cnpj,
            emailContato: d.email_contato || d.email || '',
            codigoAcesso: d.codigo_acesso || d.codigo_totem || '',
            senhaDispositivo: d.senha_dispositivo || '',
            senhaGestor: d.senha_gestor || '',
            cidade: d.cidade || 'Brasil'
          }));
        }
      }
    } catch {
      // Backend não acessível
    }

    // 2. Tentar via Supabase client (anon)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            nome: d.nome,
            cnpj: d.cnpj,
            emailContato: d.email_contato || d.email || '',
            codigoAcesso: d.codigo_acesso || d.codigo_totem || '',
            senhaDispositivo: d.senha_dispositivo || '',
            senhaGestor: d.senha_gestor || '',
            cidade: d.cidade || 'Brasil'
          }));
        }
      } catch (err) {
        console.warn('Erro ao consultar via cliente Supabase:', err);
      }
    }

    return [];
  },

  async updateEmpresa(id: string, updates: Partial<Empresa>): Promise<void> {
    try {
      const res = await fetch(`/api/empresas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) return;
    } catch (err) {
      console.error('Erro ao atualizar empresa via API:', err);
    }

    if (isSupabaseConfigured && supabase) {
      const dbUpdates: any = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.cnpj !== undefined) dbUpdates.cnpj = updates.cnpj;
      if (updates.emailContato !== undefined) dbUpdates.email_contato = updates.emailContato;
      if (updates.codigoAcesso !== undefined) dbUpdates.codigo_acesso = updates.codigoAcesso;
      if (updates.senhaDispositivo !== undefined) dbUpdates.senha_dispositivo = updates.senhaDispositivo;
      if (updates.senhaGestor !== undefined) dbUpdates.senha_gestor = updates.senhaGestor;
      if (updates.cidade !== undefined) dbUpdates.cidade = updates.cidade;

      const { error } = await supabase
        .from('empresas')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao atualizar empresa no Supabase: ${error.message}`);
      }
    }
  },

  async createEmpresa(empresa: Omit<Empresa, 'id'>): Promise<Empresa> {
    // 1. Tentar via backend API seguro
    try {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empresa)
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data?.id) {
        return {
          id: json.data.id,
          nome: json.data.nome,
          cnpj: json.data.cnpj,
          emailContato: json.data.email_contato || empresa.emailContato,
          codigoAcesso: json.data.codigo_acesso || empresa.codigoAcesso,
          senhaDispositivo: json.data.senha_dispositivo || empresa.senhaDispositivo,
          senhaGestor: json.data.senha_gestor || empresa.senhaGestor,
          cidade: json.data.cidade || empresa.cidade || 'Brasil'
        };
      } else if (json.error) {
        throw new Error(json.error);
      }
    } catch (apiErr: any) {
      if (apiErr?.message && !apiErr.message.includes('fetch')) {
        throw apiErr;
      }
    }

    // 2. Tentar via Supabase client (anon)
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
        // Registra perfil do gestor
        if (empresa.emailContato) {
          try {
            await supabase.from('perfis').insert({
              empresa_id: data.id,
              nome: `Gestor - ${empresa.nome}`,
              email: empresa.emailContato,
              role: 'gestor'
            });
          } catch {
            // Ignora se tabela perfis não existir
          }
        }

        return {
          id: data.id,
          nome: data.nome,
          cnpj: data.cnpj,
          emailContato: data.email_contato || empresa.emailContato,
          codigoAcesso: data.codigo_acesso || empresa.codigoAcesso,
          senhaDispositivo: data.senha_dispositivo || empresa.senhaDispositivo,
          senhaGestor: data.senha_gestor || empresa.senhaGestor,
          cidade: data.cidade || empresa.cidade || 'Brasil'
        };
      }
    }

    throw new Error('Não foi possível conectar ao banco de dados Supabase para cadastrar a empresa.');
  },

  async deleteEmpresa(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
      if (res.ok) return;
    } catch {
      // Ignora erro de rede e tenta cliente
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('configuracoes_jornada').delete().eq('empresa_id', id);
        await supabase.from('registros_ponto').delete().eq('empresa_id', id);
        await supabase.from('colaboradores').delete().eq('empresa_id', id);
        await supabase.from('perfis').delete().eq('empresa_id', id);
      } catch (cascadeErr) {
        console.warn('Erro ao limpar dependências:', cascadeErr);
      }

      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao deletar empresa no Supabase: ${error.message}`);
      }
    }
  },

  async updateSenhaGestor(empresaId: string, novaSenha: string): Promise<void> {
    try {
      await fetch(`/api/empresas/${empresaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha_gestor: novaSenha })
      });
    } catch {
      // Ignora
    }

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('empresas')
        .update({ senha_gestor: novaSenha })
        .eq('id', empresaId);
    }
  },

  // -----------------------------------------------------------------------
  // PERFIS
  // -----------------------------------------------------------------------
  async listPerfis(empresaId: string): Promise<Perfil[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
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

      if (!error && data) {
        return {
          id: data.id,
          empresaId: data.empresa_id,
          nome: data.nome,
          email: data.email,
          role: data.role,
          createdAt: data.created_at
        };
      }
    }

    throw new Error('Erro ao criar perfil no banco de dados.');
  },

  // -----------------------------------------------------------------------
  // COLABORADORES
  // -----------------------------------------------------------------------
  async listColaboradores(companyId: string): Promise<Colaborador[]> {
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

    return [];
  },

  async createColaborador(companyId: string, colab: Colaborador): Promise<Colaborador> {
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
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data?.id) {
        return {
          ...colab,
          id: json.data.id,
          empresaId: companyId
        };
      } else if (json.error) {
        throw new Error(json.error);
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch')) {
        throw err;
      }
    }

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
        return {
          ...colab,
          id: data.id,
          empresaId: companyId
        };
      }
    }

    throw new Error('Não foi possível salvar o colaborador no banco de dados.');
  },

  async deleteColaborador(companyId: string, id: string): Promise<void> {
    try {
      const res = await fetch(`/api/colaboradores/${id}`, { method: 'DELETE' });
      if (res.ok) return;
    } catch {
      // Continua
    }

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
  },

  // -----------------------------------------------------------------------
  // REGISTROS DE PONTO
  // -----------------------------------------------------------------------
  async listRegistros(companyId: string): Promise<RegistroPonto[]> {
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

    return [];
  },

  async createRegistro(companyId: string, reg: Omit<RegistroPonto, 'id'>): Promise<RegistroPonto> {
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
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data?.id) {
        return {
          ...reg,
          id: json.data.id,
          empresaId: companyId
        };
      } else if (json.error) {
        throw new Error(json.error);
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch')) {
        throw err;
      }
    }

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
        return {
          ...reg,
          id: data.id,
          empresaId: companyId
        };
      }
    }

    throw new Error('Não foi possível registrar o ponto no banco de dados.');
  },

  // -----------------------------------------------------------------------
  // CONFIGURAÇÕES DE JORNADA
  // -----------------------------------------------------------------------
  async getConfig(companyId: string): Promise<RegraToleranciaConfig> {
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

    return { ...defaultConfiguracao };
  },

  async updateConfig(companyId: string, newConfig: RegraToleranciaConfig): Promise<void> {
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
