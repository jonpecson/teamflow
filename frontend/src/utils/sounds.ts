let ctx: AudioContext | null = null;
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

async function resume(): Promise<AudioContext> {
  const c = getCtx();
  if (c.state === 'suspended') await c.resume();
  return c;
}

export const SoundEngine = {
  async playRingtone() {
    this.stopRingtone();
    const playOnce = async () => {
      const c = await resume();
      const osc1 = c.createOscillator();
      const gain1 = c.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 523;
      gain1.gain.setValueAtTime(0.3, c.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.4);
      osc1.connect(gain1).connect(c.destination);
      osc1.start(c.currentTime);
      osc1.stop(c.currentTime + 0.4);

      const osc2 = c.createOscillator();
      const gain2 = c.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 659;
      gain2.gain.setValueAtTime(0.3, c.currentTime + 0.5);
      gain2.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.9);
      osc2.connect(gain2).connect(c.destination);
      osc2.start(c.currentTime + 0.5);
      osc2.stop(c.currentTime + 0.9);
    };
    playOnce();
    ringtoneInterval = setInterval(playOnce, 2000);
  },

  stopRingtone() {
    if (ringtoneInterval) {
      clearInterval(ringtoneInterval);
      ringtoneInterval = null;
    }
  },

  async playTone(freq: number, duration: number, volume = 0.2) {
    const c = await resume();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  },

  async playConnected() {
    const c = await resume();
    [440, 554, 659].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, c.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + i * 0.12 + 0.3);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime + i * 0.12);
      osc.stop(c.currentTime + i * 0.12 + 0.3);
    });
  },

  async playDisconnected() {
    const c = await resume();
    [554, 440, 330].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, c.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + i * 0.15 + 0.3);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime + i * 0.15);
      osc.stop(c.currentTime + i * 0.15 + 0.3);
    });
  },

  async playJoin() {
    await this.playTone(880, 0.15, 0.1);
  },

  async playLeave() {
    await this.playTone(440, 0.2, 0.1);
  },

  async playMessage() {
    await this.playTone(600, 0.08, 0.06);
  },
};
