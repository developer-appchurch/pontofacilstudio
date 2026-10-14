import { StatusPonto, RegraToleranciaConfig, TipoMarcacao } from '../types/ponto';

export const defaultConfiguracao: RegraToleranciaConfig = {
  toleranciaNormalMinutos: 5,
  toleranciaAtrasoLeveMinutos: 9,
  atrasoCriticoMinutos: 10,
  antecipacaoPermitidaMinutos: 15,
};

/**
 * Converte horário "HH:MM" para minutos totais desde a meia-noite
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calcula a diferença em minutos entre o horário realizado e o esperado.
 * Retorna (realizado - esperado).
 * Ex: esperado 08:00 (480 min), realizado 08:08 (488 min) -> diferença = +8 min (atraso de 8 min).
 * Ex: esperado 08:00 (480 min), realizado 07:50 (470 min) -> diferença = -10 min (10 min antes).
 */
export function calcularDiferencaMinutos(esperado: string, realizado: string): number {
  const minEsperado = timeToMinutes(esperado);
  const minRealizado = timeToMinutes(realizado);
  return minRealizado - minEsperado;
}

/**
 * Avalia o status e a tolerância de uma marcação de ponto
 */
export function avaliarStatusPonto(
  tipo: TipoMarcacao,
  horarioPrevisto: string,
  horarioRealizado: string,
  config: RegraToleranciaConfig = defaultConfiguracao
): { status: StatusPonto; diferencaMinutos: number } {
  const diff = calcularDiferencaMinutos(horarioPrevisto, horarioRealizado);

  if (tipo === 'entrada') {
    // diff > 0 significa que chegou DEPOIS do horário previsto (atraso)
    // diff < 0 significa que chegou ANTES do horário previsto (antecipação)
    if (diff <= 0) {
      const absDiff = Math.abs(diff);
      if (absDiff <= config.antecipacaoPermitidaMinutos) {
        return { status: absDiff === 0 ? 'no_horario' : 'antecipacao', diferencaMinutos: absDiff };
      } else {
        // Chegou muito cedo (> 15 min)
        return { status: 'antecipacao', diferencaMinutos: absDiff };
      }
    } else {
      // Chegou atrasado
      if (diff <= config.toleranciaNormalMinutos) {
        return { status: 'no_horario', diferencaMinutos: diff };
      } else if (diff <= config.toleranciaAtrasoLeveMinutos) {
        return { status: 'atraso_leve', diferencaMinutos: diff };
      } else {
        return { status: 'atraso_critico', diferencaMinutos: diff };
      }
    }
  } else if (tipo === 'saida') {
    // Para saída: diff < 0 significa saída antes do horário (saída antecipada / negativo)
    // diff > 0 significa saída após o horário (hora extra)
    if (diff >= 0) {
      return { status: 'hora_extra', diferencaMinutos: diff };
    } else {
      return { status: 'tolerancia', diferencaMinutos: diff };
    }
  } else {
    // Almoço
    return { status: 'no_horario', diferencaMinutos: diff };
  }
}

export function formatarStatusLabel(status: StatusPonto): { label: string; color: string; badgeClass: string } {
  switch (status) {
    case 'no_horario':
      return { label: 'No Horário', color: 'text-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'tolerancia':
      return { label: 'Tolerância', color: 'text-blue-600', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'atraso_leve':
      return { label: 'Atraso Leve', color: 'text-amber-600', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'atraso_critico':
      return { label: 'Atraso Crítico', color: 'text-rose-600', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'antecipacao':
      return { label: 'Antecipação / B. Positivo', color: 'text-indigo-600', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'hora_extra':
      return { label: 'Hora Extra', color: 'text-purple-600', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
    default:
      return { label: 'Normal', color: 'text-slate-600', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}
