import { Colaborador, RegistroPonto, Empresa } from '../types/ponto';

export const initialEmpresas: Empresa[] = [
  {
    id: 'emp-tech',
    nome: 'TechCorp Soluções Digitais',
    cnpj: '12.345.678/0001-90',
    emailContato: 'admin@techcorp.com',
    senhaDispositivo: 'tech2026',
    senhaGestor: 'admin123',
    codigoAcesso: 'TECH123',
    cidade: 'São Paulo - SP'
  },
  {
    id: 'emp-inova',
    nome: 'Inova Varejo & Logística',
    cnpj: '98.765.432/0001-10',
    emailContato: 'gestao@inova.com',
    senhaDispositivo: 'inova2026',
    senhaGestor: 'inova123',
    codigoAcesso: 'INOVA456',
    cidade: 'Curitiba - PR'
  }
];

export const initialColaboradores: Colaborador[] = [
  // Colaboradores da Empresa TechCorp
  {
    id: 'col-1',
    empresaId: 'emp-tech',
    nome: 'Ana Clara Souza',
    cpf: '123.456.789-01',
    email: 'ana.souza@techcorp.com',
    cargo: 'Engenheira de Software Sênior',
    departamento: 'Tecnologia',
    jornadaInicio: '08:00',
    jornadaFim: '17:00',
    pin: '1234',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    tipoContrato: 'CLT'
  },
  {
    id: 'col-2',
    empresaId: 'emp-tech',
    nome: 'Carlos Eduardo Silva',
    cpf: '234.567.890-12',
    email: 'carlos.silva@techcorp.com',
    cargo: 'Gerente de Projetos',
    departamento: 'Gestão',
    jornadaInicio: '08:30',
    jornadaFim: '17:30',
    pin: '2345',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    tipoContrato: 'CLT'
  },
  {
    id: 'col-3',
    empresaId: 'emp-tech',
    nome: 'Mariana Oliveira Costa',
    cpf: '345.678.901-23',
    email: 'mariana.costa@techcorp.com',
    cargo: 'Analista de Recursos Humanos',
    departamento: 'RH',
    jornadaInicio: '09:00',
    jornadaFim: '18:00',
    pin: '3456',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    tipoContrato: 'CLT'
  },

  // Colaboradores da Empresa Inova Varejo
  {
    id: 'col-4',
    empresaId: 'emp-inova',
    nome: 'Roberto Alves Mendes',
    cpf: '456.789.012-34',
    email: 'roberto.alves@inova.com',
    cargo: 'Supervisor de Logística',
    departamento: 'Operações',
    jornadaInicio: '07:00',
    jornadaFim: '16:00',
    pin: '4321',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    tipoContrato: 'CLT'
  },
  {
    id: 'col-5',
    empresaId: 'emp-inova',
    nome: 'Juliana Prado Rocha',
    cpf: '567.890.123-45',
    email: 'juliana.prado@inova.com',
    cargo: 'Coordenadora de Vendas',
    departamento: 'Comercial',
    jornadaInicio: '08:00',
    jornadaFim: '17:00',
    pin: '5432',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    tipoContrato: 'CLT'
  },
  {
    id: 'col-6',
    empresaId: 'emp-inova',
    nome: 'Bruno Siqueira Santos',
    cpf: '678.901.234-56',
    email: 'bruno.siqueira@inova.com',
    cargo: 'Assistente Administrativo',
    departamento: 'Financeiro',
    jornadaInicio: '08:30',
    jornadaFim: '17:30',
    pin: '6543',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    tipoContrato: 'CLT'
  }
];

const hojeStr = new Date().toISOString().split('T')[0];

export const initialRegistros: RegistroPonto[] = [
  // Registros TechCorp
  {
    id: 'reg-1',
    empresaId: 'emp-tech',
    colaboradorId: 'col-1',
    colaboradorNome: 'Ana Clara Souza',
    data: hojeStr,
    horario: '07:52:10',
    tipo: 'entrada',
    metodo: 'facial',
    status: 'antecipacao',
    diferencaMinutos: 8,
    localizacao: 'TechCorp - São Paulo (Recepção)'
  },
  {
    id: 'reg-2',
    empresaId: 'emp-tech',
    colaboradorId: 'col-2',
    colaboradorNome: 'Carlos Eduardo Silva',
    data: hojeStr,
    horario: '08:32:45',
    tipo: 'entrada',
    metodo: 'cpf_pin',
    status: 'tolerancia',
    diferencaMinutos: 2,
    localizacao: 'TechCorp - São Paulo (Recepção)'
  },

  // Registros Inova Varejo
  {
    id: 'reg-3',
    empresaId: 'emp-inova',
    colaboradorId: 'col-4',
    colaboradorNome: 'Roberto Alves Mendes',
    data: hojeStr,
    horario: '06:58:15',
    tipo: 'entrada',
    metodo: 'facial',
    status: 'antecipacao',
    diferencaMinutos: 2,
    localizacao: 'Inova - CD Curitiba (Recepção)'
  },
  {
    id: 'reg-4',
    empresaId: 'emp-inova',
    colaboradorId: 'col-5',
    colaboradorNome: 'Juliana Prado Rocha',
    data: hojeStr,
    horario: '08:04:10',
    tipo: 'entrada',
    metodo: 'cpf_pin',
    status: 'no_horario',
    diferencaMinutos: 4,
    localizacao: 'Inova - CD Curitiba (Recepção)'
  }
];
