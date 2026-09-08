// Web Audio API Ringtone & Dialing Sound Synthesizer
let audioCtx = null;
let ringtoneInterval = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play WhatsApp-style Incoming Ringtone
export function startIncomingRingtone() {
  stopCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playChord = () => {
    try {
      const now = ctx.currentTime;
      const notes = [587.33, 659.25, 880.0]; // D5, E5, A5 melodious chime
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.65);
      });
    } catch (e) {
      console.warn('Ringtone sound error:', e);
    }
  };

  playChord();
  ringtoneInterval = setInterval(playChord, 1800);
}

// Play WhatsApp-style Outgoing Dialing Tone
export function startOutgoingDialTone() {
  stopCallSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playTone = () => {
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(440, now); // 440 Hz
      osc2.frequency.setValueAtTime(480, now); // 480 Hz

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.setValueAtTime(0.08, now + 1.2);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.35);
      osc2.stop(now + 1.35);
    } catch (e) {
      console.warn('Dial tone error:', e);
    }
  };

  playTone();
  ringtoneInterval = setInterval(playTone, 3200);
}

export function stopCallSounds() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

// Short incoming message notification chime.
export function playMessageNotification() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [659.25, 783.99].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = now + index * 0.08;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(0.09, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.28);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.3);
    });
  } catch (error) {
    console.warn('Message notification sound error:', error);
  }
}

