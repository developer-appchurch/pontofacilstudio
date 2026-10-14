'use client';

import { useState } from 'react';
import { LogOut, X, AlertTriangle, Lock, Building2 } from 'lucide-react';
import { useCompanyAuth } from '../context/CompanyAuthContext';

interface UnpairDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UnpairDeviceModal({ isOpen, onClose }: UnpairDeviceModalProps) {
  const { empresaLogada, desvincularDispositivo } = useCompanyAuth();
  const [senhaInput, setSenhaInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !empresaLogada) return null;

  const handleConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const res = desvincularDispositivo(senhaInput);
    if (res.success) {
      setSenhaInput('');
      onClose();
    } else {
      setErrorMsg(res.error || 'Senha incorreta.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <LogOut className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-1">Desvincular Dispositivo</h3>
        <p className="text-xs text-slate-500 mb-4">
          Esta ação removerá o pareamento fixo da empresa neste terminal.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-5 text-xs text-amber-800 space-y-1">
          <div className="font-semibold flex items-center space-x-1.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Atenção: Acesso Restrito</span>
          </div>
          <p className="text-[11px] text-amber-700">
            Empresa atual: <strong>{empresaLogada.nome}</strong>. Para evitar que colaboradores na recepção desativem o totem, insira a senha de gestor.
          </p>
        </div>

        <form onSubmit={handleConfirmar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Senha de Gestor / Administrador
            </label>
            <div className="relative">
              <input
                type="password"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition shadow-lg shadow-rose-600/20"
            >
              Confirmar Desvinculação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
