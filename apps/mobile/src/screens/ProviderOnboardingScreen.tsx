import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CITY_CONFIG,
  LEGAL_TERMS_VERSION,
  getPasswordValidationError,
  isValidBrazilianPhone,
  isValidCpf,
} from '@servicos/shared';
import { supabase } from '../lib/supabase';
import { RooServStorageService } from '../services/storageService';
import { TermsModal } from '../components/TermsModal';
import { 
  User, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Camera, 
  DollarSign 
} from 'lucide-react';

interface ProviderOnboardingScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ProviderOnboardingScreen: React.FC<ProviderOnboardingScreenProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { categories, signup, currentUser, refreshProviderDirectory } = useApp();
  const [step, setStep] = useState<number>(1);
  const totalSteps = 4;

  // Formulário Step 1: Dados Pessoais
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [baseNeighborhood, setBaseNeighborhood] = useState(CITY_CONFIG.defaultNeighborhoods[0]);

  // Formulário Step 2: Categoria & Preço
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);

  // Formulário Step 3: Bio & Chave Pix
  const [bio, setBio] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('phone');

  // Formulário Step 4: Documentos / KYC
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const idFrontUploaded = Boolean(idFrontFile);
  const idBackUploaded = Boolean(idBackFile);
  const selfieUploaded = Boolean(selfieFile);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCategoryIds.length === 0 && categories[0]) {
      setSelectedCategoryIds([categories[0].id]);
    }
  }, [categories, selectedCategoryIds.length]);

  useEffect(() => {
    if (!currentUser) return;
    setFullName((value) => value || currentUser.fullName || '');
    setPhone((value) => value || currentUser.phone || '');
    setCpf((value) => value || currentUser.documentCpf || '');
    setEmail((value) => value || currentUser.email || '');
    setBaseNeighborhood(currentUser.neighborhood || CITY_CONFIG.defaultNeighborhoods[0]);
    setPixKey((value) => value || currentUser.phone || '');
  }, [currentUser]);

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(catId)) {
        return prev.length > 1 ? prev.filter((id) => id !== catId) : prev;
      }
      return [...prev, catId];
    });
  };

  const handleSubmitApplication = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const cleanName = fullName.trim();
      const cleanPhone = phone.trim();
      if (!cleanName || !isValidBrazilianPhone(cleanPhone) || !isValidCpf(cpf)) {
        throw new Error('Preencha nome, telefone e um CPF válido.');
      }
      const numericHourlyRate = Number(hourlyRate);
      if (!Number.isFinite(numericHourlyRate) || numericHourlyRate <= 0 || numericHourlyRate > 100000) {
        throw new Error('Informe um preço base válido.');
      }
      if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80) {
        throw new Error('Informe os anos de experiência entre 0 e 80.');
      }
      if (bio.trim().length < 20) throw new Error('A apresentação deve ter pelo menos 20 caracteres.');
      if (pixKey.trim().length < 3) throw new Error('Informe uma chave Pix válida.');
      if (!idFrontFile || !idBackFile || !selfieFile) {
        throw new Error('Anexe a frente, o verso do documento e a selfie.');
      }
      if (selectedCategoryIds.length === 0) throw new Error('Selecione pelo menos uma categoria.');

      let providerUser = currentUser;
      if (!providerUser) {
        if (!email.trim()) throw new Error('Informe seu e-mail.');
        const passwordError = getPasswordValidationError(password);
        if (passwordError) throw new Error(passwordError);
        if (!acceptedTerms) {
          throw new Error('Leia e aceite os Termos de Uso e a Política de Privacidade para criar a conta.');
        }
        const signupResult = await signup({
          role: 'provider',
          fullName: cleanName,
          email: email.trim(),
          password,
          phone: cleanPhone,
          neighborhood: baseNeighborhood,
          documentCpf: cpf,
          acceptedTerms,
          termsVersion: LEGAL_TERMS_VERSION,
        });
        if (signupResult.requiresEmailConfirmation) {
          throw new Error('Conta criada. Confirme o link enviado ao seu e-mail, faça login e retorne para enviar os documentos.');
        }
        if (!signupResult.success || !signupResult.user) {
          throw new Error(signupResult.error || 'Não foi possível criar a conta profissional.');
        }
        providerUser = signupResult.user;
      }
      if (providerUser.role !== 'provider') {
        throw new Error('Esta conta não é uma conta de prestador.');
      }

      const uploadResults = await Promise.allSettled([
        RooServStorageService.uploadKycDocument(idFrontFile, 'id-front'),
        RooServStorageService.uploadKycDocument(idBackFile, 'id-back'),
        RooServStorageService.uploadKycDocument(selfieFile, 'selfie'),
      ]);
      const uploadedPaths = uploadResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      const failedUpload = uploadResults.find((result) => result.status === 'rejected');
      if (failedUpload) {
        await RooServStorageService.removeKycDocuments(uploadedPaths);
        throw failedUpload.reason;
      }
      const [idFrontPath, idBackPath, selfiePath] = uploadedPaths;

      const { error: submissionError } = await supabase.rpc('submit_provider_onboarding', {
        p_full_name: cleanName,
        p_phone: cleanPhone,
        p_document_cpf: cpf,
        p_neighborhood: baseNeighborhood,
        p_bio: bio.trim(),
        p_hourly_rate: numericHourlyRate,
        p_experience_years: experienceYears,
        p_pix_key: pixKey.trim(),
        p_pix_key_type: pixKeyType,
        p_document_id_front_path: idFrontPath,
        p_document_id_back_path: idBackPath,
        p_selfie_with_id_path: selfiePath,
        p_category_ids: selectedCategoryIds,
      });
      if (submissionError) {
        await RooServStorageService.removeKycDocuments(uploadedPaths);
        throw submissionError;
      }

      await refreshProviderDirectory();

      setSubmissionComplete(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Não foi possível enviar o cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-3.5">
      <div className="border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-bold text-slate-900">Dados do Profissional</h3>
        <p className="text-[11px] text-slate-500">Seus dados cadastrais em Rondonópolis</p>
      </div>
      <div>
        <label htmlFor="provider-fullname" className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
        <input
          id="provider-fullname"
          type="text"
          placeholder="Ex: João Ferreira da Silva"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
        />
      </div>
      {!currentUser && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="provider-email" className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
              <input
                id="provider-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label htmlFor="provider-password" className="block text-xs font-bold text-slate-700 mb-1">Senha</label>
              <input
                id="provider-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ caracteres, maiúscula e número"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <label className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600"
            />
            <span>
              Li e aceito os Termos de Uso e a Política de Privacidade (versão {LEGAL_TERMS_VERSION}).{' '}
              <button type="button" onClick={() => setShowTerms(true)} className="font-bold text-brand-700 underline">
                Ler resumo
              </button>
            </span>
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="provider-phone" className="block text-xs font-bold text-slate-700 mb-1">WhatsApp (DDD 66)</label>
          <input
            id="provider-phone"
            type="text"
            placeholder="(66) 99999-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>
        <div>
          <label htmlFor="provider-cpf" className="block text-xs font-bold text-slate-700 mb-1">CPF</label>
          <input
            id="provider-cpf"
            type="text"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>
      </div>
      <div>
        <label htmlFor="provider-neighborhood" className="block text-xs font-bold text-slate-700 mb-1">Bairro onde você reside</label>
        <select
          id="provider-neighborhood"
          value={baseNeighborhood}
          onChange={(e) => setBaseNeighborhood(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
        >
          {CITY_CONFIG.defaultNeighborhoods.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setStep(2)}
        disabled={!fullName.trim() || (!currentUser && (!email.trim() || Boolean(getPasswordValidationError(password)) || !acceptedTerms))}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 mt-2"
      >
        <span>Avançar para Especialidades</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3.5">
      <div className="border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-bold text-slate-900">Especialidades & Regiões</h3>
        <p className="text-[11px] text-slate-500">Defina o que você faz e onde atende em Rondonópolis</p>
      </div>
      <div>
        <p className="block text-xs font-bold text-slate-700 mb-1.5">Suas Categorias de Serviço</p>
        <div className="grid grid-cols-2 gap-1.5">
          {categories.map((cat) => {
            const isSelected = selectedCategoryIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleToggleCategory(cat.id)}
                className={`p-2.5 rounded-xl border text-[11px] font-semibold text-left transition-all flex items-center gap-2 ${
                  isSelected ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="provider-experience" className="block text-xs font-bold text-slate-700 mb-1">Anos de Experiência</label>
          <input
            id="provider-experience"
            type="number"
            min="0"
            max="80"
            value={experienceYears}
            onChange={(e) => setExperienceYears(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label htmlFor="provider-rate" className="block text-xs font-bold text-slate-700 mb-1">Preço Base / Hora (R$)</label>
          <input
            id="provider-rate"
            type="number"
            min="1"
            max="100000"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
      <div>
        <label htmlFor="provider-bio" className="block text-xs font-bold text-slate-700 mb-1">Apresentação Profissional (Bio)</label>
        <textarea
          id="provider-bio"
          rows={2}
          placeholder="Ex: Formado pelo SENAI, especialista em quadros de luz, ferramentas próprias..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
        />
      </div>
      <button
        type="button"
        onClick={() => setStep(3)}
        disabled={selectedCategoryIds.length === 0 || !Number(hourlyRate) || experienceYears < 0 || experienceYears > 80 || bio.trim().length < 20}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 mt-2"
      >
        <span>Avançar para Documentos</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-3.5">
      <div className="border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-bold text-slate-900">Verificação de Identidade (Selo Verificado)</h3>
        <p className="text-[11px] text-slate-500">Documentos confidenciais com acesso restrito e links temporários</p>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => document.getElementById('provider-id-front')?.click()}
          className={`w-full text-left p-3 rounded-xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
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
        </button>
        <input id="provider-id-front" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)} />
        <button
          type="button"
          onClick={() => document.getElementById('provider-id-back')?.click()}
          className={`w-full text-left p-3 rounded-xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
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
        </button>
        <input id="provider-id-back" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setIdBackFile(e.target.files?.[0] || null)} />
        <button
          type="button"
          onClick={() => document.getElementById('provider-selfie')?.click()}
          className={`w-full text-left p-3 rounded-xl border-2 border-dashed flex items-center justify-between cursor-pointer transition-all ${
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
        </button>
        <input id="provider-selfie" type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
      </div>
      <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
          <DollarSign className="w-4 h-4 text-amber-600" />
          <label htmlFor="provider-pix">Chave Pix para Receber seus Pagamentos</label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            aria-label="Tipo da chave Pix"
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value as typeof pixKeyType)}
            className="bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold"
          >
            <option value="phone">Telefone</option>
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
            <option value="email">E-mail</option>
            <option value="random">Aleatória</option>
          </select>
          <input
            id="provider-pix"
            type="text"
            placeholder="Digite sua chave Pix"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="col-span-2 w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setStep(4)}
        disabled={!idFrontUploaded || !idBackUploaded || !selfieUploaded || !pixKey.trim()}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 mt-2"
      >
        <span>Revisar e Enviar</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-3.5">
      <div className="border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-bold text-slate-900">Revisão do Cadastro</h3>
        <p className="text-[11px] text-slate-500">Seu perfil ficará pendente até a análise dos documentos.</p>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 space-y-2">
        <p><strong>Profissional:</strong> {fullName}</p>
        <p><strong>Categorias:</strong> {selectedCategoryIds.length}</p>
        <p><strong>Experiência:</strong> {experienceYears} anos</p>
        <p><strong>Documentos:</strong> frente, verso e selfie anexados</p>
        <p><strong>Status inicial:</strong> pendente de verificação</p>
      </div>
      {submissionError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-3 py-2 text-xs font-semibold">
          {submissionError}
        </div>
      )}
      <button
        type="button"
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
  );

  return (
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 max-w-2xl mx-auto w-full min-h-full">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={step > 1 ? () => setStep(step - 1) : onCancel}
          className="p-2 text-slate-500 hover:text-slate-900 rounded-xl transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step > 1 ? 'Voltar' : 'Cancelar'}</span>
        </button>
        <span className="text-[11px] font-bold text-slate-500">
          Etapa {step} de {totalSteps}
        </span>
      </div>

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
            <h3 className="text-base font-extrabold text-slate-900">Cadastro Enviado com Sucesso!</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Nossa equipe analisará seus documentos. O perfil poderá receber clientes depois que a verificação for aprovada.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700 font-medium">
            Você pode acompanhar a aprovação no painel do profissional.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      )}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
};
