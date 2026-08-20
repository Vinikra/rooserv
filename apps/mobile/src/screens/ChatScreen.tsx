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

interface ChatScreenProps {
  recipientUser: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'client' | 'provider';
    subtitle: string;
  };
  onBack: () => void;
  onAcceptProposal?: (amount: number) => void;
}

interface MockMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  isProposal?: boolean;
  proposalData?: {
    laborAmount: number;
    materialsAmount: number;
    totalAmount: number;
    warrantyDays: number;
    estimatedDays: number;
    description: string;
    isAccepted?: boolean;
  };
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  recipientUser,
  onBack,
  onAcceptProposal,
}) => {
  const { currentRole, currentUser } = useApp();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<MockMessage[]>([
    {
      id: 'm1',
      senderId: 'other',
      senderName: recipientUser.name,
      text: 'Olá! Vi sua solicitação para o bairro Vila Aurora. Consegue me mandar mais detalhes do problema no chuveiro?',
      time: '14:20',
    },
    {
      id: 'm2',
      senderId: 'me',
      senderName: currentUser.fullName,
      text: 'Olá! O disjuntor de 20A está desarmando após uns 10 minutos de banho. Acho que os fios são muito finos.',
      time: '14:22',
    },
    {
      id: 'm3',
      senderId: 'other',
      senderName: recipientUser.name,
      text: 'Entendi perfeitamente! Provavelmente precisamos colocar fiação de 6mm e um disjuntor de 32A com proteção DR.',
      time: '14:24',
    },
    {
      id: 'm4',
      senderId: 'other',
      senderName: recipientUser.name,
      text: 'Acabei de gerar a proposta oficial do serviço para você aprovar:',
      time: '14:25',
      isProposal: true,
      proposalData: {
        laborAmount: 180,
        materialsAmount: 40,
        totalAmount: 220,
        warrantyDays: 60,
        estimatedDays: 1,
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

    const newMsg: MockMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      senderName: currentUser.fullName,
      text: scanResult.sanitizedText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Dispara no WebSocket Realtime para o outro participante
    const channelName = `rooserv_chat_${recipientUser.id}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: {
        ...newMsg,
        senderId: 'other',
        senderName: currentUser.fullName,
      },
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

    // Notifica o prestador via Realtime
    const channelName = `rooserv_chat_${recipientUser.id}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: 'proposal_accepted',
      payload: { msgId, amount },
    });

    if (onAcceptProposal) {
      onAcceptProposal(amount);
    }
  };

  const handleSendCustomProposal = () => {
    const val = Number(newProposalAmount) || 200;
    const newMsg: MockMessage = {
      id: `prop-${Date.now()}`,
      senderId: 'me',
      senderName: currentUser.fullName,
      text: 'Enviei uma proposta oficial de serviço:',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      isProposal: true,
      proposalData: {
        laborAmount: val,
        materialsAmount: 0,
        totalAmount: val,
        warrantyDays: 30,
        estimatedDays: 1,
        description: newProposalDesc || 'Serviço de manutenção especializado com garantia RooServ.',
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
              <span>{recipientUser.subtitle}</span> • 
              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Realtime Ativo
              </span>
            </p>
          </div>
        </div>

        {/* Ação de Criar Proposta (Visão Prestador) */}
        {currentRole === 'provider' && (
          <button
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
                    ? 'bg-brand-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>

                {/* Card de Proposta Oficial In-Chat */}
                {msg.isProposal && msg.proposalData && (
                  <div className="mt-2.5 bg-slate-900 text-white rounded-xl p-3.5 space-y-2.5 border border-slate-700 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Orçamento RooServ</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                        {msg.proposalData.warrantyDays} dias de garantia
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-normal">
                      {msg.proposalData.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Valor Total:</span>
                        <strong className="text-base font-extrabold text-emerald-400">
                          {formatCurrencyBRL(msg.proposalData.totalAmount)}
                        </strong>
                      </div>

                      {msg.proposalData.isAccepted ? (
                        <span className="bg-emerald-500/20 text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Proposta Aceita!
                        </span>
                      ) : (
                        currentRole === 'client' && (
                          <button
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
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Modal de Criação de Proposta Rápida (Para o Prestador) */}
      {isSendingProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
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
                onClick={() => setIsSendingProposal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Valor Total do Serviço (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <input
                  type="number"
                  value={newProposalAmount}
                  onChange={(e) => setNewProposalAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                O que está incluso no serviço?
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Troca de disjuntores, revisão de fiação e 30 dias de garantia..."
                value={newProposalDesc}
                onChange={(e) => setNewProposalDesc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
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
