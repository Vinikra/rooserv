import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CITY_CONFIG, isValidBrazilianPhone } from '@servicos/shared';
import { 
  X, 
  Camera, 
  Upload, 
  User, 
  Phone, 
  MapPin, 
  CheckCircle, 
  DollarSign, 
  Wallet, 
  Sparkles,
  BookOpen,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { RooServStorageService } from '../services/storageService';
import { UserAvatar } from '../components/UserAvatar';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { currentUser, providers, updateUserProfile, updateProviderProfile, deleteAccount } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteAccount = async () => {
    if (window.confirm('TEM CERTEZA? Esta ação encerra o acesso, anonimiza seus dados pessoais e não pode ser desfeita.')) {
      setSaveError(null);
      try {
        const success = await deleteAccount();
        if (success) onClose();
        else setSaveError('Não foi possível excluir a conta. Tente novamente.');
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Não foi possível excluir a conta.');
      }
    }
  };

  const currentProvider = providers.find((p) => p.profileId === currentUser?.id);
  const isPixLocked = currentProvider?.verificationStatus === 'verified';

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [bio, setBio] = useState(
    currentProvider?.bio ?? ''
  );
  const [hourlyRate, setHourlyRate] = useState(
    currentProvider?.hourlyRateEstimate ? String(currentProvider.hourlyRateEstimate) : ''
  );
  const [experienceYears, setExperienceYears] = useState(
    currentProvider?.experienceYears ?? 0
  );
  const [pixKeyType, setPixKeyType] = useState(
    currentProvider?.pixKeyType ?? 'phone'
  );
  const [pixKey, setPixKey] = useState(
    currentProvider?.pixKey ?? currentUser?.phone ?? ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingAvatar(true);
      setSaveError(null);
      try {
        const url = await RooServStorageService.uploadImage(file, 'avatars');
        setAvatarUrl(url);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.');
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      if (fullName.trim().length < 3) throw new Error('Informe seu nome completo.');
      if (!isValidBrazilianPhone(phone)) throw new Error('Informe um telefone com DDD válido.');
      if (!neighborhood) throw new Error('Selecione seu bairro.');

      let numericHourlyRate: number | undefined;
      if (currentUser?.role === 'provider') {
        numericHourlyRate = Number(hourlyRate);
        if (bio.trim().length < 20) throw new Error('A apresentação deve ter pelo menos 20 caracteres.');
        if (!Number.isFinite(numericHourlyRate) || numericHourlyRate <= 0 || numericHourlyRate > 100000) {
          throw new Error('Informe um valor por hora válido.');
        }
        if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80) {
          throw new Error('Informe os anos de experiência entre 0 e 80.');
        }
        if (pixKey.trim().length < 3) throw new Error('Informe uma chave Pix válida.');
      }

      await updateUserProfile({ fullName, phone, neighborhood, avatarUrl });

      if (currentUser?.role === 'provider' && numericHourlyRate !== undefined) {
        await updateProviderProfile({
          bio,
          hourlyRateEstimate: numericHourlyRate,
          experienceYears,
          pixKey,
          pixKeyType,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderSaveButtonContent = () => {
    if (saveSuccess) {
      return (
        <>
          <CheckCircle className="w-5 h-5 text-emerald-300" />
          <span>Alterações Salvas com Sucesso!</span>
        </>
      );
    }
    if (isSaving) {
      return <span>Salvando...</span>;
    }
    return <span>Salvar Meu Perfil</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <User className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 id="profile-modal-title" className="text-base sm:text-lg font-black leading-tight">
                Meu Perfil & Customização
              </h3>
              <p className="text-xs text-slate-400">
                {currentUser?.role === 'provider'
                  ? 'Altere sua foto, dados de contato e chave Pix'
                  : 'Altere sua foto e seus dados de contato'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar edição do perfil"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário Rolável */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Seção Foto de Perfil */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 text-center space-y-4">
            <div className="relative inline-block mx-auto">
              <UserAvatar
                src={avatarUrl || undefined}
                name={fullName}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-md mx-auto"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-brand-600 hover:bg-brand-500 text-white p-2.5 rounded-full shadow-lg border-2 border-white transition-transform active:scale-95 cursor-pointer"
                title="Trocar Foto"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <div>
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl border border-brand-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando foto...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Carregar Foto da Galeria / Câmera</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Informações Cadastrais
            </h4>

            <div>
              <label htmlFor="input-fullname" className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome Completo ou Nome Profissional
              </label>
              <input
                id="input-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Prof. Vinícius • Matemática"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-phone" className="block text-xs font-bold text-slate-700 mb-1.5">
                  WhatsApp / Telefone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(66) 99999-0000"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="select-neighborhood" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bairro Base em Rondonópolis
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="select-neighborhood"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-500 appearance-none"
                  >
                    <option value="" disabled>Selecione um bairro</option>
                    {CITY_CONFIG.defaultNeighborhoods.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Configurações Específicas de Prestador / Chave Pix */}
          {currentUser?.role === 'provider' && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Configurações do Profissional & Chave Pix</span>
              </h4>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                Recebimento & Clientes
              </span>
            </div>

            <div>
              <label htmlFor="input-bio" className="block text-xs font-bold text-slate-700 mb-1.5">
                Apresentação / Bio dos Serviços
              </label>
              <textarea
                id="input-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                minLength={20}
                maxLength={2000}
                required
                placeholder="Descreva suas qualificações, experiência com aulas ou reparos..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-hourly-rate" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Valor Estimado por Hora / Aula (R$)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-hourly-rate"
                    type="number"
                    min="1"
                    max="100000"
                    step="0.01"
                    required
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="80"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-exp-years" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Anos de Experiência
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-exp-years"
                    type="number"
                    min="0"
                    max="80"
                    required
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* Chave Pix para Saques */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950">
                <Wallet className="w-4 h-4 text-amber-600" />
                <span>Chave Pix para Recebimento de Repasses</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="select-pix-type" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tipo
                  </label>
                  <select
                    id="select-pix-type"
                    value={pixKeyType}
                    onChange={(e) => setPixKeyType(e.target.value)}
                    disabled={isPixLocked}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="phone">Telefone</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="random">Aleatória</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="input-pix-key" className="block text-[11px] font-bold text-slate-600 mb-1">
                    Chave Pix
                  </label>
                  <input
                    id="input-pix-key"
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    minLength={3}
                    required
                    disabled={isPixLocked}
                    placeholder="Sua chave Pix para recebimento"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>
              {isPixLocked && (
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  A chave Pix de um perfil verificado fica bloqueada para proteger os repasses. Solicite uma nova verificação à gestão para alterá-la.
                </p>
              )}
            </div>
          </div>
          )}

          {/* Zona de Perigo - LGPD */}
          <div className="pt-4 border-t border-slate-100">
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
              <div className="flex items-center gap-2 text-xs font-extrabold text-red-800 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Excluir Minha Conta (LGPD)</span>
              </div>
              <p className="text-xs text-red-600 font-medium mb-3">
                Ao excluir sua conta, o acesso será encerrado e os dados pessoais serão anonimizados. Registros financeiros e de serviços que precisem ser preservados por obrigação legal ou prevenção a fraude deixam de identificar publicamente você.
              </p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="w-full bg-white text-red-600 hover:bg-red-100 font-bold text-sm py-2.5 rounded-xl border border-red-200 transition-colors cursor-pointer"
              >
                Excluir e Anonimizar Minha Conta
              </button>
            </div>
          </div>

          {saveError && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-3 py-2 text-xs font-semibold">
              {saveError}
            </div>
          )}

          {/* Botão de Salvar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white font-extrabold text-sm sm:text-base py-4 rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {renderSaveButtonContent()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
