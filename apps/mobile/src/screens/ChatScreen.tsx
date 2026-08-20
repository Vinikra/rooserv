import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrencyBRL, sanitizeChatMessage } from '@servicos/shared';
import { 
  Send, 
  ShieldCheck, 
  CheckCheck, 
  CheckCircle, 
  X, 
  ArrowLeft, 
  Sparkles, 
  DollarSign, 
  ShieldAlert 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatScreenProps {
  recipientUser: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  };
  onBack: () => void;
  onAcceptProposal: (amount: number) => void;
}

interface Message {
  id: string;
  senderId: 'me' | 'other';
  text: string;
  time: string;
  proposalData?: {
    totalAmount: number;
    description: string;
    isAccepted: boolean;
  };
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  recipientUser,
  onBack,
  onAcceptProposal,
}) => {
  const { currentRole } = useApp();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(`rooserv_chat_${recipientUser.id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignora
    }
    return [];
  });

  const [isSendingProposal, setIsSendingProposal] = useState(false);
  const [newProposalAmount, setNewProposalAmount] = useState('80');
  const [newProposalDesc, setNewProposalDesc] = useState('');
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(`rooserv_chat_${recipientUser.id}`, JSON.stringify(messages));
    } catch {
      // Ignora
    }
  }, [messages, recipientUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sincronização em Tempo Real com Supabase Realtime WebSockets
  useEffect(() => {
    const channelName = `rooserv_chat_${recipientUser.id}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    const handleNewMessage = (payload: any) => {
      if (!payload?.payload) return;
      setMessages((prev) => [...prev, payload.payload]);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    };

    const handleProposalAccepted = (payload: any) => {
      const msgId = payload?.payload?.msgId;
      if (!msgId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.proposalData
            ? { ...m, proposalData: { ...m.proposalData, isAccepted: true } }
            : m
        )
      );
    };

    channel
      .on('broadcast', { event: 'new_message' }, handleNewMessage)
      .on('broadcast', { event: 'proposal_accepted' }, handleProposalAccepted)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [recipientUser.id]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    // Executa motor de proteção anti-vazamento RooServ
    const scanResult = sanitizeChatMessage(inputText);

    if (scanResult.hasSensitiveContact) {
      setSecurityAlert(
        '⚠️ Tentativa de contato externo bloqueada! Para sua segurança, garantia e proteção contra golpes, números de telefone, chaves Pix e redes sociais não podem ser enviados no chat.'
      );
    }

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      text: scanResult.sanitizedText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    const channelName = `rooserv_chat_${recipientUser.id}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: newMsg,
    });
  };

  const handleQuickReply = (text: string) => {
    setInputText(text);
  };

  const handleAcceptProposalCard = (msgId: string, amount: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.proposalData
          ? { ...m, proposalData: { ...m.proposalData, isAccepted: true } }
          : m
      )
    );

    const channelName = `rooserv_chat_${recipientUser.id}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: 'proposal_accepted',
      payload: { msgId },
    });

    onAcceptProposal(amount);
  };

  const handleSendCustomProposal = () => {
    const amount = Number.parseFloat(newProposalAmount) || 150;
    const desc = newProposalDesc.trim() || 'Serviço sob medida acordado no chat.';

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      text: 'Enviei uma proposta formal para este serviço:',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      proposalData: {
        totalAmount: amount,
        description: desc,
        isAccepted: false,
      },
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsSendingProposal(false);
    setNewProposalDesc('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 relative">
      {/* Top Header da Conversa */}
      <div className="bg-slate-900 text-white px-4 py-3.5 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-300 hover:text-white rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="relative">
            <img
              src={recipientUser.avatarUrl || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150'}
              alt={recipientUser.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 shadow-xs"
            />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
              {recipientUser.name}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <span>{`${recipientUser.subtitle} •`}</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                <span>Realtime Ativo</span>
              </span>
            </p>
          </div>
        </div>

        {/* Ação de Criar Proposta (Visão Prestador) */}
        {currentRole === 'provider' && (
          <button
            type="button"
            onClick={() => setIsSendingProposal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>Enviar Orçamento</span>
          </button>
        )}
      </div>

      {/* Alerta Flutuante de Tentativa de Vazamento Bloqueada */}
      {securityAlert && (
        <div className="bg-red-600 text-white px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200 sticky top-[65px] z-20">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-red-200 shrink-0" />
            <span className="leading-snug">{securityAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSecurityAlert(null)}
            className="p-1.5 hover:bg-red-700 rounded-lg text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Alerta de Segurança e Anti-Vazamento */}
      <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 flex items-center gap-2.5 text-xs text-amber-950 font-medium">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="leading-tight">
          <strong>Proteção RooServ:</strong> Mantenha as negociações pelo chat para garantir o direito à garantia e mediação de disputas.
        </p>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-24">
        {messages.length === 0 && (
          <div className="bg-white rounded-3xl p-6 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-6 space-y-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-900">
              Início da conversa com {recipientUser.name}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tire dúvidas, envie detalhes do serviço ou solicite um orçamento formal com garantia e pagamento seguro por custódia.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              <button
                type="button"
                onClick={() => setInputText('Olá! Gostaria de um orçamento para o serviço.')}
                className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer"
              >
                "Olá! Gostaria de um orçamento."
              </button>
              <button
                type="button"
                onClick={() => setInputText('Qual a sua disponibilidade para atendimento em Rondonópolis?')}
                className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer"
              >
                "Qual a sua disponibilidade?"
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-3xl p-4 text-sm shadow-sm ${
                  isMe
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Cartão de Proposta / Orçamento Formal */}
                {msg.proposalData && (
                  <div
                    className={`mt-3 p-4 rounded-2xl border ${
                      isMe
                        ? 'bg-brand-700/90 border-brand-500 text-white'
                        : 'bg-slate-900 text-white border-slate-800'
                    } shadow-md space-y-2.5`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                        <Sparkles className="w-4 h-4" />
                        <span>Orçamento Formal com Garantia</span>
                      </span>
                      <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-slate-200 font-bold">
                        Custódia RooServ
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                      {msg.proposalData.description}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Total com Mão de Obra</span>
                        <span className="text-base sm:text-lg font-black text-emerald-400">
                          {formatCurrencyBRL(msg.proposalData.totalAmount)}
                        </span>
                      </div>

                      {msg.proposalData.isAccepted ? (
                        <span className="bg-emerald-500/20 text-emerald-300 font-black text-xs px-3.5 py-2 rounded-xl border border-emerald-500/40 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" />
                          <span>Proposta Aceita!</span>
                        </span>
                      ) : (
                        currentRole === 'client' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptProposalCard(msg.id, msg.proposalData!.totalAmount)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <span>Aceitar Proposta</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center justify-end gap-1 text-[11px] mt-1 font-semibold ${
                    isMe ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  <span>{msg.time}</span>
                  {isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-200" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões de Respostas Rápidas */}
      <div className="bg-white/90 backdrop-blur-sm border-t border-slate-200 px-3.5 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          'Qual o melhor dia para você?',
          'Você já tem os materiais?',
          'Pode enviar uma foto do local?',
          'Vou revisar o orçamento!',
        ].map((quick) => (
          <button
            type="button"
            key={quick}
            onClick={() => handleQuickReply(quick)}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl whitespace-nowrap border border-slate-200 shrink-0 transition-colors"
          >
            {`+ ${quick}`}
          </button>
        ))}
      </div>

      {/* Input de Mensagem com Botão Grande */}
      <div className="bg-white p-3.5 border-t border-slate-200 flex items-center gap-2.5">
        <input
          type="text"
          placeholder="Digite sua mensagem aqui..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Modal de Criação de Proposta Rápida (Para o Prestador) */}
      {isSendingProposal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Enviar Orçamento Oficial
                  </h3>
                  <p className="text-xs text-slate-500">
                    O cliente receberá o card para aceitar na hora
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSendingProposal(false)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label htmlFor="custom-proposal-amount" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                Valor Total do Serviço (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                  R$
                </span>
                <input
                  id="custom-proposal-amount"
                  type="number"
                  value={newProposalAmount}
                  onChange={(e) => setNewProposalAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-slate-900 font-black focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="custom-proposal-desc" className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1.5">
                O que está incluso no serviço?
              </label>
              <textarea
                id="custom-proposal-desc"
                rows={3}
                placeholder="Ex: Troca de disjuntores, fiação 6mm e 30 dias de garantia..."
                value={newProposalDesc}
                onChange={(e) => setNewProposalDesc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSendCustomProposal}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-sm sm:text-base py-4 px-5 rounded-2xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Send className="w-4 h-4" />
              <span>Enviar Proposta no Chat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
