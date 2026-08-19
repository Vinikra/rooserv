import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CITY_CONFIG, URGENCY_LABELS, RequestUrgency } from '@servicos/shared';
import { 
  Sparkles, 
  Send, 
  Clock, 
  MapPin, 
  DollarSign, 
  CheckCircle2, 
  Zap, 
  FileText 
} from 'lucide-react';

interface NewRequestScreenProps {
  onSuccess: () => void;
}

export const NewRequestScreen: React.FC<NewRequestScreenProps> = ({ onSuccess }) => {
  const { categories, createServiceRequest, selectedNeighborhood } = useApp();

  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [urgency, setUrgency] = useState<RequestUrgency>('normal');
  const [neighborhood, setNeighborhood] = useState<string>(
    selectedNeighborhood !== 'Todos os Bairros' ? selectedNeighborhood : CITY_CONFIG.defaultNeighborhoods[0]
  );
  const [budget, setBudget] = useState<string>('200');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    createServiceRequest({
      categoryId,
      title,
      description,
      urgency,
      neighborhood,
      budget: budget ? Number(budget) : undefined,
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onSuccess();
    }, 1500);
  };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-md mx-auto">
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Pedir Orçamento na Cidade
        </h2>
        <p className="text-xs text-slate-500">
          Descreva o que precisa e receba orçamentos de profissionais avaliados.
        </p>
      </div>

      {isSuccess ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-emerald-200 shadow-sm space-y-3">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Pedido Publicado com Sucesso!
          </h3>
          <p className="text-xs text-slate-600">
            Notificamos os profissionais verificados do bairro <strong>{neighborhood}</strong>. Você receberá propostas pelo app.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
          {/* Categoria */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Categoria do Serviço
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-brand-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Título Curto do Problema
            </label>
            <input
              type="text"
              placeholder="Ex: Troca de fiação do chuveiro / Pintar 1 quarto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          {/* Urgência */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Qual a urgência?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(URGENCY_LABELS) as RequestUrgency[]).map((key) => {
                const isSelected = urgency === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setUrgency(key)}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {key === 'urgent_today' && <Clock className="w-3.5 h-3.5 text-red-500" />}
                    <span>{key === 'urgent_today' ? 'Hoje / Urgente' : key === 'normal' ? '2 a 3 dias' : 'Sem pressa'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bairro */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Bairro onde será feito o serviço
            </label>
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
            >
              {CITY_CONFIG.defaultNeighborhoods.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição Detalhada */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Descrição Detalhada
            </label>
            <textarea
              rows={3}
              placeholder="Explique o que aconteceu, se você já comprou os materiais ou se o prestador deve levar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          {/* Estimativa de Orçamento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Orçamento Previsto (Opcional - R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                R$
              </span>
              <input
                type="number"
                placeholder="200"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500 font-bold"
              />
            </div>
          </div>

          {/* Botão Publicar */}
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publicar Pedido de Orçamento</span>
          </button>
        </form>
      )}
    </div>
  );
};
