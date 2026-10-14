'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, Monitor, Building2, 
  Lock, Unlock, Crown
} from 'lucide-react';
import { useCompanyAuth } from '../context/CompanyAuthContext';

interface HeaderProps {
  activeView: 'kiosk' | 'manager';
  onSelectView: (view: 'kiosk' | 'manager') => void;
  isSupabaseConnected?: boolean;
  lastSyncTime?: string;
  onOpenDesvincularModal: () => void;
  onOpenMasterAdmin?: () => void;
}

export function Header({
  activeView,
  onSelectView,
  isSupabaseConnected,
  lastSyncTime,
  onOpenDesvincularModal,
  onOpenMasterAdmin,
}: HeaderProps) {
  const { empresaLogada, isManagerUnlocked, bloquearPainelGestor } = useCompanyAuth();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Relógio do dispositivo local (não consome consultas ao banco de dados)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('pt-BR'));
      setDateStr(
        now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!empresaLogada) return null;

  const isKiosk = activeView === 'kiosk';

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-40 transition-all">
      <div
        className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 ${
          isKiosk ? 'py-1.5 md:py-3' : 'py-2.5 sm:py-3'
        } flex items-center justify-between gap-2 md:gap-4`}
      >
        {/* Left: Brand & Empresa Vinculada */}
        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <div className="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
              PontoFácil
            </h1>
          </div>

          {/* Active Company Badge Button (oculto no mobile em modo Totem para economizar espaço) */}
          <button
            onClick={onOpenDesvincularModal}
            className={`items-center space-x-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700 text-left transition group ${
              isKiosk ? 'hidden md:flex' : 'hidden sm:flex'
            }`}
            title="Empresa vinculada a este dispositivo. Clique para gerenciar ou desvincular."
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">
                Empresa Vinculada
              </div>
              <div className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[180px]">
                {empresaLogada.nome}
              </div>
            </div>
          </button>
        </div>

        {/* Center: Live Clock & Date */}
        <div className="hidden lg:flex items-center space-x-2.5 bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-700/50">
          <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="flex items-center space-x-2">
            <span className="text-sm font-mono font-bold text-cyan-400 leading-none">
              {timeStr || '00:00:00'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-300 capitalize">{dateStr}</span>
          </div>
        </div>

        {/* Right: Navigation Switch & Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 justify-end">
          <div className="bg-slate-800 p-0.5 sm:p-1 rounded-xl flex space-x-1 border border-slate-700">
            <button
              onClick={() => onSelectView('kiosk')}
              className={`flex items-center space-x-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'kiosk'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className={isKiosk ? 'inline' : 'hidden sm:inline'}>Totem Ponto</span>
            </button>
            <button
              onClick={() => onSelectView('manager')}
              className={`flex items-center space-x-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'manager'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {isManagerUnlocked ? (
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Painel Gestor</span>
            </button>
          </div>

          {/* Bloquear Painel do Gestor se estiver na visão de gestão */}
          {activeView === 'manager' && isManagerUnlocked && (
            <button
              onClick={() => {
                bloquearPainelGestor();
                onSelectView('kiosk');
              }}
              title="Bloquear Painel do Gestor e retornar para modo Totem seguro"
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center space-x-1 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bloquear</span>
            </button>
          )}

          {/* Botão Master Admin (Desenvolvedor) */}
          {onOpenMasterAdmin && (
            <button
              onClick={onOpenMasterAdmin}
              title="Painel Master Admin (Desenvolvedor)"
              className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition flex items-center"
            >
              <Crown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
