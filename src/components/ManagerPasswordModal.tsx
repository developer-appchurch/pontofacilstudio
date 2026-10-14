'use client';

import { useState } from 'react';
import { ShieldCheck, Lock, X, ArrowRight, AlertCircle, KeyRound, Building2 } from 'lucide-react';
import { useCompanyAuth } from '../context/CompanyAuthContext';

interface ManagerPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManagerPasswordModal({ isOpen, onClose, onSuccess }: ManagerPasswordModalProps) {
  const { empresaLogada, desbloquearPainelGestor } = useCompanyAuth();
  const [senhaInput, setSenhaInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !empresaLogada) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const desbloqueou = desbloquearPainelGestor(senhaInput);
    if (desbloqueou) {
      setSenhaInput('');
      setErrorMsg('');
      onSuccess();
    } else {
      setErrorMsg('Senha de gestor incorreta. Acesso negado.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-100 relative overflow-hidden">
        {/* Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

        <button
          onClick={() => {
            setSenhaInput('');
            setErrorMsg('');
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Acesso Restrito ao Gestor</h3>
            <p className="text-xs text-slate-500">Painel Administrativo da Empresa</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-slate-800 font-semibold">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>{empresaLogada.nome}</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Por motivos de segurança, colaboradores no totem não têm acesso às configurações e relatórios. Digite a senha administrativa configurada para a sua empresa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Senha de Gestor / Administrador
            </label>
            <div className="relative">
              <input
                type="password"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSenhaInput('');
                setErrorMsg('');
                onClose();
              }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
            >
              <span>Desbloquear Painel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
