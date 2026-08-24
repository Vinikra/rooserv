import React, { useState } from 'react';
import { CheckCircle, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPasswordValidationError } from '@servicos/shared';

interface PasswordResetModalProps {
  onClose: () => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({ onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const clearRecoveryUrl = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validationError = getPasswordValidationError(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (updateError) {
      setError('O link expirou ou não foi possível atualizar a senha. Solicite um novo link.');
      return;
    }

    clearRecoveryUrl();
    setIsComplete(true);
  };

  const handleFinish = () => {
    onClose();
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    clearRecoveryUrl();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="password-reset-title" className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl">
        {isComplete ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-14 h-14 text-emerald-600 mx-auto" />
            <div>
              <h2 id="password-reset-title" className="text-xl font-black text-slate-900">Senha atualizada</h2>
              <p className="text-sm text-slate-600 mt-2">Sua nova senha já pode ser usada para entrar no RooServ.</p>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl"
            >
              Continuar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
              <KeyRound className="w-12 h-12 text-emerald-600 mx-auto" />
              <h2 id="password-reset-title" className="text-xl font-black text-slate-900 mt-3">Definir nova senha</h2>
              <p className="text-sm text-slate-600 mt-1">Crie uma senha segura para concluir a recuperação da conta.</p>
            </div>

            <div>
              <label htmlFor="recovery-password" className="block text-xs font-bold text-slate-700 mb-1">Nova senha</label>
              <input
                id="recovery-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="recovery-confirmation" className="block text-xs font-bold text-slate-700 mb-1">Confirmar nova senha</label>
              <input
                id="recovery-confirmation"
                type="password"
                required
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {isSaving ? 'Atualizando...' : 'Atualizar senha'}
            </button>
            <button type="button" onClick={handleCancel} className="w-full text-xs text-slate-500 font-medium py-1">
              Cancelar recuperação
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
