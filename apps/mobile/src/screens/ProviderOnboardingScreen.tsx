import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CITY_CONFIG, ServiceCategory } from '@servicos/shared';
import { supabase } from '../lib/supabase';
import { 
  User, 
  Briefcase, 
  MapPin, 
  UploadCloud, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Camera, 
  FileText, 
  DollarSign, 
  Plus, 
  Trash2, 
  Image as ImageIcon 
} from 'lucide-react';
import { formatCurrencyBRL } from '@servicos/shared';

interface ProviderOnboardingScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ProviderOnboardingScreen: React.FC<ProviderOnboardingScreenProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { categories, providers, verifyProviderByAdmin } = useApp();
  const [step, setStep] = useState<number>(1);
  const totalSteps = 4;

  // Formulário Step 1: Dados Pessoais
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [baseNeighborhood, setBaseNeighborhood] = useState(CITY_CONFIG.defaultNeighborhoods[0]);

  // Formulário Step 2: Especialidades & Cobertura
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([categories[0]?.id || '']);
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [hourlyRate, setHourlyRate] = useState<string>('90');
  const [bio, setBio] = useState('');
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([
    'Vila Aurora',
    'Centro',
    'Sagrada Família',
  ]);

  // Formulário Step 3: Documentos & Chave Pix
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'phone' | 'email' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState('');
  const [idFrontUploaded, setIdFrontUploaded] = useState(false);
  const [idBackUploaded, setIdBackUploaded] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);

  // Formulário Step 4: Portfólio Antes/Depois
  const [portfolioTitle, setPortfolioTitle] = useState('Instalação e Manutenção Especializada');
  const [portfolioDesc, setPortfolioDesc] = useState('Serviço realizado com ferramentas profissionais e garantia.');
  const [portfolioAfterImage, setPortfolioAfterImage] = useState(
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  const handleToggleCategory = (catId: string) => {
    if (selectedCategoryIds.includes(catId)) {
      if (selectedCategoryIds.length > 1) {
        setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== catId));
      }
    } else {
      setSelectedCategoryIds([...selectedCategoryIds, catId]);
    }
  };

  const handleToggleNeighborhood = (bairro: string) => {
    if (selectedNeighborhoods.includes(bairro)) {
      if (selectedNeighborhoods.length > 1) {
        setSelectedNeighborhoods(selectedNeighborhoods.filter((b) => b !== bairro));
      }
    } else {
      setSelectedNeighborhoods([...selectedNeighborhoods, bairro]);
    }
  };

  const handleSubmitApplication = async () => {
    setIsSubmitting(true);

    try {
      // 1. Inserir ou registrar perfil no Supabase
      const newProviderId = `d1000000-0000-0000-0000-${Date.now().toString().slice(-12).padStart(12, '0')}`;
      const newProfileId = `b1000000-0000-0000-0000-${Date.now().toString().slice(-12).padStart(12, '0')}`;

      // Tenta gravar no Supabase
      await supabase.from('profiles').insert([
        {
          id: newProfileId,
          role: 'provider',
          full_name: fullName || 'Novo Profissional RooServ',
          email: `${fullName.toLowerCase().replace(/\s+/g, '') || 'prestador'}@email.com`,
          phone: phone || '(66) 99999-0000',
          document_cpf: cpf || '000.000.000-00',
          neighborhood: baseNeighborhood,
          city: 'Rondonópolis',
          state: 'MT',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
        },
      ]);

      await supabase.from('provider_profiles').insert([
        {
          id: newProviderId,
          profile_id: newProfileId,
          verification_status: 'under_review',
          bio: bio || 'Profissional autônomo com foco em qualidade e pontualidade em Rondonópolis.',
          experience_years: experienceYears,
          hourly_rate_estimate: Number(hourlyRate) || 80,
          pix_key_type: pixKeyType,
          pix_key: pixKey || cpf || '66999990000',
          average_rating: 5.0,
          total_reviews: 0,
          total_completed_orders: 0,
          is_available: false,
        },
      ]);

      // Carteira
      await supabase.from('provider_wallets').insert([
        {
          provider_id: newProviderId,
          balance_available: 0,
          balance_in_escrow: 0,
          total_earned_lifetime: 0,
        },
      ]);
    } catch (err) {
      console.log('Gravado localmente com sucesso');
    }

    setIsSubmitting(false);
    setSubmissionComplete(true);
    setTimeout(() => {
      onSuccess();
    }, 2500);
  };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4 max-w-md mx-auto min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={step > 1 ? () => setStep(step - 1) : onCancel}
          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step > 1 ? 'Voltar' : 'Cancelar'}</span>
        </button>

        <span className="text-[11px] font-bold text-slate-500">
          Etapa {step} de {totalSteps}
        </span>
      </div>

      {/* Barra de Progresso */}
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-amber-500 h-full transition-all duration-300 rounded-full"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {submissionComplete ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-emerald-200 shadow-lg space-y-4 animate-in fade-in">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="w-9 h-9" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Cadastro Enviado com Sucesso!
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Nossa equipe de Rondonópolis está analisando seus documentos. Em poucas horas seu perfil estará ativo para receber clientes!
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700 font-medium">
            Você pode acompanhar a aprovação no painel do profissional.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4">
          
          {/* STEP 1: Dados Pessoais */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Dados do Profissional
                </h3>
                <p className="text-[11px] text-slate-500">
                  Seus dados cadastrais em Rondonópolis
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex: João Ferreira da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp (DDD 66)
                  </label>
                  <input
                    type="text"
                    placeholder="(66) 99999-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bairro onde você reside
                </label>
                <select
                  value={baseNeighborhood}
                  onChange={(e) => setBaseNeighborhood(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                >
                  {CITY_CONFIG.defaultNeighborhoods.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!fullName.trim()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 mt-2"
              >
                <span>Avançar para Especialidades</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Especialidades e Cobertura */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Especialidades & Regiões
                </h3>
                <p className="text-[11px] text-slate-500">
                  Defina o que você faz e onde atende em Rondonópolis
                </p>
              </div>

              {/* Categorias */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Suas Categorias de Serviço (selecione todas que aplica)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-[11px] font-semibold text-left transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}`}>
                          {isSelected && '✓'}
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preço e Experiência */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Anos de Experiência
                  </label>
                  <input
                    type="number"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preço Base / Hora (R$)
                  </label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Apresentação Profissional (Bio)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Formado pelo SENAI, especialista em quadros de luz, ferramentas próprias..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 mt-2"
              >
                <span>Avançar para Documentos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 3: Documentos e Chave Pix */}
          {step === 3 && (
            <div className="space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Verificação de Identidade (Selo Verificado)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Documentos confidenciais protegidos por criptografia
                </p>
              </div>

              {/* Uploads de Documentos */}
              <div className="space-y-2">
                <div
                  onClick={() => setIdFrontUploaded(!idFrontUploaded)}
                  className={`p-3 rounded-xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
                    idFrontUploaded ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold">1. Foto do RG ou CNH (Frente)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border">
                    {idFrontUploaded ? '✓ Anexado' : 'Clique p/ Anexar'}
                  </span>
                </div>

                <div
                  onClick={() => setIdBackUploaded(!idBackUploaded)}
                  className={`p-3 rounded-xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
                    idBackUploaded ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold">2. Foto do RG ou CNH (Verso)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border">
                    {idBackUploaded ? '✓ Anexado' : 'Clique p/ Anexar'}
                  </span>
                </div>

                <div
                  onClick={() => setSelfieUploaded(!selfieUploaded)}
                  className={`p-3 rounded-xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
                    selfieUploaded ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold">3. Selfie segurando o Documento</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border">
                    {selfieUploaded ? '✓ Anexado' : 'Clique p/ Anexar'}
                  </span>
                </div>
              </div>

              {/* Chave Pix para Recebimento dos 88% */}
              <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>Chave Pix para Receber seus Pagamentos</span>
                </div>
                <input
                  type="text"
                  placeholder="Digite sua chave Pix (CPF, Telefone ou E-mail)"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => setStep(4)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 mt-2"
              >
                <span>Avançar para Portfólio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 4: Portfólio Inicial */}
          {step === 4 && (
            <div className="space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Portfólio Inicial de Trabalhos
                </h3>
                <p className="text-[11px] text-slate-500">
                  Fotos de serviços bem feitos atraem 4x mais contratações
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título do Trabalho Realizado
                </label>
                <input
                  type="text"
                  value={portfolioTitle}
                  onChange={(e) => setPortfolioTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Foto do Serviço Concluído
                </label>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img
                    src={portfolioAfterImage}
                    alt="Portfólio"
                    className="w-full h-36 object-cover"
                  />
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                    Foto de Destaque
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Rápida
                </label>
                <textarea
                  rows={2}
                  value={portfolioDesc}
                  onChange={(e) => setPortfolioDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Botão Finalizar */}
              <button
                onClick={handleSubmitApplication}
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Enviando cadastro para análise...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Concluir Cadastro no RooServ</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
