import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CITY_CONFIG, URGENCY_LABELS, RequestUrgency } from '@servicos/shared';
import { 
  Send, 
  Clock, 
  CheckCircle2 
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
    if (!title.trim() || !description.trim()) return;

    createServiceRequest({
      categoryId,
      title: title.trim(),
      description: description.trim(),
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
    <div className="pb-28 pt-2 px-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 className="text-base sm:text-lg font-black text-slate-900">
          Pedir Orçamento na Cidade
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Descreva o que precisa e receba propostas dos melhores profissionais de Rondonópolis.
        </p>
      </div>

      {isSuccess ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-emerald-200 shadow-lg space-y-3 animate-in fade-in">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Pedido Publicado com Sucesso!
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Notificamos os profissionais verificados do bairro <strong>{neighborhood}</strong>. Você receberá notificações e mensagens no chat.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          {/* Categoria */}
          <div>
            <label htmlFor="req-category" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Categoria do Serviço
            </label>
            <select
              id="req-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base font-semibold text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
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
            <label htmlFor="req-title" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              O que você precisa? (Título Curto)
            </label>
            <input
              id="req-title"
              type="text"
              placeholder="Ex: Troca de disjuntor / Instalar torneira"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              required
            />
          </div>

          {/* Urgência com Botões Grandes */}
          <div>
            <p className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Para quando é o serviço?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(URGENCY_LABELS) as RequestUrgency[]).map((key) => {
                const isSelected = urgency === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setUrgency(key)}
                    className={`py-3 px-2 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
                      isSelected
                        ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-sm ring-2 ring-brand-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {key === 'urgent_today' && <Clock className="w-4 h-4 text-red-500" />}
                    <span>{URGENCY_LABELS[key] || 'Normal'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bairro */}
          <div>
            <label htmlFor="req-neighborhood" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Bairro onde será realizado o serviço
            </label>
            <select
              id="req-neighborhood"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base font-semibold text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
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
            <label htmlFor="req-description" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Detalhes do Serviço
            </label>
            <textarea
              id="req-description"
              rows={3}
              placeholder="Explique o que aconteceu, se você já possui os materiais ou se o prestador deve levar ferramentas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              required
            />
          </div>

          {/* Estimativa de Orçamento */}
          <div>
            <label htmlFor="req-budget" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Quanto planeja gastar? (Opcional - R$)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                R$
              </span>
              <input
                id="req-budget"
                type="number"
                placeholder="200"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500 font-bold"
              />
            </div>
          </div>

          {/* Botão Publicar */}
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 mt-2"
          >
            <Send className="w-4 h-4" />
            <span>Publicar Pedido de Orçamento</span>
          </button>
        </form>
      )}
    </div>
  );
};
