export type TipoMarcacao = 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';

export type StatusPonto = 
  | 'no_horario' 
  | 'tolerancia' 
  | 'atraso_leve' 
  | 'atraso_critico' 
  | 'antecipacao' 
  | 'hora_extra';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  codigoAcesso: string;
  emailContato: string;
  senhaDispositivo: string;
  senhaGestor: string;
  cidade?: string;
}

export interface Perfil {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  role: 'admin' | 'gestor' | 'colaborador';
  createdAt?: string;
}

export interface UsuarioGestor {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'gestor' | 'colaborador';
  empresaId: string;
  empresaNome: string;
}

export interface Colaborador {
  id: string;
  empresaId: string;
  nome: string;
  cpf: string;
  email: string;
  cargo: string;
  departamento: string;
  jornadaInicio: string; // ex: "08:00"
  jornadaFim: string;    // ex: "17:00"
  pin: string;           // ex: "1234"
  avatar: string;
  fotosFaciais?: string[]; // Pelo menos 3 fotos faciais compactadas em WebP
  status: 'ativo' | 'ferias' | 'afastado';
  tipoContrato: 'CLT' | 'PJ' | 'Estágio';
}

export interface RegistroPonto {
  id: string;
  empresaId: string;
  colaboradorId: string;
  colaboradorNome: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM:SS
  tipo: TipoMarcacao;
  metodo: 'facial' | 'cpf_pin' | 'manual';
  status: StatusPonto;
  diferencaMinutos: number; // Negativo = atraso, Positivo = antecipação/hora extra
  observacao?: string;
  localizacao?: string;
}

export interface RegraToleranciaConfig {
  toleranciaNormalMinutos: number; // ex: 5 (até 5 min sem penalidade)
  toleranciaAtrasoLeveMinutos: number; // ex: 9 (6 a 9 min)
  atrasoCriticoMinutos: number; // ex: 10 (10+ min desconto/banco negativo desde o 1º min)
  antecipacaoPermitidaMinutos: number; // ex: 15 (até 15 min antes gera banco positivo)
}

export interface SaldoBancoHoras {
  colaboradorId: string;
  colaboradorNome: string;
  departamento: string;
  saldoMinutos: number; // positivo ou negativo
}
