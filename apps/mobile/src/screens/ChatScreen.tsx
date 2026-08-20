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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      senderId: 'other',
      text: 'Olá! Sou profissional parceiro do RooServ. Vi seu pedido de manutenção elétrica.',
      time: '14:30',
    },
    {
      id: 'm2',
      senderId: 'me',
      text: 'Boa tarde! O disjuntor do chuveiro está desarmando direto quando coloco no quente. Quanto fica para revisar e trocar a fiação?',
      time: '14:32',
    },
    {
      id: 'm3',
      senderId: 'other',
      text: 'Consigo ir aí no seu bairro hoje à tarde por volta das 16h30 para fazer o serviço completo.',
      time: '14:35',
    },
    {
      id: 'm4',
      senderId: 'other',
      text: 'Acabei de gerar o orçamento formal com o seguro de 60 dias da plataforma:',
      time: '14:36',
      proposalData: {
        totalAmount: 220.0,
        description: 'Troca do cabeamento para 6mm antichamas + instalação de disjuntor DIN bipolar e conector cerâmico para o chuveiro.',
        isAccepted: false,
      },
    },
  ]);

  const [isSendingProposal, setIsSendingProposal] = useState(false);
  const [newProposalAmount, setNewProposalAmount] = useState('220');
  const [newProposalDesc, setNewProposalDesc] = useState('');
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      setTimeout(() => setSecurityAlert(null), 5000);
    }

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      text: scanResult.sanitizedText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Transmite mensagem em tempo real para a outra ponta
    const channel = supabase.channel(`rooserv_chat_${recipientUser.id}`);
    channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: { ...newMsg, senderId: 'other' },
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

    // Notifica em tempo real que a proposta foi aceita
    const channel = supabase.channel(`rooserv_chat_${recipientUser.id}`);
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
      <div className="bg-slate-900 text-white px-4 py-3 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1 text-slate-300 hover:text-white rounded-lg active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative">
            <img
              src={recipientUser.avatarUrl || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150'}
              alt={recipientUser.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900" />
          </div>

          <div>
            <h3 className="text-xs font-bold text-white leading-tight">
              {recipientUser.name}
            </h3>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span>{`${recipientUser.subtitle} •`}</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
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
            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition-all"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Enviar Orçamento</span>
          </button>
        )}
      </div>

      {/* Alerta Flutuante de Tentativa de Vazamento Bloqueada */}
      {securityAlert && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200 sticky top-[57px] z-20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-200 shrink-0" />
            <span className="leading-tight text-[11px]">{securityAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSecurityAlert(null)}
            className="p-1 hover:bg-red-700 rounded-lg text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alerta de Segurança e Anti-Vazamento */}
      <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 flex items-center gap-2 text-[11px] text-amber-900">
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="leading-tight">
          <strong>Proteção RooServ:</strong> Mantenha as negociações por aqui para garantir o direito à assistência e avaliação.
        </p>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs shadow-sm ${
                  isMe
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Cartão de Proposta / Orçamento Formal */}
                {msg.proposalData && (
                  <div
                    className={`mt-2.5 p-3 rounded-xl border ${
                      isMe
                        ? 'bg-brand-700/80 border-brand-500 text-white'
                        : 'bg-slate-900 text-white border-slate-800'
                    } shadow-md space-y-2`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        Orçamento Formal com Garantia
                      </span>
                      <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-200">
                        Custódia RooServ
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-snug">
                      {msg.proposalData.description}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total com Mão de Obra</span>
                        <span className="text-sm font-black text-emerald-400">
                          {formatCurrencyBRL(msg.proposalData.totalAmount)}
                        </span>
                      </div>

                      {msg.proposalData.isAccepted ? (
                        <span className="bg-emerald-500/20 text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Proposta Aceita!
                        </span>
                      ) : (
                        currentRole === 'client' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptProposalCard(msg.id, msg.proposalData!.totalAmount)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>Aceitar Proposta</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${
                    isMe ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  <span>{msg.time}</span>
                  {isMe && <CheckCheck className="w-3 h-3 text-blue-200" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões de Respostas Rápidas */}
      <div className="bg-white/90 backdrop-blur-sm border-t border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-full whitespace-nowrap border border-slate-200 shrink-0 transition-colors"
          >
            + {quick}
          </button>
        ))}
      </div>

      {/* Input de Mensagem */}
      <div className="bg-white p-3 border-t border-slate-200 flex items-center gap-2">
        <input
          type="text"
          placeholder="Digite sua mensagem aqui..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Modal de Criação de Proposta Rápida (Para o Prestador) */}
      {isSendingProposal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Enviar Orçamento Oficial
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O cliente receberá o card para aceitar na hora
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSendingProposal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="custom-proposal-amount" className="block text-xs font-bold text-slate-700 mb-1">
                Valor Total do Serviço (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <input
                  id="custom-proposal-amount"
                  type="number"
                  value={newProposalAmount}
                  onChange={(e) => setNewProposalAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="custom-proposal-desc" className="block text-xs font-bold text-slate-700 mb-1">
                O que está incluso no serviço?
              </label>
              <textarea
                id="custom-proposal-desc"
                rows={3}
                placeholder="Ex: Troca de disjuntores, revisão de fiação e 30 dias de garantia..."
                value={newProposalDesc}
                onChange={(e) => setNewProposalDesc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSendCustomProposal}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar Proposta no Chat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
