'use client';

import { useState, useMemo } from 'react';
import { 
  FileText, Download, Printer, Calendar, User, 
  CheckCircle, AlertTriangle, Clock, TrendingUp, TrendingDown,
  Building2, Sparkles, X, ChevronDown
} from 'lucide-react';
import { Colaborador, RegistroPonto, Empresa, RegraToleranciaConfig } from '../types/ponto';
import { formatarStatusLabel } from '../utils/toleranceEngine';

interface RelatoriosPontoProps {
  colaboradores: Colaborador[];
  registros: RegistroPonto[];
  empresaAtiva: Empresa;
  config: RegraToleranciaConfig;
}

interface LinhaEspelhoDia {
  diaNumero: number;
  dataStr: string; // YYYY-MM-DD
  diaSemana: string;
  isFimDeSemana: boolean;
  entrada?: string;
  almocoSaida?: string;
  almocoRetorno?: string;
  saida?: string;
  statusGeral: string;
  statusBadgeClass: string;
  saldoMinutosDia: number;
  horasTrabalhadasStr: string;
  observacoes: string;
}

export function RelatoriosPonto({
  colaboradores,
  registros,
  empresaAtiva,
  config,
}: RelatoriosPontoProps) {
  const [selectedColabId, setSelectedColabId] = useState<string>(colaboradores[0]?.id || '');
  const [selectedMesAno, setSelectedMesAno] = useState<string>(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  });

  const [showPdfModal, setShowPdfModal] = useState(false);

  const colaboradorSelecionado = useMemo(() => {
    return colaboradores.find((c) => c.id === selectedColabId) || colaboradores[0];
  }, [colaboradores, selectedColabId]);

  // Gera todas as linhas diárias do mês selecionado
  const { linhasEspelho, metricasMes } = useMemo(() => {
    if (!colaboradorSelecionado || !selectedMesAno) {
      return { linhasEspelho: [], metricasMes: { totalDias: 0, atrasos: 0, bancoPositivoMinutos: 0, saldoConsolidadoMinutos: 0 } };
    }

    const [anoStr, mesStr] = selectedMesAno.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10); // 1 a 12

    const diasNoMes = new Date(ano, mes, 0).getDate();
    const linhas: LinhaEspelhoDia[] = [];

    let totalAtrasos = 0;
    let totalPontual = 0;
    let totalAntecipacoes = 0;
    let saldoConsolidadoMinutos = 0;

    const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let d = 1; d <= diasNoMes; d++) {
      const diaFormatted = String(d).padStart(2, '0');
      const dataStr = `${anoStr}-${mesStr}-${diaFormatted}`;
      const dataObj = new Date(ano, mes - 1, d);
      const diaSemanaNum = dataObj.getDay();
      const isFimDeSemana = diaSemanaNum === 0 || diaSemanaNum === 6;

      // Buscar registros do colaborador neste dia
      const registrosDia = registros.filter(
        (r) => r.colaboradorId === colaboradorSelecionado.id && r.data === dataStr
      );

      const regEntrada = registrosDia.find((r) => r.tipo === 'entrada');
      const regAlmocoS = registrosDia.find((r) => r.tipo === 'inicio_almoco');
      const regAlmocoR = registrosDia.find((r) => r.tipo === 'fim_almoco');
      const regSaida = registrosDia.find((r) => r.tipo === 'saida');

      let statusGeral = isFimDeSemana ? 'Folga / DSR' : 'Sem Registro';
      let statusBadgeClass = isFimDeSemana 
        ? 'bg-slate-100 text-slate-500 border-slate-200' 
        : 'bg-slate-50 text-slate-400 border-slate-200';
      let saldoMinutosDia = 0;
      let horasTrabalhadasStr = '--:--';
      let observacoes = '';

      if (regEntrada) {
        const statusInfo = formatarStatusLabel(regEntrada.status);
        statusGeral = statusInfo.label;
        statusBadgeClass = statusInfo.badgeClass;

        if (regEntrada.status === 'atraso_leve' || regEntrada.status === 'atraso_critico') {
          totalAtrasos++;
          saldoMinutosDia = -regEntrada.diferencaMinutos;
          observacoes = `Atraso de ${regEntrada.diferencaMinutos}m`;
        } else if (regEntrada.status === 'antecipacao') {
          totalAntecipacoes++;
          saldoMinutosDia = regEntrada.diferencaMinutos;
          observacoes = `B. Positivo +${regEntrada.diferencaMinutos}m`;
        } else {
          totalPontual++;
        }

        saldoConsolidadoMinutos += saldoMinutosDia;

        // Horas estimadas
        if (regSaida) {
          horasTrabalhadasStr = '08:00';
        } else {
          horasTrabalhadasStr = '04:00 (Parcial)';
        }
      }

      linhas.push({
        diaNumero: d,
        dataStr,
        diaSemana: diasSemanaNomes[diaSemanaNum],
        isFimDeSemana,
        entrada: regEntrada?.horario.substring(0, 5),
        almocoSaida: regAlmocoS?.horario.substring(0, 5),
        almocoRetorno: regAlmocoR?.horario.substring(0, 5),
        saida: regSaida?.horario.substring(0, 5),
        statusGeral,
        statusBadgeClass,
        saldoMinutosDia,
        horasTrabalhadasStr,
        observacoes
      });
    }

    return {
      linhasEspelho: linhas,
      metricasMes: {
        totalDias: diasNoMes,
        atrasos: totalAtrasos,
        pontualidades: totalPontual,
        antecipacoes: totalAntecipacoes,
        saldoConsolidadoMinutos
      }
    };
  }, [colaboradorSelecionado, selectedMesAno, registros]);

  // Exportar para Excel / CSV
  const handleExportCsv = () => {
    if (!colaboradorSelecionado) return;

    let csvContent = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentuação
    csvContent += 'Data;Dia Sem;Entrada;Almoco Saida;Almoco Retorno;Saida;Horas Trab;Status;Saldo (Min);Observacoes\n';

    linhasEspelho.forEach((l) => {
      csvContent += `${l.dataStr};${l.diaSemana};${l.entrada || '--'};${l.almocoSaida || '--'};${l.almocoRetorno || '--'};${l.saida || '--'};${l.horasTrabalhadasStr};${l.statusGeral};${l.saldoMinutosDia};${l.observacoes || '-'}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanNome = colaboradorSelecionado.nome.replace(/\s+/g, '_');
    link.setAttribute('download', `espelho_ponto_${cleanNome}_${selectedMesAno}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir ou Salvar PDF nativo
  const handlePrintPdf = () => {
    setShowPdfModal(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const saldoHoras = Math.floor(Math.abs(metricasMes.saldoConsolidadoMinutos) / 60);
  const saldoMinutosRestantes = Math.abs(metricasMes.saldoConsolidadoMinutos) % 60;
  const isSaldoPositivo = metricasMes.saldoConsolidadoMinutos >= 0;

  return (
    <div className="space-y-6">
      {/* Header & Filtros */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              <FileText className="w-4 h-4" />
              <span>Relatório Mensal & Espelho de Ponto Individual</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Controle de Frequência e Banco de Horas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Empresa: <strong>{empresaAtiva.nome}</strong> • CNPJ: {empresaAtiva.cnpj}
            </p>
          </div>

          {/* Botões de Exportação */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center space-x-2 transition shadow-sm"
              title="Exportar planilha compatível com Microsoft Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel (CSV)</span>
            </button>
            <button
              onClick={handlePrintPdf}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-2 transition shadow-lg shadow-blue-600/20"
              title="Visualizar e Imprimir Espelho de Ponto para Assinatura em PDF"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Gerar PDF / Imprimir</span>
            </button>
          </div>
        </div>

        {/* Filtros de Seleção */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Colaborador:
            </label>
            <select
              value={selectedColabId}
              onChange={(e) => setSelectedColabId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
            >
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.cargo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Mês / Ano de Referência:
            </label>
            <input
              type="month"
              value={selectedMesAno}
              onChange={(e) => setSelectedMesAno(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Escala Contratual:
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 font-mono">
              {colaboradorSelecionado?.jornadaInicio} às {colaboradorSelecionado?.jornadaFim} (1h almoço)
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas e Fechamento do Banco de Horas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Dias no Horário</div>
            <div className="text-2xl font-bold text-slate-900">{metricasMes.pontualidades || 0}</div>
            <div className="text-[11px] text-emerald-600 font-medium">Dentro da tolerância</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Ocorrências / Atrasos</div>
            <div className="text-2xl font-bold text-slate-900">{metricasMes.atrasos || 0}</div>
            <div className="text-[11px] text-rose-600 font-medium">Dias com atraso computado</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Antecipações / Extras</div>
            <div className="text-2xl font-bold text-slate-900">{metricasMes.antecipacoes || 0}</div>
            <div className="text-[11px] text-indigo-600 font-medium">Geraram banco positivo</div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm flex items-center space-x-3.5 ${
          isSaldoPositivo ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isSaldoPositivo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-600">Fechamento Banco de Horas</div>
            <div className={`text-2xl font-mono font-bold ${
              isSaldoPositivo ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {isSaldoPositivo ? '+' : '-'}{saldoHoras}h {saldoMinutosRestantes}m
            </div>
            <div className="text-[11px] font-semibold text-slate-600">
              Saldo consolidado do mês
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Detalhada: Espelho de Ponto Dia a Dia */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold text-slate-900">
            Espelho de Ponto Diário • {colaboradorSelecionado?.nome}
          </h4>
          <span className="text-xs text-slate-500 font-mono">
            Mês Ref: {selectedMesAno}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="pb-3 px-3">Data</th>
                <th className="pb-3 px-3">Dia</th>
                <th className="pb-3 px-3">Entrada</th>
                <th className="pb-3 px-3">Saída Almoço</th>
                <th className="pb-3 px-3">Retorno Almoço</th>
                <th className="pb-3 px-3">Saída</th>
                <th className="pb-3 px-3">Status / Ocorrência</th>
                <th className="pb-3 px-3 text-right">Saldo Dia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {linhasEspelho.map((linha) => (
                <tr 
                  key={linha.dataStr} 
                  className={`hover:bg-slate-50/80 transition ${linha.isFimDeSemana ? 'bg-slate-50/40 text-slate-400' : ''}`}
                >
                  <td className="py-3 px-3 font-mono text-slate-700">{linha.dataStr}</td>
                  <td className="py-3 px-3 font-semibold text-slate-600">{linha.diaSemana}</td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {linha.entrada || '--:--'}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">{linha.almocoSaida || '--:--'}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{linha.almocoRetorno || '--:--'}</td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {linha.saida || '--:--'}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${linha.statusBadgeClass}`}>
                      {linha.statusGeral}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {linha.saldoMinutosDia !== 0 ? (
                      <span className={linha.saldoMinutosDia > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {linha.saldoMinutosDia > 0 ? `+${linha.saldoMinutosDia}m` : `${linha.saldoMinutosDia}m`}
                      </span>
                    ) : (
                      <span className="text-slate-400">0m</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Impressão Estilizada / PDF */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 border border-slate-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Espelho de Ponto Eletrônico (Pronto para Impressão)</h3>
                <p className="text-xs text-slate-500">Documento formatado para arquivamento e assinatura física/digital</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Agora</span>
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Documento Folha Timbrada */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-xs text-slate-800 space-y-6">
              {/* Cabeçalho da Empresa */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{empresaAtiva.nome}</h4>
                  <p className="text-[11px] text-slate-500 font-mono">CNPJ: {empresaAtiva.cnpj}</p>
                  <p className="text-[11px] text-slate-500">{empresaAtiva.cidade || 'Brasil'}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs uppercase px-2.5 py-1 bg-slate-200 text-slate-800 rounded">
                    Espelho de Ponto Mensal
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Período: {selectedMesAno}</p>
                </div>
              </div>

              {/* Dados do Colaborador */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Colaborador</span>
                  <span className="font-bold text-slate-900">{colaboradorSelecionado?.nome}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CPF</span>
                  <span className="font-mono">{colaboradorSelecionado?.cpf}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cargo / Depto</span>
                  <span>{colaboradorSelecionado?.cargo} ({colaboradorSelecionado?.departamento})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Jornada Prevista</span>
                  <span className="font-mono">{colaboradorSelecionado?.jornadaInicio} - {colaboradorSelecionado?.jornadaFim}</span>
                </div>
              </div>

              {/* Tabela Compacta de Dias */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-[10px] text-left border-collapse">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Entrada</th>
                      <th className="p-2">Almoço</th>
                      <th className="p-2">Retorno</th>
                      <th className="p-2">Saída</th>
                      <th className="p-2">Ocorrência</th>
                      <th className="p-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linhasEspelho.slice(0, 15).map((l) => (
                      <tr key={l.dataStr}>
                        <td className="p-2 font-mono">{l.dataStr} ({l.diaSemana})</td>
                        <td className="p-2 font-mono font-bold">{l.entrada || '--'}</td>
                        <td className="p-2 font-mono">{l.almocoSaida || '--'}</td>
                        <td className="p-2 font-mono">{l.almocoRetorno || '--'}</td>
                        <td className="p-2 font-mono font-bold">{l.saida || '--'}</td>
                        <td className="p-2">{l.statusGeral}</td>
                        <td className="p-2 font-mono text-right font-bold">
                          {l.saldoMinutosDia > 0 ? `+${l.saldoMinutosDia}m` : l.saldoMinutosDia < 0 ? `${l.saldoMinutosDia}m` : '0m'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totalizador */}
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 font-bold text-xs">
                <span>Fechamento Consolidado do Banco de Horas no Mês:</span>
                <span className={`font-mono text-sm ${isSaldoPositivo ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isSaldoPositivo ? '+' : '-'}{saldoHoras}h {saldoMinutosRestantes}m
                </span>
              </div>

              {/* Campos de Assinatura */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-center">
                <div>
                  <div className="border-b border-slate-400 mb-2"></div>
                  <span className="font-semibold">{colaboradorSelecionado?.nome}</span>
                  <p className="text-[10px] text-slate-500">Assinatura do Colaborador</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 mb-2"></div>
                  <span className="font-semibold">{empresaAtiva.nome}</span>
                  <p className="text-[10px] text-slate-500">Assinatura do Gestor / RH</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
