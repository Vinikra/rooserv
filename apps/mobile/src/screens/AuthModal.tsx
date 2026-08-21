import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle, 
  Briefcase,
  Mail,
  ArrowLeft
} from 'lucide-react';
import { CITY_CONFIG } from '@servicos/shared';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const validatePassword = (pass: string): string | null => {
  if (pass.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(pass)) return 'A senha deve conter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(pass)) return 'A senha deve conter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(pass)) return 'A senha deve conter pelo menos um número.';
  return null;
};

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { login, signup } = useApp();
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [userRole, setUserRole] = useState<'client' | 'provider'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [neighborhood, setNeighborhood] = useState(CITY_CONFIG.defaultNeighborhoods[0]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Autenticado com sucesso!');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const result = await login(email, password);

    if (result.success) {
      setSuccessMessage(`Bem-vindo, ${result.user?.fullName.split(' ')[0] || 'Usuário'}!`);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsLoading(false);
        onSuccess();
      }, 1200);
    } else {
      setIsLoading(false);
      setErrorMessage(result.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    if (!name.trim()) {
      setIsLoading(false);
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setIsLoading(false);
      setErrorMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setIsLoading(false);
      setErrorMessage('As senhas não coincidem. Digite novamente.');
      return;
    }

    if (cpf.replace(/\D/g, '').length !== 11) {
      setIsLoading(false);
      setErrorMessage('Informe um CPF válido com 11 dígitos.');
      return;
    }

    const result = await signup({
      role: userRole,
      fullName: name,
      email,
      password,
      phone: phone || '(66) 99999-0000',
      neighborhood,
      documentCpf: cpf,
    });

    if (result.success) {
      setSuccessMessage(result.requiresEmailConfirmation
        ? 'Conta criada! Confirme o link enviado ao seu e-mail antes de entrar.'
        : 'Conta criada com sucesso no RooServ!');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsLoading(false);
        if (result.user) onSuccess();
        else setAuthMode('login');
      }, result.requiresEmailConfirmation ? 3000 : 1200);
    } else {
      setIsLoading(false);
      setErrorMessage(result.error || 'Erro ao cadastrar conta.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    if (!email.trim()) {
      setIsLoading(false);
      setErrorMessage('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: import.meta.env.PROD ? window.location.origin : 'https://rooserv.vercel.app',
      });

      if (error) {
        setIsLoading(false);
        setErrorMessage('Erro ao enviar e-mail de recuperação. Verifique o endereço.');
        return;
      }

      setSuccessMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsLoading(false);
        setAuthMode('login');
      }, 3000);
    } catch {
      setIsLoading(false);
      setErrorMessage('Erro ao processar solicitação. Tente novamente.');
    }
  };

  const renderSignupFields = () => (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setUserRole('client')}
          className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold transition-all active:scale-95 ${
            userRole === 'client'
              ? 'bg-brand-50 border-brand-500 text-brand-900 ring-2 ring-brand-500/20 shadow-sm'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <User className="w-4 h-4 text-brand-600 shrink-0" />
          <span>Sou Morador</span>
        </button>

        <button
          type="button"
          onClick={() => setUserRole('provider')}
          className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold transition-all active:scale-95 ${
            userRole === 'provider'
              ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20 shadow-sm'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Briefcase className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Sou Prestador</span>
        </button>
      </div>

      <div>
        <label htmlFor="auth-name" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
          Nome Completo
        </label>
        <input
          id="auth-name"
          type="text"
          required
          placeholder="Ex: Mariana Alcantara ou João Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="auth-phone" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
            WhatsApp
          </label>
          <input
            id="auth-phone"
            type="text"
            required
            placeholder="(66) 99999-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="auth-neighborhood" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
            Seu Bairro
          </label>
          <select
            id="auth-neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500 font-semibold"
          >
            {CITY_CONFIG.defaultNeighborhoods.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
          <label htmlFor="auth-cpf" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
            CPF
          </label>
          <input
            id="auth-cpf"
            type="text"
            required
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
          />
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl shrink-0">
              {authMode === 'forgot' ? <Mail className="w-6 h-6 text-blue-600" /> : <Lock className="w-6 h-6 text-brand-600" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {authMode === 'login' && 'Entrar no RooServ'}
                {authMode === 'signup' && 'Criar Conta no RooServ'}
                {authMode === 'forgot' && 'Recuperar Senha'}
              </h3>
              <p className="text-xs text-slate-500">
                {authMode === 'forgot'
                  ? 'Enviaremos um link de redefinição por e-mail'
                  : 'Serviços e contratações em Rondonópolis'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9" />
            </div>
            <h4 className="text-base sm:text-lg font-black text-slate-900">{successMessage}</h4>
            <p className="text-xs sm:text-sm text-slate-500">Conectado ao ecossistema RooServ Rondonópolis</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Seletor de Modo com Botões Amplos */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl text-xs sm:text-sm font-extrabold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  authMode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Criar Conta
              </button>
            </div>

            {/* Formulário de Login */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label htmlFor="auth-login-email" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="auth-login-email"
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="auth-login-password" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                    Senha
                  </label>
                  <input
                    id="auth-login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setErrorMessage(null); }}
                  className="text-xs text-brand-600 hover:text-brand-800 font-bold ml-1"
                >
                  Esqueci minha senha
                </button>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm text-red-600 font-medium">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? (
                    <span>Entrando...</span>
                  ) : (
                    <>
                      <span>Entrar no RooServ</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Formulário de Cadastro */}
            {authMode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-3.5">
                {renderSignupFields()}

                <div>
                  <label htmlFor="auth-signup-email" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="auth-signup-email"
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="auth-signup-password" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                    Criar Senha de Acesso
                  </label>
                  <input
                    id="auth-signup-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">Maiúscula + minúscula + número, mínimo 8 caracteres</p>
                </div>

                <div>
                  <label htmlFor="auth-signup-confirm" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                    Confirmar Senha
                  </label>
                  <input
                    id="auth-signup-confirm"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500 ${
                      confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm text-red-600 font-medium">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <span>Finalizar Cadastro</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Formulário de Recuperação de Senha */}
            {authMode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-xs sm:text-sm text-blue-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-700" />
                    <span>Recuperar Acesso</span>
                  </div>
                  <p className="text-xs text-blue-800">
                    Informe seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                <div>
                  <label htmlFor="auth-forgot-email" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                    E-mail Cadastrado
                  </label>
                  <input
                    id="auth-forgot-email"
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm text-red-600 font-medium">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? (
                    <span>Enviando...</span>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      <span>Enviar Link de Recuperação</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setErrorMessage(null); }}
                  className="w-full flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-700 py-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para o login</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
