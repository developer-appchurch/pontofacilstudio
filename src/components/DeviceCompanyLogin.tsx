'use client';

import { useState } from 'react';
import { Building2, Lock, Smartphone, ArrowRight, AlertCircle, Crown } from 'lucide-react';
import { useCompanyAuth } from '../context/CompanyAuthContext';

interface DeviceCompanyLoginProps {
  onOpenMasterAdmin?: () => void;
}

export function DeviceCompanyLogin({ onOpenMasterAdmin }: DeviceCompanyLoginProps) {
  const { loginDispositivo } = useCompanyAuth();
  const [identificador, setIdentificador] = useState('');
  const [senhaDispositivo, setSenhaDispositivo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await loginDispositivo(identificador, senhaDispositivo);
      if (!res.success) {
        setErrorMsg(res.error || 'Falha ao autenticar empresa neste dispositivo.');
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão ao autenticar dispositivo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-xl bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Banner superior */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] opacity-15 [background-size:16px_16px]"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-inner border border-white/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              PontoFácil Enterprise
            </h1>
            <p className="text-sm text-blue-100 mt-1 max-w-md">
              Ativação e Vinculação de Terminal Fixo por Empresa
            </p>
          </div>
        </div>

        {/* Informações e Formulário */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/60 text-xs text-slate-300 space-y-2">
            <div className="flex items-center space-x-2 text-cyan-400 font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>Modo Terminal Fixo Ativado</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Após o login com sucesso, este dispositivo ficará <strong>permanentemente vinculado</strong> à sua empresa, persistindo em caso de reinicialização do navegador ou fechamento da aba.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                CNPJ E CÓDIGO DA EMPRESA
              </label>
              <input
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ex: 12.345.678/0001-90 ou admin@empresa.com"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                SENHA DO DISPOSITIVO
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={senhaDispositivo}
                  onChange={(e) => setSenhaDispositivo(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center space-x-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 mt-2"
            >
              <span>{isLoading ? 'Vinculando Dispositivo...' : 'Conectar e Iniciar Terminal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>



          {/* Rodapé com atalho exclusivo para o Master Admin */}
          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500">PontoFácil Enterprise Multi-Tenant</span>
            {onOpenMasterAdmin && (
              <button
                type="button"
                onClick={onOpenMasterAdmin}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1.5 transition"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Acesso Master Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
