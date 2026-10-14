'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Camera, KeyRound, CheckCircle2, UserCheck, AlertTriangle, 
  ArrowRight, Sparkles, RefreshCcw, Video, VideoOff,
  Delete, RotateCcw, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Colaborador, RegistroPonto, TipoMarcacao, RegraToleranciaConfig, Empresa } from '../types/ponto';
import { avaliarStatusPonto, formatarStatusLabel } from '../utils/toleranceEngine';

interface TerminalKioskProps {
  colaboradores: Colaborador[];
  onRegistrarPonto: (novoRegistro: Omit<RegistroPonto, 'id'>) => void;
  config: RegraToleranciaConfig;
  empresaAtiva: Empresa;
}

export function TerminalKiosk({ colaboradores, onRegistrarPonto, config, empresaAtiva }: TerminalKioskProps) {
  const [authMode, setAuthMode] = useState<'facial' | 'cpf'>('facial');
  const [tipoMarcacao, setTipoMarcacao] = useState<TipoMarcacao>('entrada');
  
  // Real Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // CPF & PIN state
  const [cpfInput, setCpfInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [activeKeypadField, setActiveKeypadField] = useState<'cpf' | 'pin'>('cpf');
  const [errorMsg, setErrorMsg] = useState('');

  // Facial simulation/selection state
  const [selectedColabId, setSelectedColabId] = useState<string>(colaboradores[0]?.id || '');
  const [isScanning, setIsScanning] = useState(false);

  // Success modal state
  const [ultimoRegistro, setUltimoRegistro] = useState<{
    colaborador: Colaborador;
    registro: RegistroPonto;
  } | null>(null);

  useEffect(() => {
    if (colaboradores.length > 0 && !colaboradores.some(c => c.id === selectedColabId)) {
      setSelectedColabId(colaboradores[0].id);
    }
  }, [colaboradores, selectedColabId]);

  // Start real webcam
  const startCamera = async () => {
    setCameraError('');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        setMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
      } else {
        setCameraError('Seu navegador não suporta acesso à câmera.');
      }
    } catch (err: any) {
      console.warn('Câmera indisponível ou permissão negada:', err);
      setCameraError('Permissão negada ou câmera desconectada. Operando em modo simulador.');
      setIsCameraActive(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  // Formatar CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  // Virtual Keypad handlers
  const handleKeypadPress = (digit: string) => {
    setErrorMsg('');
    if (activeKeypadField === 'cpf') {
      const currentDigits = cpfInput.replace(/\D/g, '');
      if (currentDigits.length < 11) {
        const nextDigits = currentDigits + digit;
        setCpfInput(formatCPF(nextDigits));
        if (nextDigits.length === 11) {
          setActiveKeypadField('pin');
        }
      } else {
        setActiveKeypadField('pin');
      }
    } else {
      if (pinInput.length < 4) {
        setPinInput(prev => prev + digit);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setErrorMsg('');
    if (activeKeypadField === 'pin') {
      if (pinInput.length > 0) {
        setPinInput(prev => prev.slice(0, -1));
      } else {
        setActiveKeypadField('cpf');
      }
    } else {
      const digits = cpfInput.replace(/\D/g, '');
      const newDigits = digits.slice(0, -1);
      setCpfInput(formatCPF(newDigits));
    }
  };

  const handleKeypadClear = () => {
    setErrorMsg('');
    if (activeKeypadField === 'pin' && pinInput.length > 0) {
      setPinInput('');
    } else {
      setCpfInput('');
      setPinInput('');
      setActiveKeypadField('cpf');
    }
  };

  const handleCpfSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const cleanCpf = cpfInput.replace(/[^\d]/g, '');
    const colab = colaboradores.find(
      (c) => c.cpf.replace(/[^\d]/g, '') === cleanCpf || c.cpf === cpfInput
    );

    if (!colab) {
      setErrorMsg(`CPF não encontrado no cadastro.`);
      return;
    }

    if (colab.pin !== pinInput) {
      setErrorMsg('PIN / Senha incorreta.');
      return;
    }

    efetuarRegistro(colab, 'cpf_pin');
  };

  const handleFacialCapture = () => {
    if (colaboradores.length === 0) {
      setErrorMsg('Nenhum colaborador cadastrado para esta empresa.');
      return;
    }
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const colab = colaboradores.find((c) => c.id === selectedColabId);
      if (colab) {
        efetuarRegistro(colab, 'facial');
      }
    }, 1100);
  };

  const efetuarRegistro = (colab: Colaborador, metodo: 'facial' | 'cpf_pin') => {
    const agora = new Date();
    const dataStr = agora.toISOString().split('T')[0];
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    const horarioRealizado = `${horas}:${minutos}:${segundos}`;
    const horarioCurto = `${horas}:${minutos}`;

    let horarioPrevisto = colab.jornadaInicio;
    if (tipoMarcacao === 'saida') {
      horarioPrevisto = colab.jornadaFim;
    }

    const { status, diferencaMinutos } = avaliarStatusPonto(
      tipoMarcacao,
      horarioPrevisto,
      horarioCurto,
      config
    );

    const novoRegistro: Omit<RegistroPonto, 'id'> = {
      empresaId: empresaAtiva.id,
      colaboradorId: colab.id,
      colaboradorNome: colab.nome,
      data: dataStr,
      horario: horarioRealizado,
      tipo: tipoMarcacao,
      metodo,
      status,
      diferencaMinutos,
      localizacao: `${empresaAtiva.nome} (Totem)`
    };

    onRegistrarPonto(novoRegistro);

    const registroCompleto: RegistroPonto = {
      ...novoRegistro,
      id: 'reg-' + Date.now()
    };

    setUltimoRegistro({
      colaborador: colab,
      registro: registroCompleto
    });

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.55 }
    });

    setCpfInput('');
    setPinInput('');
    setActiveKeypadField('cpf');
  };

  const tipoLabels: Record<TipoMarcacao, { label: string; desc: string }> = {
    entrada: { label: 'Entrada', desc: 'Início da jornada' },
    inicio_almoco: { label: 'Início Almoço', desc: 'Saída refeição' },
    fim_almoco: { label: 'Fim Almoço', desc: 'Retorno refeição' },
    saida: { label: 'Saída', desc: 'Fim da jornada' }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 md:px-6">
      {/* Modal de Sucesso Compacto e Centralizado */}
      {ultimoRegistro && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm w-full p-4 sm:p-6 text-center border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
            
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-inner">
              <CheckCircle2 className="w-7 h-7 sm:w-9 sm:h-9" />
            </div>

            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
              Ponto Confirmado
            </span>

            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              {ultimoRegistro.colaborador.nome}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {ultimoRegistro.colaborador.cargo}
            </p>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tipo:</span>
                <span className="font-bold text-slate-800">
                  {tipoLabels[ultimoRegistro.registro.tipo].label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Horário:</span>
                <span className="font-mono font-bold text-base text-slate-900">
                  {ultimoRegistro.registro.horario}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Situação:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${formatarStatusLabel(ultimoRegistro.registro.status).badgeClass}`}>
                  {formatarStatusLabel(ultimoRegistro.registro.status).label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Método:</span>
                <span className="font-medium text-slate-700 uppercase text-[10px]">
                  {ultimoRegistro.registro.metodo === 'facial' ? 'Reconhecimento Facial' : 'CPF & PIN'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setUltimoRegistro(null)}
              className="w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* Card Principal do Terminal (Otimizado Mobile-First) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-slate-200/90 overflow-hidden">
        
        {/* Seletor Compacto do Tipo de Marcação */}
        <div className="bg-slate-50/90 p-2.5 sm:p-4 border-b border-slate-200">

          {/* Botões dos 4 Tipos de Ponto (Uma única linha compacta) */}
          <div className="grid grid-cols-4 gap-1 sm:gap-2">
            {(['entrada', 'inicio_almoco', 'fim_almoco', 'saida'] as TipoMarcacao[]).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setTipoMarcacao(tipo)}
                className={`py-1.5 sm:py-2.5 px-1 sm:px-2 rounded-xl border text-center transition-all ${
                  tipoMarcacao === tipo
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
                  {tipoLabels[tipo].label}
                </div>
                <div className={`hidden sm:block text-[10px] mt-0.5 truncate ${tipoMarcacao === tipo ? 'text-blue-100' : 'text-slate-400'}`}>
                  {tipoLabels[tipo].desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Abas de Modo de Autenticação */}
        <div className="p-2.5 sm:p-5">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200 w-full sm:w-auto">
              <button
                onClick={() => setAuthMode('facial')}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  authMode === 'facial'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Reconhecimento Facial</span>
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  setAuthMode('cpf');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  authMode === 'cpf'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>CPF & PIN</span>
              </button>
            </div>
          </div>

          {/* MODO RECONHECIMENTO FACIAL */}
          {authMode === 'facial' && (
            <div className="max-w-md mx-auto">
              {/* Controle Rápido de Câmera */}
              <div className="flex items-center justify-between mb-2 px-1 text-xs">
                <span className="flex items-center space-x-1.5 text-slate-600 font-medium text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-500' : 'bg-cyan-500'} animate-pulse`}></span>
                  <span>{isCameraActive ? 'Câmera Ativa' : 'Sensor Simulado'}</span>
                </span>

                {isCameraActive ? (
                  <button
                    onClick={stopCamera}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-medium transition"
                  >
                    <VideoOff className="w-3 h-3 text-rose-500" />
                    <span>Desligar</span>
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-medium transition"
                  >
                    <Video className="w-3 h-3 text-blue-600" />
                    <span>Ligar Câmera</span>
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-lg flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Viewfinder Compacto da Câmera */}
              <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-md relative h-48 sm:h-64 flex flex-col items-center justify-center border-2 border-slate-800">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:14px_14px]"></div>
                )}
                
                {/* Moldura de Escaneamento */}
                <div className="relative z-10 w-36 h-36 sm:w-48 sm:h-48 rounded-2xl border-2 border-dashed border-cyan-400 flex items-center justify-center bg-cyan-950/20 backdrop-blur-2xs">
                  {isScanning ? (
                    <div className="flex flex-col items-center space-y-2 bg-slate-900/85 p-3 rounded-xl backdrop-blur-md">
                      <RefreshCcw className="w-8 h-8 text-cyan-400 animate-spin" />
                      <span className="text-[11px] font-medium text-cyan-300 animate-pulse text-center">
                        Identificando face...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center mb-1.5">
                        <UserCheck className="w-5 h-5 text-cyan-400" />
                      </div>
                      <p className="text-[10px] text-cyan-200 font-medium">
                        Posicione o rosto aqui
                      </p>
                    </div>
                  )}

                  {/* Cantos da mira */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>
                </div>
              </div>

              {/* Seletor do Colaborador + Botão de Ação */}
              <div className="mt-3">
                {colaboradores.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={selectedColabId}
                      onChange={(e) => setSelectedColabId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {colaboradores.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} ({c.cargo})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleFacialCapture}
                      disabled={isScanning}
                      className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Reconhecer e Registrar {tipoLabels[tipoMarcacao].label}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs text-center">
                    Nenhum colaborador encontrado para esta empresa. Cadastre no Painel Gestor.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODO CPF & PIN COM TECLADO NUMÉRICO VIRTUAL (TOUCH TOTEM) */}
          {authMode === 'cpf' && (
            <div className="max-w-xs mx-auto">
              <form onSubmit={handleCpfSubmit} className="space-y-2 sm:space-y-3">
                {/* Inputs de CPF e PIN Compactos */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setActiveKeypadField('cpf')}
                    className={`p-2 rounded-xl border cursor-pointer transition ${
                      activeKeypadField === 'cpf'
                        ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      CPF
                    </label>
                    <input
                      type="text"
                      value={cpfInput}
                      onChange={(e) => {
                        setCpfInput(formatCPF(e.target.value));
                        if (e.target.value.replace(/\D/g, '').length === 11) {
                          setActiveKeypadField('pin');
                        }
                      }}
                      placeholder="000.000.000-00"
                      className="w-full bg-transparent font-medium text-xs sm:text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div
                    onClick={() => setActiveKeypadField('pin')}
                    className={`p-2 rounded-xl border cursor-pointer transition ${
                      activeKeypadField === 'pin'
                        ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      PIN (4 dígitos)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="••••"
                      className="w-full bg-transparent font-mono text-center font-bold text-sm sm:text-base tracking-widest text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-lg flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Teclado Numérico Virtual para Totem / Telas Verticais */}
                <div className="bg-slate-100 p-2 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-3 gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadPress(digit)}
                        className="h-10 sm:h-11 bg-white hover:bg-slate-50 active:bg-blue-50 active:scale-95 text-slate-800 font-bold text-base rounded-xl border border-slate-200 shadow-2xs transition flex items-center justify-center"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleKeypadClear}
                      title="Limpar campos"
                      className="h-10 sm:h-11 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-600 font-bold text-xs rounded-xl border border-slate-300/80 transition flex items-center justify-center"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-10 sm:h-11 bg-white hover:bg-slate-50 active:bg-blue-50 active:scale-95 text-slate-800 font-bold text-base rounded-xl border border-slate-200 shadow-2xs transition flex items-center justify-center"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleKeypadBackspace}
                      title="Apagar dígito"
                      className="h-10 sm:h-11 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-600 font-bold text-xs rounded-xl border border-slate-300/80 transition flex items-center justify-center"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
                >
                  <span>Registrar {tipoLabels[tipoMarcacao].label}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
