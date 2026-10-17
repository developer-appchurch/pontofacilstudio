'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, KeyRound, CheckCircle2, UserCheck, AlertTriangle, 
  ArrowRight, Sparkles, RefreshCcw, Video, VideoOff,
  Delete, RotateCcw, XCircle, ScanFace, Clock, UserX,
  Pause, Play, ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Colaborador, RegistroPonto, TipoMarcacao, RegraToleranciaConfig, Empresa } from '../types/ponto';
import { avaliarStatusPonto, formatarStatusLabel } from '../utils/toleranceEngine';
import { useCompanyAuth } from '../context/CompanyAuthContext';
import { extractCanvasSignature, compareBiometricSignatures, getImageSignature, BiometricSignature } from '../utils/faceBiometrics';

interface TerminalKioskProps {
  colaboradores: Colaborador[];
  registros: RegistroPonto[];
  onRegistrarPonto: (novoRegistro: Omit<RegistroPonto, 'id'>) => void;
  config: RegraToleranciaConfig;
  empresaAtiva: Empresa;
}

export function TerminalKiosk({ colaboradores, registros, onRegistrarPonto, config, empresaAtiva }: TerminalKioskProps) {
  const { isManagerUnlocked, isMasterAdmin } = useCompanyAuth();
  const isAdm = isManagerUnlocked || isMasterAdmin;

  const [authMode, setAuthMode] = useState<'facial' | 'cpf'>('facial');
  const [tipoMarcacao, setTipoMarcacao] = useState<TipoMarcacao>('entrada');
  
  // Real Camera state & refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isCameraPausedByUserRef = useRef(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraPausedByUser, setIsCameraPausedByUser] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // CPF & PIN state
  const [cpfInput, setCpfInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [activeKeypadField, setActiveKeypadField] = useState<'cpf' | 'pin'>('cpf');
  const [errorMsg, setErrorMsg] = useState('');

  // Facial biometric state
  const [isScanning, setIsScanning] = useState(false);
  const [facialError, setFacialError] = useState('');
  const [facialStatus, setFacialStatus] = useState<'aguardando' | 'analisando' | 'encontrado' | 'nao_encontrado' | 'ja_registrado'>('aguardando');

  // Success modal state & auto-dismiss countdown
  const [ultimoRegistro, setUltimoRegistro] = useState<{
    colaborador: Colaborador;
    registro: RegistroPonto;
  } | null>(null);
  const [dismissCountdown, setDismissCountdown] = useState<number>(4);

  const isScanningRef = useRef(false);
  const isCooldownRef = useRef(false);
  const ultimoRegistroRef = useRef(ultimoRegistro);
  ultimoRegistroRef.current = ultimoRegistro;

  // Tocar som de confirmação ou erro usando Web Audio API
  const playFeedbackSound = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === 'success') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch {
      // Navegadores sem suporte silenciam suavemente
    }
  };

  // Start real webcam
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        mediaStreamRef.current = stream;
        setMediaStream(stream);
        setIsCameraActive(true);
      } else {
        setCameraError('Seu navegador não suporta acesso à câmera.');
      }
    } catch (err: any) {
      console.warn('Câmera indisponível ou permissão negada:', err);
      setCameraError('Permissão negada ou câmera desconectada. Você também pode bater ponto por CPF & PIN.');
      setIsCameraActive(false);
    }
  }, []);

  // Stop camera synchronously stopping all tracks
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, [mediaStream]);

  // Pausar câmera explicitamente (não reinicia no useEffect nem no intervalo)
  const handlePauseCamera = useCallback(() => {
    isCameraPausedByUserRef.current = true;
    setIsCameraPausedByUser(true);
    isScanningRef.current = false;
    setIsScanning(false);
    stopCamera();
  }, [stopCamera]);

  // Retomar / Ligar câmera
  const handleResumeCamera = useCallback(() => {
    isCameraPausedByUserRef.current = false;
    setIsCameraPausedByUser(false);
    setFacialError('');
    setFacialStatus('aguardando');
    startCamera();
  }, [startCamera]);

  // Iniciar câmera automaticamente ao carregar ou alternar para modo facial (se não pausada pelo usuário)
  useEffect(() => {
    if (authMode === 'facial' && !isCameraActive && !isCameraPausedByUserRef.current) {
      startCamera();
    }
  }, [authMode, isCameraActive, startCamera]);

  // Vincular o fluxo de vídeo assim que o elemento de vídeo estiver renderizado e o stream ativo
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [mediaStream, isCameraActive, authMode]);

  // Limpeza de streams ao desmontar
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  // Countdown para auto-fechar a notificação de confirmação e liberar para o próximo funcionário
  useEffect(() => {
    if (!ultimoRegistro) return;

    setDismissCountdown(4);
    const interval = setInterval(() => {
      setDismissCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setUltimoRegistro(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ultimoRegistro]);

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
      setErrorMsg('Colaborador não encontrado.');
      playFeedbackSound('error');
      return;
    }

    if (colab.pin !== pinInput) {
      setErrorMsg('PIN / Senha incorreta.');
      playFeedbackSound('error');
      return;
    }

    efetuarRegistro(colab, 'cpf_pin');
  };

  // Efetuar registro de ponto (comum a Facial e CPF/PIN)
  const efetuarRegistro = useCallback((colab: Colaborador, metodo: 'facial' | 'cpf_pin') => {
    const agora = new Date();

    // Validar se o colaborador já registrou ponto nos últimos 5 minutos (evitar duplicatas)
    const ultimoRegColab = registros
      .filter(r => r.colaboradorId === colab.id)
      .sort((a, b) => {
        const timeA = new Date(`${a.data}T${a.horario}`).getTime();
        const timeB = new Date(`${b.data}T${b.horario}`).getTime();
        return timeB - timeA;
      })[0];

    if (ultimoRegColab) {
      const timeUltimo = new Date(`${ultimoRegColab.data}T${ultimoRegColab.horario}`).getTime();
      const diffMinutos = (agora.getTime() - timeUltimo) / (1000 * 60);
      if (diffMinutos < 1) {
        const msg = 'Colaborador já registrado';
        if (metodo === 'facial') {
          setFacialStatus('ja_registrado');
          setFacialError(msg);
        } else {
          setErrorMsg(msg);
        }
        playFeedbackSound('error');
        return;
      }
    }

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

    playFeedbackSound('success');

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.55 }
    });

    setCpfInput('');
    setPinInput('');
    setActiveKeypadField('cpf');
  }, [tipoMarcacao, config, empresaAtiva, onRegistrarPonto, registros]);

  // Pré-computar e armazenar assinaturas biométricas em memória para validação instantânea (<50ms)
  const precomputedSignatures = useRef<Map<string, BiometricSignature[]>>(new Map());

  useEffect(() => {
    colaboradores.forEach(async (colab) => {
      const fotos = Array.isArray(colab.fotosFaciais) && colab.fotosFaciais.length > 0
        ? colab.fotosFaciais
        : (colab.avatar ? [colab.avatar] : []);

      const sigs: BiometricSignature[] = [];
      for (const f of fotos) {
        if (typeof f === 'string') {
          const sig = await getImageSignature(f);
          if (sig) sigs.push(sig);
        }
      }
      if (sigs.length > 0) {
        precomputedSignatures.current.set(colab.id, sigs);
      }
    });
  }, [colaboradores]);

  // Executar captura e validação facial (Instantânea com Biometria Local + IA Gemini de Backup)
  const executarCapturaEValidacao = useCallback(async (isAuto = false) => {
    if (colaboradores.length === 0) {
      setFacialError('Nenhum colaborador cadastrado para esta empresa.');
      setFacialStatus('nao_encontrado');
      return;
    }

    if (!isCameraActive || !videoRef.current) {
      if (!isAuto) {
        setIsCameraPausedByUser(false);
        await startCamera();
        setFacialError('Ativando câmera... Olhe para a lente para validar.');
      }
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setFacialStatus('analisando');

    try {
      const v = videoRef.current;
      const vw = v.videoWidth || 640;
      const vh = v.videoHeight || 480;

      // Recorte central focado no rosto (enquadramento da mira do totem)
      const cropSize = Math.floor(Math.min(vw, vh) * 0.75);
      const cropX = Math.floor((vw - cropSize) / 2);
      const cropY = Math.floor((vh - cropSize) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, cropX, cropY, cropSize, cropSize, 0, 0, 320, 320);
      }

      // 1. FAST-PATH: Validação Biométrica Instantânea Local (< 50ms)
      if (ctx && precomputedSignatures.current.size > 0) {
        const liveSignature = extractCanvasSignature(ctx, 320, 320);
        let bestColab: Colaborador | null = null;
        let highestSimilarity = 0;

        for (const colab of colaboradores) {
          const sigs = precomputedSignatures.current.get(colab.id) || [];
          for (const s of sigs) {
            const similarity = compareBiometricSignatures(liveSignature, s);
            if (similarity > highestSimilarity) {
              highestSimilarity = similarity;
              bestColab = colab;
            }
          }
        }

        // Se encontrou similaridade suficiente para a mesma pessoa na mesma posição (< 30ms)
        if (bestColab && highestSimilarity >= 0.68) {
          setFacialStatus('encontrado');
          setFacialError('');
          efetuarRegistro(bestColab, 'facial');

          // Cooldown de 5 segundos para não registrar repetidamente
          isCooldownRef.current = true;
          setTimeout(() => {
            isCooldownRef.current = false;
            setFacialStatus('aguardando');
          }, 5000);
          return;
        }
      }

      // 2. BACKUP PATH: Análise com IA Gemini 3.1 Flash-Lite com timeout de 4.5 segundos
      const frameData = canvas.toDataURL('image/jpeg', 0.72);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/reconhecimento-facial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          fotoCapturada: frameData,
          colaboradores: colaboradores.map((c) => ({
            id: c.id,
            nome: c.nome,
            cargo: c.cargo,
            avatar: c.avatar,
            fotosFaciais: c.fotosFaciais ? c.fotosFaciais.slice(0, 2) : [],
          })),
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (data.matched && data.colaboradorId) {
        const colab = colaboradores.find((c) => c.id === data.colaboradorId);
        if (colab) {
          setFacialStatus('encontrado');
          setFacialError('');
          efetuarRegistro(colab, 'facial');

          isCooldownRef.current = true;
          setTimeout(() => {
            isCooldownRef.current = false;
            setFacialStatus('aguardando');
          }, 5000);
          return;
        }
      }

      // Se a pessoa na câmera não for reconhecida
      setFacialStatus('nao_encontrado');
      setFacialError('Colaborador não encontrado');
      playFeedbackSound('error');

      // Cooldown de 3.5 segundos para que a mensagem de erro fique claramente visível
      isCooldownRef.current = true;
      setTimeout(() => {
        isCooldownRef.current = false;
        setFacialError((prev) => (prev === 'Colaborador não encontrado' || prev.includes('já registrou') ? '' : prev));
        setFacialStatus((prev) => (prev === 'nao_encontrado' || prev === 'ja_registrado' ? 'aguardando' : prev));
      }, 3500);
    } catch {
      setFacialStatus('nao_encontrado');
      setFacialError('Colaborador não encontrado');
      playFeedbackSound('error');

      isCooldownRef.current = true;
      setTimeout(() => {
        isCooldownRef.current = false;
        setFacialError((prev) => (prev === 'Colaborador não encontrado' || prev.includes('já registrou') ? '' : prev));
        setFacialStatus((prev) => (prev === 'nao_encontrado' || prev === 'ja_registrado' ? 'aguardando' : prev));
      }, 3500);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, [colaboradores, isCameraActive, startCamera, efetuarRegistro]);

  // Escaneamento facial contínuo automático no Totem (a cada 2.5 segundos se a câmera estiver vendo a pessoa e não estiver pausada)
  useEffect(() => {
    if (authMode !== 'facial' || !isCameraActive || isCameraPausedByUser) return;

    const interval = setInterval(() => {
      // Ignora se estiver escaneando, em cooldown, erro de não encontrado na tela, ou modal aberto
      if (
        isScanningRef.current || 
        isCooldownRef.current || 
        facialStatus === 'nao_encontrado' ||
        facialStatus === 'encontrado' ||
        ultimoRegistroRef.current !== null ||
        !videoRef.current || 
        videoRef.current.readyState < 2
      ) {
        return;
      }

      executarCapturaEValidacao(true);
    }, 2500);

    return () => clearInterval(interval);
  }, [authMode, isCameraActive, isCameraPausedByUser, facialStatus, executarCapturaEValidacao]);

  // Ação manual de captura (caso o usuário queira forçar na hora)
  const handleFacialCapture = () => {
    executarCapturaEValidacao(false);
  };

  const tipoLabels: Record<TipoMarcacao, { label: string; desc: string }> = {
    entrada: { label: 'Entrada', desc: 'Início da jornada' },
    inicio_almoco: { label: 'Início Almoço', desc: 'Saída refeição' },
    fim_almoco: { label: 'Fim Almoço', desc: 'Retorno refeição' },
    saida: { label: 'Saída', desc: 'Fim da jornada' }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 md:px-6">
      {/* Modal / Notificação de Validação com Sucesso */}
      {ultimoRegistro && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 sm:p-6 text-center border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse"></div>
            
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-emerald-50">
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
              ✓ Ponto Validado com Sucesso
            </span>

            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {ultimoRegistro.colaborador.nome}
            </h3>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              {ultimoRegistro.colaborador.cargo} • {empresaAtiva.nome}
            </p>

            <div className="bg-slate-50 rounded-2xl p-3.5 mb-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Marcação:</span>
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  {tipoLabels[ultimoRegistro.registro.tipo].label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Horário:</span>
                <span className="font-mono font-bold text-base text-slate-900">
                  {ultimoRegistro.registro.horario}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${formatarStatusLabel(ultimoRegistro.registro.status).badgeClass}`}>
                  {formatarStatusLabel(ultimoRegistro.registro.status).label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Método:</span>
                <span className="font-semibold text-emerald-700 text-[11px] flex items-center space-x-1">
                  <ScanFace className="w-3.5 h-3.5" />
                  <span>{ultimoRegistro.registro.metodo === 'facial' ? 'Reconhecimento Facial' : 'CPF & PIN'}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUltimoRegistro(null)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2"
              >
                <span>Concluir</span>
                <span className="text-slate-400 text-[11px] font-mono">({dismissCountdown}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Principal do Terminal */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-slate-200/90 overflow-hidden">
        
        {/* Seletor do Tipo de Marcação (Entrada, Almoço, Saída) */}
        <div className="bg-slate-50/90 p-2.5 sm:p-4 border-b border-slate-200">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {(['entrada', 'inicio_almoco', 'fim_almoco', 'saida'] as TipoMarcacao[]).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setTipoMarcacao(tipo)}
                className={`py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl border text-center transition-all ${
                  tipoMarcacao === tipo
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/20'
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

        {/* Abas de Modo (Facial por padrão; CPF & PIN opcional de backup) */}
        <div className="p-3 sm:p-5">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200 w-full sm:w-auto">
              <button
                onClick={() => {
                  setAuthMode('facial');
                  setIsCameraPausedByUser(false);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
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
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
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

          {/* MODO RECONHECIMENTO FACIAL - TOTALMENTE AUTOMATIZADO */}
          {authMode === 'facial' && (
            <div className="max-w-md mx-auto">
              {/* Barra de Status da Câmera */}
              <div className="flex items-center justify-between mb-2 px-1 text-xs">
                <span className="flex items-center space-x-1.5 font-medium text-[11px]">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isCameraActive 
                      ? 'bg-emerald-500 animate-pulse' 
                      : isCameraPausedByUser 
                      ? 'bg-amber-400' 
                      : 'bg-slate-400'
                  }`}></span>
                  <span className={isCameraActive ? 'text-emerald-700 font-semibold' : isCameraPausedByUser ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                    {isCameraActive 
                      ? 'Câmera Ativa • Olhe para a tela' 
                      : isCameraPausedByUser 
                      ? 'Câmera em Pausa' 
                      : 'Câmera Desligada'}
                  </span>
                  {isAdm && (
                    <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold" title="Você tem permissões administrativas no sistema">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      ADM
                    </span>
                  )}
                </span>

                {isCameraActive ? (
                  <button
                    onClick={handlePauseCamera}
                    title="Pausar câmera do totem instantaneamente"
                    className="flex items-center space-x-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-semibold transition active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isAdm ? 'Pausar Câmera (ADM)' : 'Pausar Câmera'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleResumeCamera}
                    title="Ligar ou retomar câmera do totem"
                    className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold transition active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isAdm ? (isCameraPausedByUser ? 'Retomar Câmera (ADM)' : 'Ligar Câmera (ADM)') : (isCameraPausedByUser ? 'Retomar Câmera' : 'Ligar Câmera')}</span>
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Viewfinder da Câmera com feedback visual instantâneo */}
              <div className={`bg-slate-900 rounded-2xl overflow-hidden shadow-lg relative h-60 sm:h-72 flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                facialStatus === 'encontrado'
                  ? 'border-emerald-500 ring-4 ring-emerald-500/30'
                  : facialStatus === 'nao_encontrado'
                  ? 'border-rose-500 ring-4 ring-rose-500/30'
                  : isScanning
                  ? 'border-cyan-400 ring-4 ring-cyan-400/20'
                  : 'border-slate-800'
              }`}>
                {/* Elemento de vídeo sempre montado com espelhamento natural */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover -scale-x-100 ${!isCameraActive ? 'hidden' : ''}`}
                />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-slate-900/95 text-slate-300 z-20 backdrop-blur-xs">
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 text-amber-400 shadow-md">
                      {isCameraPausedByUser ? (
                        <Pause className="w-7 h-7 text-amber-400" />
                      ) : (
                        <VideoOff className="w-7 h-7 text-slate-500" />
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {isCameraPausedByUser ? 'Câmera em Pausa' : 'Câmera Desativada'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mb-4">
                      {isCameraPausedByUser
                        ? 'O reconhecimento facial foi pausado. Clique no botão abaixo para reativar o terminal quando desejar.'
                        : 'A câmera está desligada. Você pode ligá-la ou utilizar o modo CPF & PIN.'}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={handleResumeCamera}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Retomar Câmera
                      </button>
                      <button
                        onClick={() => {
                          setAuthMode('cpf');
                        }}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition"
                      >
                        Ir para CPF & PIN
                      </button>
                    </div>
                    {isAdm && (
                      <p className="mt-3 text-[10px] text-purple-300/80 font-medium">
                        🛡️ Administrador do Sistema: Controle de câmera liberado
                      </p>
                    )}
                  </div>
                )}
                
                {/* Retículo / Mira de Enquadramento Facial */}
                {isCameraActive && (
                  <div className={`relative z-10 w-44 h-44 sm:w-52 sm:h-52 rounded-3xl border-2 flex items-center justify-center backdrop-blur-2xs transition-all duration-300 ${
                    facialStatus === 'encontrado'
                      ? 'border-emerald-400 bg-emerald-950/20'
                      : facialStatus === 'nao_encontrado'
                      ? 'border-rose-400 bg-rose-950/20'
                      : isScanning
                      ? 'border-cyan-400 border-dashed bg-cyan-950/20'
                      : 'border-dashed border-cyan-400/80 bg-cyan-950/10'
                  }`}>
                    {isScanning ? (
                      <div className="flex flex-col items-center space-y-2 bg-slate-900/90 p-3.5 rounded-2xl backdrop-blur-md border border-cyan-500/40 shadow-xl">
                        <RefreshCcw className="w-8 h-8 text-cyan-400 animate-spin" />
                        <span className="text-xs font-bold text-cyan-200 animate-pulse text-center">
                          Identificando funcionário...
                        </span>
                      </div>
                    ) : facialStatus === 'encontrado' ? (
                      <div className="flex flex-col items-center space-y-1.5 bg-emerald-900/90 p-3 rounded-2xl backdrop-blur-md border border-emerald-400 shadow-xl animate-scaleUp">
                        <CheckCircle2 className="w-8 h-8 text-emerald-300" />
                        <span className="text-xs font-bold text-emerald-100">
                          Identificado!
                        </span>
                      </div>
                    ) : facialStatus === 'ja_registrado' ? (
                      <div className="flex flex-col items-center space-y-1 bg-amber-900/90 p-3 rounded-2xl backdrop-blur-md border border-amber-400 shadow-xl animate-shake">
                        <Clock className="w-8 h-8 text-amber-300" />
                        <span className="text-xs font-bold text-amber-100">
                          Já registrado
                        </span>
                      </div>
                    ) : facialStatus === 'nao_encontrado' ? (
                      <div className="flex flex-col items-center space-y-1 bg-rose-900/90 p-3 rounded-2xl backdrop-blur-md border border-rose-400 shadow-xl animate-shake">
                        <UserX className="w-8 h-8 text-rose-300" />
                        <span className="text-xs font-bold text-rose-100">
                          Não encontrado
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-400/50 flex items-center justify-center mb-1.5">
                          <UserCheck className="w-6 h-6 text-cyan-300" />
                        </div>
                        <p className="text-[11px] text-cyan-100 font-semibold drop-shadow">
                          Posicione o rosto aqui
                        </p>
                      </div>
                    )}

                    {/* Cantos estilizados da mira */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-cyan-400 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-cyan-400 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-cyan-400 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-cyan-400 rounded-br-lg"></div>
                  </div>
                )}
              </div>

              {/* Notificação Clara: "Colaborador Identificado" */}
              {facialStatus === 'encontrado' && (
                <div className="mt-3 p-3.5 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-2xl shadow-sm flex items-start space-x-3 animate-fadeIn">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-emerald-800 leading-tight">
                      Colaborador Identificado com Sucesso!
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Biometria reconhecida e ponto eletrônico registrado instantaneamente.
                    </p>
                  </div>
                </div>
              )}

              {/* Notificação Clara: "Colaborador não encontrado" ou "Colaborador já registrado" */}
              {facialError && (
                <div className={`mt-3 p-3.5 border-2 rounded-2xl shadow-sm flex items-start space-x-3 animate-fadeIn ${
                  facialStatus === 'ja_registrado' 
                    ? 'bg-amber-50 border-amber-300 text-amber-900' 
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    facialStatus === 'ja_registrado' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {facialStatus === 'ja_registrado' ? <Clock className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-black leading-tight ${
                      facialStatus === 'ja_registrado' ? 'text-amber-800' : 'text-rose-700'
                    }`}>
                      {facialStatus === 'ja_registrado' ? 'Colaborador já registrado' : 'Colaborador não encontrado'}
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      facialStatus === 'ja_registrado' ? 'text-amber-700' : 'text-rose-600'
                    }`}>
                      {facialStatus === 'ja_registrado' ? facialError : 'O rosto visível não corresponde a nenhum colaborador cadastrado nesta empresa. Posicione o rosto no centro ou utilize CPF & PIN.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Botão de Validação Imediata (Identificar Face) */}
              <div className="mt-3 space-y-2">
                {colaboradores.length > 0 ? (
                  <button
                    onClick={handleFacialCapture}
                    disabled={isScanning}
                    className="w-full py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-blue-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-2"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        <span>Validando Reconhecimento Facial...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-cyan-200" />
                        <span>Identificar Face e Registrar {tipoLabels[tipoMarcacao].label}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs text-center font-medium">
                    Nenhum colaborador encontrado para esta empresa. Cadastre no Painel Gestor.
                  </div>
                )}

                <p className="text-[11px] text-center text-slate-500 font-medium">
                  {isCameraActive ? 'O totem analisa o rosto automaticamente a cada instante.' : 'Ative a câmera para validação contínua.'}
                </p>
              </div>
            </div>
          )}

          {/* MODO CPF & PIN COM TECLADO NUMÉRICO VIRTUAL (TOUCH TOTEM) */}
          {authMode === 'cpf' && (
            <div className="max-w-xs mx-auto">
              <form onSubmit={handleCpfSubmit} className="space-y-2 sm:space-y-3">
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
                  <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold">{errorMsg}</span>
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
