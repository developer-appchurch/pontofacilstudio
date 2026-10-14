'use client';

import { useState } from 'react';
import { Building2, ShieldCheck, Lock, CheckCircle2, ArrowRight, X, AlertCircle } from 'lucide-react';
import { Empresa, UsuarioGestor } from '../types/ponto';
import { initialEmpresas } from '../data/mockData';

interface CompanyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaAtiva: Empresa;
  onSelecionarEmpresa: (empresa: Empresa, usuario?: UsuarioGestor) => void;
}

export function CompanyAuthModal({
  isOpen,
  onClose,
  empresaAtiva,
  onSelecionarEmpresa
}: CompanyAuthModalProps) {
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(empresaAtiva.id);
  const [codigoInput, setCodigoInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const targetEmpresa = initialEmpresas.find((e) => e.id === selectedEmpresaId);
    if (!targetEmpresa) {
      setErrorMsg('Empresa não encontrada.');
      return;
    }

    if (codigoInput.trim() && codigoInput.trim().toUpperCase() !== targetEmpresa.codigoAcesso.toUpperCase()) {
      setErrorMsg(`Código de acesso incorreto para a empresa ${targetEmpresa.nome}. Dica: use o código ${targetEmpresa.codigoAcesso}`);
      return;
    }

    const usuario: UsuarioGestor = {
      id: 'usr-' + targetEmpresa.id,
      nome: `Gestor RH (${targetEmpresa.nome.split(' ')[0]})`,
      email: `gestor@${targetEmpresa.id.replace('emp-', '')}.com`,
      role: 'gestor',
      empresaId: targetEmpresa.id,
      empresaNome: targetEmpresa.nome
    };

    onSelecionarEmpresa(targetEmpresa, usuario);
    setSuccessMsg(`Empresa ${targetEmpresa.nome} autenticada com sucesso!`);
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Autenticação da Empresa</h3>
            <p className="text-xs text-slate-500">Isolamento Multi-Tenant por Empresa (RLS)</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 mb-6 text-xs text-amber-900 leading-relaxed">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Segurança & Proteção de Dados:</strong> Cada empresa possui um identificador único exclusivo (<code className="bg-amber-100 px-1 rounded">empresa_id</code>). O painel do gestor e os totens de ponto apenas exibem colaboradores e registros vinculados à empresa autenticada.
            </div>
          </div>
        </div>

        <form onSubmit={handleConfirmar} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Selecione a Empresa Ativa:
            </label>
            <div className="space-y-2">
              {initialEmpresas.map((emp) => {
                const isSelected = selectedEmpresaId === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmpresaId(emp.id);
                      setCodigoInput(emp.codigoAcesso);
                      setErrorMsg('');
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{emp.nome}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        CNPJ: {emp.cnpj} • {emp.cidade}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              SENHA DO DISPOSITIVO
            </label>
            <div className="relative">
              <input
                type="text"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                placeholder="Ex: TECH123 ou INOVA456"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono uppercase text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
            >
              <span>Autenticar Empresa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
