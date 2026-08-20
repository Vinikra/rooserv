import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CITY_CONFIG, URGENCY_LABELS, RequestUrgency } from '@servicos/shared';
import { 
  Send, 
  Clock, 
  CheckCircle2,
  Camera,
  X
} from 'lucide-react';

interface NewRequestScreenProps {
  onSuccess: () => void;
}

export const NewRequestScreen: React.FC<NewRequestScreenProps> = ({ onSuccess }) => {
  const { categories, createServiceRequest, selectedNeighborhood } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [urgency, setUrgency] = useState<RequestUrgency>('normal');
  const [neighborhood, setNeighborhood] = useState<string>(
    selectedNeighborhood !== 'Todos os Bairros' ? selectedNeighborhood : CITY_CONFIG.defaultNeighborhoods[0]
  );
  const [budget, setBudget] = useState<string>('150');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && photos.length < 3) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

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
      photos,
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onSuccess();
    }, 1500);
  };

  return (
    <div className="pb-28 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 max-w-3xl mx-auto w-full">
      <div className="border-b border-slate-200/80 pb-4">
        <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
          Pedir Orçamento Grátis na Cidade
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Descreva o que precisa e receba propostas dos melhores profissionais verificados de Rondonópolis.
        </p>
      </div>

      {isSuccess ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-emerald-200 shadow-xl space-y-3 animate-in fade-in">
          <div className="w-18 h-18 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900">
            Pedido Publicado com Sucesso!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Os prestadores verificados da sua região foram notificados. Você receberá orçamentos em instantes.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
          {/* Categoria */}
          <div>
            <label htmlFor="req-category" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Qual é o tipo de serviço?
            </label>
            <select
              id="req-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label htmlFor="req-title" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Título resumido do pedido
            </label>
            <input
              id="req-title"
              type="text"
              required
              placeholder="Ex: Troca de disjuntor e revisão no chuveiro"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Descrição Detalhada */}
          <div>
            <label htmlFor="req-description" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
              Descreva o problema ou o que precisa ser feito:
            </label>
            <textarea
              id="req-description"
              required
              rows={4}
              placeholder="Ex: O chuveiro está desarmando o disjuntor após 3 minutos ligado. Preciso de alguém com chave de teste e fios adequados..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Grid de 2 colunas para Bairro e Orçamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bairro */}
            <div>
              <label htmlFor="req-neighborhood" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                Em qual bairro de Rondonópolis?
              </label>
              <select
                id="req-neighborhood"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:border-brand-500"
              >
                {CITY_CONFIG.defaultNeighborhoods.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Estimativa de Orçamento */}
            <div>
              <label htmlFor="req-budget" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                Estimativa de quanto pretende pagar (R$):
              </label>
              <input
                id="req-budget"
                type="number"
                min="30"
                step="10"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Urgência */}
          <div>
            <span className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-2">
              Para quando você precisa do serviço?
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(URGENCY_LABELS) as RequestUrgency[]).map((urg) => {
                const isSelected = urgency === urg;
                return (
                  <button
                    key={urg}
                    type="button"
                    onClick={() => setUrgency(urg)}
                    className={`py-3.5 px-3 rounded-2xl border text-xs sm:text-sm font-black transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-md ring-2 ring-brand-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span>{URGENCY_LABELS[urg].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fotos do Problema / Anexo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-xs sm:text-sm font-extrabold text-slate-800">
                Fotos do Problema ou Material (Opcional - até 3 fotos)
              </span>
              <span className="text-[11px] font-bold text-slate-500">{photos.length}/3 fotos</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo, index) => (
                <div key={photo.slice(0, 40) + index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
                  <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1.5 right-1.5 bg-red-600/90 text-white p-1 rounded-full shadow-md cursor-pointer hover:bg-red-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {photos.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/50 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-brand-600 transition-all cursor-pointer p-2 text-center"
                >
                  <Camera className="w-6 h-6 text-slate-400 group-hover:text-brand-500" />
                  <span className="text-[11px] font-bold leading-tight">Adicionar Foto</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* Botão de Envio */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-sm sm:text-base py-4 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Send className="w-5 h-5" />
              <span>Publicar Pedido de Orçamento</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
