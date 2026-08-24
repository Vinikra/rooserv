import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, ShieldCheck, Smartphone, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminMfaModalProps {
  onClose: () => void;
  onVerified: () => Promise<void>;
}

type MfaStep = 'loading' | 'enroll' | 'verify';

export const AdminMfaModal: React.FC<AdminMfaModalProps> = ({ onClose, onVerified }) => {
  const [step, setStep] = useState<MfaStep>('loading');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFactorVerified, setIsFactorVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    const prepare = async () => {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel === 'aal2') {
        await onVerified();
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verifiedTotp = factors.totp.find((factor) => factor.status === 'verified');

      if (verifiedTotp) {
        if (!active) return;
        setFactorId(verifiedTotp.id);
        setStep('verify');
        return;
      }

      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'RooServ Admin',
      });
      if (enrollmentError) throw enrollmentError;
      if (!active) return;
      setFactorId(enrollment.id);
      setQrCode(enrollment.totp.qr_code);
      setSecret(enrollment.totp.secret);
      setStep('enroll');
    };

    void prepare().catch(() => {
      if (active) {
        setErrorMessage('Não foi possível preparar a autenticação multifator. Tente novamente.');
        setStep('verify');
      }
    });

    return () => {
      active = false;
    };
  }, [onVerified]);

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrorMessage('Não foi possível copiar. Selecione a chave manualmente.');
    }
  };

  const handleClose = async () => {
    if (step === 'enroll' && factorId && !isSubmitting && !isFactorVerified) {
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    }
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanCode = code.replace(/\D/g, '');
    if (!factorId || cleanCode.length !== 6) {
      setErrorMessage('Digite o código de 6 dígitos exibido no aplicativo autenticador.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    let verificationSucceeded = false;
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: cleanCode,
      });
      if (verifyError) throw verifyError;
      verificationSucceeded = true;
      setIsFactorVerified(true);
      await onVerified();
    } catch {
      setErrorMessage(verificationSucceeded
        ? 'MFA confirmada, mas o painel não pôde ser carregado. Feche e tente abrir novamente.'
        : 'Código inválido ou expirado. Aguarde o próximo código e tente novamente.');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-mfa-title"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="admin-mfa-title" className="text-sm font-black">Proteção do painel administrativo</h2>
              <p className="text-xs text-slate-300">Confirme um segundo fator para continuar</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar autenticação multifator"
            onClick={() => void handleClose()}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {step === 'loading' ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <KeyRound className="h-8 w-8 animate-pulse text-emerald-600" />
              <p className="text-sm font-bold text-slate-700">Preparando autenticação segura…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 'enroll' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                    <div className="mb-2 flex items-center gap-2 font-black">
                      <Smartphone className="h-4 w-4" />
                      Primeiro acesso administrativo
                    </div>
                    <p className="text-xs leading-relaxed">
                      Leia o QR Code com Google Authenticator, Microsoft Authenticator, 1Password ou outro aplicativo TOTP.
                    </p>
                  </div>

                  {qrCode && (
                    <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-3">
                      <img src={qrCode} alt="QR Code para cadastrar o autenticador RooServ" className="h-44 w-44" />
                    </div>
                  )}

                  {secret && (
                    <div>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">Ou digite esta chave no autenticador</span>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <code className="min-w-0 flex-1 select-all break-all text-xs font-bold text-slate-800">{secret}</code>
                        <button
                          type="button"
                          aria-label="Copiar chave do autenticador"
                          onClick={handleCopySecret}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:text-slate-900"
                        >
                          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 'verify' && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-950">
                  Abra o autenticador vinculado ao RooServ. O painel e os documentos de identidade continuam bloqueados até a confirmação.
                </div>
              )}

              <div>
                <label htmlFor="admin-mfa-code" className="mb-2 block text-xs font-black text-slate-700">
                  Código temporário de 6 dígitos
                </label>
                <input
                  id="admin-mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-2xl font-black tracking-[0.45em] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
                <p className="mt-1.5 text-center text-[11px] text-slate-500">O código muda aproximadamente a cada 30 segundos.</p>
              </div>

              {errorMessage && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !factorId || code.length !== 6}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Verificando…' : 'Confirmar e abrir painel'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
