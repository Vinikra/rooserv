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
  Mic,
  Play,
  Pause,
  Trash2
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
  audioUrl?: string;
  audioDuration?: string;
  proposalData?: {
    totalAmount: number;
    description: string;
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
          <span>Orçamento Formal com Garantia</span>
        </span>
        <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-slate-200 font-bold">
          Custódia RooServ
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
                <span>Aceitar & Pagar</span>
              </>
            )}
          </button>
        )}

        {proposalData.isAccepted && isMe && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-extrabold bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30">
            <CheckCircle className="w-4 h-4" />
            <span>Cliente Aceitou e Pagou</span>
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
  
  // Estados de Gravação e Reprodução de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startRecording = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      }
    } catch {
      setSecurityAlert('Permissão de microfone não concedida.');
    }
  };

  const stopAndSendAudio = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const mins = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

      const audioMessage: Message = {
        id: `aud-${Date.now()}`,
        senderId: 'me',
        text: '🎙️ Mensagem de Áudio',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        audioUrl,
        audioDuration: durationStr,
      };

      setMessages((prev) => [...prev, audioMessage]);

      const channelName = `rooserv_chat_${recipientUser.id}`;
      const channel = supabase.channel(channelName);
      channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { ...audioMessage, senderId: 'other' },
      });
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

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

    const scanResult = sanitizeChatMessage(inputText);

    if (scanResult.hasSensitiveContact) {
      setSecurityAlert(
        '⚠️ Tentativa de contato externo bloqueada! Para sua segurança e garantia, números de telefone e redes sociais não podem ser enviados no chat.'
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

  const handleAcceptFormalProposal = (msgId: string, amount: number) => {
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
              src={recipientUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={recipientUser.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-brand-500 shadow-sm"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
              {recipientUser.name}
            </h3>
            <span className="text-xs text-brand-300 font-medium block">
              {recipientUser.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentRole === 'provider' && (
            <button
              type="button"
              onClick={() => setIsSendingProposal(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar Orçamento</span>
              <span className="sm:hidden">Orçar</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Garantia RooServ</span>
          </div>
        </div>
      </div>

      {/* Alerta de Segurança e Anti-Vazamento */}
      {securityAlert && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-black flex items-center justify-between gap-2 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{securityAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setSecurityAlert(null)}
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

      {/* Input de Mensagem com Botão de Áudio e Envio */}
      <div className="bg-white p-3.5 border-t border-slate-200">
        {isRecording ? (
          <div className="flex items-center justify-between gap-3 bg-red-50 p-2 rounded-2xl border border-red-200 animate-in fade-in">
            <div className="flex items-center gap-3 pl-2">
              <span className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
              <span className="text-xs sm:text-sm font-extrabold text-red-700">
                Gravando áudio... {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2.5 text-slate-500 hover:text-red-600 rounded-xl hover:bg-white transition-colors cursor-pointer"
                title="Cancelar Gravação"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={stopAndSendAudio}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Áudio</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              placeholder="Digite sua mensagem ou grave um áudio..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white"
            />

            {inputText.trim() ? (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                className="bg-brand-600 hover:bg-brand-700 text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-600 w-12 h-12 rounded-2xl flex items-center justify-center transition-all border border-slate-200 shadow-xs active:scale-95 shrink-0 cursor-pointer"
                title="Gravar Mensagem de Áudio"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
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
