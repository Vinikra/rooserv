// Gerador de Som de Notificação In-App nativo via Web Audio API (Estilo Uber / iFood)
// Não depende de arquivos MP3 externos e funciona 100% offline com zero latência.

class NotificationSoundService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Toca o chime característico de notificação in-app (Dois tons harmônicos)
  public playChime(type: 'order' | 'message' | 'payment' | 'system' | 'proposal' = 'system') {
    // 1. Feedback Háptico (Vibração no celular)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        if (type === 'payment' || type === 'order') {
          navigator.vibrate([100, 50, 150]);
        } else {
          navigator.vibrate([80, 40, 80]);
        }
      } catch {
        // Ignora caso permissão não concedida
      }
    }

    // 2. Síntese de Áudio Web Audio API
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Frequências para cada tipo de aviso
      let freq1 = 587.33; // D5
      let freq2 = 880.00; // A5

      if (type === 'payment') {
        freq1 = 523.25; // C5
        freq2 = 1046.50; // C6
      } else if (type === 'order') {
        freq1 = 659.25; // E5
        freq2 = 987.77; // B5
      } else if (type === 'message') {
        freq1 = 440.00; // A4
        freq2 = 659.25; // E5
      }

      // Primeiro Tom
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Segundo Tom (Mais agudo, com leve delay de 80ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq2, now + 0.08);
      gain2.gain.setValueAtTime(0.15, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.28);
    } catch {
      // Falha silenciosa caso o navegador restrinja áudio antes do primeiro clique
    }
  }
}

export const inAppSound = new NotificationSoundService();
