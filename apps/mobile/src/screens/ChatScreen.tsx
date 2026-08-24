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
  ShieldAlert,
  Play,
  Pause
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from '../components/UserAvatar';

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
  audioUrl?: string;
  audioDuration?: string;
  proposalData?: {
    proposalId?: string;
    requestId?: string;
    totalAmount: number;
    description: string;
    estimatedDays?: number;
    warrantyDays?: number;
    isAccepted: boolean;
  };
}

// Subcomponente de Card de Proposta Formal
const ChatProposalCard: React.FC<{
  isMe: boolean;
  currentRole: string;
  msgId: string;
  proposalData: NonNullable<Message['proposalData']>;
  onAccept: (msgId: string, amount: number) => void;
}> = ({ isMe, currentRole, msgId, proposalData, onAccept }) => {
  return (
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
          <span>Orçamento Formal</span>
        </span>
        <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-slate-200 font-bold">
          Pagamento RooServ
        </span>
      </div>

      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
        {proposalData.description}
      </p>

      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">
            Valor Total
          </span>
          <strong className="text-base sm:text-lg font-black text-white">
            {formatCurrencyBRL(proposalData.totalAmount)}
          </strong>
        </div>

        {!isMe && currentRole === 'client' && (
          <button
            type="button"
            disabled={proposalData.isAccepted}
            onClick={() => onAccept(msgId, proposalData.totalAmount)}
            className={`font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 ${
              proposalData.isAccepted
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 cursor-pointer'
            }`}
          >
            {proposalData.isAccepted ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Proposta Aceita!</span>
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4" />
                <span>Aceitar proposta</span>
              </>
            )}
          </button>
        )}

        {proposalData.isAccepted && isMe && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-extrabold bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30">
            <CheckCircle className="w-4 h-4" />
            <span>Cliente aceitou • pagamento pendente</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Subcomponente de Balão de Mensagem Individual
const ChatMessageBubble: React.FC<{
  msg: Message;
  currentRole: string;
  playingAudioId: string | null;
  onPlayAudio: (id: string, url: string) => void;
  onAcceptProposal: (msgId: string, amount: number) => void;
}> = ({ msg, currentRole, playingAudioId, onPlayAudio, onAcceptProposal }) => {
  const isMe = msg.senderId === 'me';

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
      <div
        className={`max-w-[88%] sm:max-w-[78%] rounded-3xl p-4 text-sm shadow-sm ${
          isMe
            ? 'bg-brand-600 text-white rounded-br-none'
            : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
        }`}
      >
        {msg.audioUrl ? (
          <div className="flex items-center gap-3 py-1.5 min-w-[200px]">
            <button
              type="button"
              onClick={() => onPlayAudio(msg.id, msg.audioUrl!)}
              aria-label={playingAudioId === msg.id ? 'Pausar mensagem de áudio' : 'Reproduzir mensagem de áudio'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0 ${
                isMe ? 'bg-white text-brand-700 shadow' : 'bg-brand-600 text-white shadow'
              }`}
            >
              {playingAudioId === msg.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`h-2 rounded-full overflow-hidden ${isMe ? 'bg-white/30' : 'bg-slate-200'}`}>
                <div className={`h-full ${isMe ? 'bg-white' : 'bg-brand-600'} w-3/4 rounded-full`} />
              </div>
              <span className={`text-[10px] font-bold block mt-1 ${isMe ? 'text-blue-100' : 'text-slate-500'}`}>
                Áudio • {msg.audioDuration || '0:05'}
              </span>
            </div>
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        )}

        {msg.proposalData && (
          <ChatProposalCard
            isMe={isMe}
            currentRole={currentRole}
            msgId={msg.id}
            proposalData={msg.proposalData}
            onAccept={onAcceptProposal}
          />
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
};

export const ChatScreen: React.FC<ChatScreenProps> = ({
  recipientUser,
  onBack,
  onAcceptProposal,
}) => {
  const { currentRole, currentUser, acceptChatProposal } = useApp();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const mapDbMessage = (dbMsg: any): Message => {
    let payload: Partial<Message> = {};
    try {
      payload = JSON.parse(dbMsg.content);
    } catch {
      payload = { text: dbMsg.content };
    }
    return {
      id: dbMsg.id,
      senderId: dbMsg.sender_id === currentUser?.id ? 'me' : 'other',
      text: payload.text || '',
      time: new Date(dbMsg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      proposalData: payload.proposalData,
    };
  };

  useEffect(() => {
    const loadMessages = async () => {
      if (!currentUser?.id || !recipientUser.id) return;
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipientUser.id}),and(sender_id.eq.${recipientUser.id},recipient_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages((data || []).map(mapDbMessage));
      } catch (error) {
        setMessages([]);
        setSecurityAlert(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.');
      }
    };
    loadMessages();
  }, [currentUser?.id, recipientUser.id]);

  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handlePlayAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId && activeAudioRef.current) {
      activeAudioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }

    const audio = new Audio(url);
    activeAudioRef.current = audio;
    setPlayingAudioId(msgId);

    audio.onended = () => {
      setPlayingAudioId(null);
    };

    audio.play().catch(() => {
      setPlayingAudioId(null);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime reflete somente linhas que já foram confirmadas pelo banco.
  useEffect(() => {
    if (!currentUser?.id) return;
    const channelName = `rooserv_messages_${currentUser.id}`;
    const channel = supabase.channel(channelName);

    const handlePersistedMessage = (payload: any) => {
      const row = payload?.new;
      if (!row) return;
      const belongsToConversation = (
        (row.sender_id === currentUser.id && row.recipient_id === recipientUser.id)
        || (row.sender_id === recipientUser.id && row.recipient_id === currentUser.id)
      );
      if (!belongsToConversation) return;
      const mapped = mapDbMessage(row);
      setMessages((prev) => prev.some((message) => message.id === mapped.id)
        ? prev.map((message) => message.id === mapped.id ? mapped : message)
        : [...prev, mapped]);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handlePersistedMessage)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, handlePersistedMessage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, recipientUser.id]);

  const persistMessageToSupabase = async (msg: Message): Promise<Message> => {
    if (!currentUser?.id || !recipientUser.id) throw new Error('Faça login para enviar mensagens.');
    const payload = {
      text: msg.text,
      ...(msg.proposalData ? { proposalData: msg.proposalData } : {}),
    };
    const { data, error } = await supabase.rpc('send_chat_message', {
      p_recipient_id: recipientUser.id,
      p_payload: payload,
    });
    if (error || !data?.id) throw new Error(error?.message || 'O servidor não confirmou o envio.');
    return mapDbMessage(data);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const scanResult = sanitizeChatMessage(inputText);

    if (scanResult.hasSensitiveContact) {
      setSecurityAlert(
        '⚠️ Tentativa de contato externo bloqueada. Para manter a negociação registrada, números de telefone e redes sociais não podem ser enviados no chat.'
      );
    }

    const pendingMessage: Message = {
      id: crypto.randomUUID(),
      senderId: 'me',
      text: scanResult.sanitizedText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setIsPersisting(true);
    try {
      const savedMessage = await persistMessageToSupabase(pendingMessage);
      setMessages((prev) => prev.some((message) => message.id === savedMessage.id)
        ? prev
        : [...prev, savedMessage]);
      setInputText('');
    } catch (error) {
      setSecurityAlert(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setIsPersisting(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setInputText(text);
  };

  const handleAcceptFormalProposal = async (msgId: string, amount: number) => {
    try {
      setIsPersisting(true);
      await acceptChatProposal(msgId);
      setMessages((prev) => prev.map((message) =>
        message.id === msgId && message.proposalData
          ? { ...message, proposalData: { ...message.proposalData, isAccepted: true } }
          : message
      ));
      onAcceptProposal(amount);
    } catch (error) {
      setSecurityAlert(error instanceof Error ? error.message : 'Não foi possível aceitar a proposta.');
    } finally {
      setIsPersisting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 relative">
      {/* Top Header da Conversa */}
      <div className="bg-slate-900 text-white px-4 py-3.5 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para conversas"
            className="p-2 text-slate-300 hover:text-white rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="relative">
            <UserAvatar
              src={recipientUser.avatarUrl}
              name={recipientUser.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-brand-500 shadow-sm"
            />
          </div>

          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight">
              {recipientUser.name}
            </h1>
            <span className="text-xs text-brand-300 font-medium block">
              {recipientUser.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Chat protegido</span>
          </div>
        </div>
      </div>

      {/* Alerta de Segurança e Anti-Vazamento */}
      {securityAlert && (
        <div role="alert" aria-live="assertive" className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-black flex items-center justify-between gap-2 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{securityAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSecurityAlert(null)}
            aria-label="Fechar alerta de segurança"
            className="p-1 hover:bg-black/10 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-24">
        {messages.length === 0 && (
          <div className="bg-white rounded-3xl p-6 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-6 space-y-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Início da conversa com {recipientUser.name}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tire dúvidas, envie detalhes do serviço ou solicite um orçamento formal com pagamento pela plataforma.
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

        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            msg={msg}
            currentRole={currentRole}
            playingAudioId={playingAudioId}
            onPlayAudio={handlePlayAudio}
            onAcceptProposal={handleAcceptFormalProposal}
          />
        ))}
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

      {/* Input de mensagem. Áudio permanece indisponível até existir storage privado persistente. */}
      <div className="bg-white p-3.5 border-t border-slate-200">
        <div className="flex items-center gap-2.5">
          <label htmlFor="chat-message" className="sr-only">Mensagem</label>
          <input
            id="chat-message"
            type="text"
            aria-label="Mensagem"
            placeholder="Digite sua mensagem..."
            value={inputText}
            disabled={isPersisting}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isPersisting && handleSendMessage()}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white disabled:opacity-60"
          />
          <button
            type="button"
            disabled={!inputText.trim() || isPersisting}
            onClick={() => handleSendMessage()}
            aria-label={isPersisting ? 'Enviando mensagem' : 'Enviar mensagem'}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

    </div>
  );
};
