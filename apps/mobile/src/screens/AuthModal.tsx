import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle, 
  Briefcase,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { CITY_CONFIG } from '@servicos/shared';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { login, signup, loginAsAdmin } = useApp();
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'admin'>('login');
  const [userRole, setUserRole] = useState<'client' | 'provider'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
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

    const result = await signup({
      role: userRole,
      fullName: name,
      email,
      password,
      phone: phone || '(66) 99999-0000',
      neighborhood,
      documentCpf: userRole === 'provider' ? cpf : undefined,
    });

    if (result.success) {
      setSuccessMessage('Conta criada com sucesso no RooServ!');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsLoading(false);
        onSuccess();
      }, 1200);
    } else {
      setIsLoading(false);
      setErrorMessage(result.error || 'Erro ao cadastrar conta.');
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const result = await loginAsAdmin(adminKey);

    if (result.success) {
      setSuccessMessage('Acesso Administrativo Liberado!');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsLoading(false);
        onSuccess();
      }, 1200);
    } else {
      setIsLoading(false);
      setErrorMessage(result.error || 'Chave de administração inválida.');
    }
  };

  const renderSignupFields = () => (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setUserRole('client')}
          className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
            userRole === 'client'
              ? 'bg-brand-50 border-brand-500 text-brand-900 ring-1 ring-brand-500'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <User className="w-4 h-4 text-brand-600" />
          <span>Sou Morador</span>
        </button>

        <button
          type="button"
          onClick={() => setUserRole('provider')}
          className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
            userRole === 'provider'
              ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4 text-amber-600" />
          <span>Sou Prestador</span>
        </button>
      </div>

      <div>
        <label htmlFor="auth-name" className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
        <input
          id="auth-name"
          type="text"
          required
          placeholder="Ex: Mariana Alcantara ou João Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="auth-phone" className="block text-xs font-bold text-slate-700 mb-1">WhatsApp</label>
          <input
            id="auth-phone"
            type="text"
            required
            placeholder="(66) 99999-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="auth-neighborhood" className="block text-xs font-bold text-slate-700 mb-1">Seu Bairro</label>
          <select
            id="auth-neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
          >
            {CITY_CONFIG.defaultNeighborhoods.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {userRole === 'provider' && (
        <div>
          <label htmlFor="auth-cpf" className="block text-xs font-bold text-slate-700 mb-1">CPF do Profissional</label>
          <input
            id="auth-cpf"
            type="text"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
          />
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              {authMode === 'admin' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5 text-brand-600" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {authMode === 'login' && 'Entrar no RooServ'}
                {authMode === 'signup' && 'Criar Conta no RooServ'}
                {authMode === 'admin' && 'Acesso Administrativo'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {authMode === 'admin' 
                  ? 'Painel exclusivo da gestão da plataforma' 
                  : 'Serviços e contratações em Rondonópolis'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-2 animate-in fade-in">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">{successMessage}</h4>
            <p className="text-xs text-slate-500">Conectado ao ecossistema RooServ Rondonópolis</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Seletor de Modo (Entrar / Criar Conta / Gestão) */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg transition-all ${
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
                className={`flex-1 py-2 rounded-lg transition-all ${
                  authMode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Criar Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('admin');
                  setErrorMessage(null);
                }}
                className={`py-2 px-2.5 rounded-lg transition-all flex items-center gap-1 ${
                  authMode === 'admin' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Acesso da Administração"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>

            {/* Formulário de Login */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label htmlFor="auth-login-email" className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    id="auth-login-email"
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="auth-login-password" className="block text-xs font-bold text-slate-700 mb-1">Senha</label>
                  <input
                    id="auth-login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {errorMessage && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? (
                    <span>Entrando...</span>
                  ) : (
                    <>
                      <span>Entrar no RooServ</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Formulário de Cadastro */}
            {authMode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-3">
                {renderSignupFields()}

                <div>
                  <label htmlFor="auth-signup-email" className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    id="auth-signup-email"
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="auth-signup-password" className="block text-xs font-bold text-slate-700 mb-1">Criar Senha</label>
                  <input
                    id="auth-signup-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {errorMessage && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <span>Finalizar Cadastro</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Formulário de Acesso Administrativo */}
            {authMode === 'admin' && (
              <form onSubmit={handleAdminAuth} className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Acesso Restrito ao Gestor</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Insira a senha de administrador ou chave de gestão do RooServ.
                  </p>
                </div>

                <div>
                  <label htmlFor="auth-admin-key" className="block text-xs font-bold text-slate-700 mb-1">Senha Master ou Chave Admin</label>
                  <input
                    id="auth-admin-key"
                    type="password"
                    required
                    placeholder="Digite a chave administrativa"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {errorMessage && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? (
                    <span>Validando chave...</span>
                  ) : (
                    <>
                      <span>Acessar Painel Administrativo</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
