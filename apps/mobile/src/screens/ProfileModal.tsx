import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CITY_CONFIG } from '@servicos/shared';
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

interface ProfileModalProps {
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { currentUser, providers, updateUserProfile, updateProviderProfile, deleteAccount } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteAccount = async () => {
    if (window.confirm('TEM CERTEZA? Esta ação apagará definitivamente seus dados, histórico e não pode ser desfeita.')) {
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

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || CITY_CONFIG.defaultNeighborhoods[0]);
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || PRESET_AVATARS[0]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [bio, setBio] = useState(
    currentProvider?.bio ?? 'Profissional em Rondonópolis.'
  );
  const [hourlyRate, setHourlyRate] = useState(
    String(currentProvider?.hourlyRateEstimate ?? 80)
  );
  const [experienceYears, setExperienceYears] = useState(
    currentProvider?.experienceYears ?? 1
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
      await updateUserProfile({ fullName, phone, neighborhood, avatarUrl });

      if (currentUser?.role === 'provider') {
        await updateProviderProfile({
          bio,
          hourlyRateEstimate: Number(hourlyRate) || 80,
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
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <User className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black leading-tight">
                Meu Perfil & Customização
              </h3>
              <p className="text-xs text-slate-400">
                Altere sua foto, dados de contato e chave Pix
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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
              <img
                src={avatarUrl}
                alt="Foto de Perfil"
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

            {/* Sugestões de Avatares Rápidos */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                Ou escolha um avatar profissional:
              </span>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-transform active:scale-90 cursor-pointer ${
                      avatarUrl === url ? 'border-brand-600 ring-2 ring-brand-500/40 scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-500 appearance-none"
                  >
                    {CITY_CONFIG.defaultNeighborhoods.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Configurações Específicas de Prestador / Chave Pix */}
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
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
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
                    placeholder="Sua chave Pix para recebimento"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Zona de Perigo - LGPD */}
          <div className="pt-4 border-t border-slate-100">
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
              <div className="flex items-center gap-2 text-xs font-extrabold text-red-800 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Excluir Minha Conta (LGPD)</span>
              </div>
              <p className="text-xs text-red-600 font-medium mb-3">
                Ao excluir sua conta, todos os seus dados pessoais, histórico de serviços e anúncios serão permanentemente apagados. Esta ação não pode ser desfeita.
              </p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="w-full bg-white text-red-600 hover:bg-red-100 font-bold text-sm py-2.5 rounded-xl border border-red-200 transition-colors cursor-pointer"
              >
                Excluir Minha Conta Definitivamente
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
