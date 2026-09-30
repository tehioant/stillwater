export interface Ambience {
  setEnabled(enabled: boolean): Promise<void>;
  dispose(): Promise<void>;
}

export type AudioContextFactory = () => AudioContext;

/** Creates an original, low-level filtered-noise pond ambience. It is silent until enabled. */
export function createAmbience(
  createContext: AudioContextFactory = () => new AudioContext(),
): Ambience {
  let context: AudioContext | undefined;
  let sources: AudioBufferSourceNode[] = [];
  let bellTimer: ReturnType<typeof setInterval> | undefined;
  let enabled = false;
  let disposed = false;
  let queue: Promise<void> = Promise.resolve();

  const buildSoundscape = (audio: AudioContext) => {
    const sampleRate = audio.sampleRate;
    const buffer = audio.createBuffer(1, sampleRate * 3, sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      const envelope =
        0.55 + 0.45 * Math.sin((i / sampleRate) * Math.PI * 0.18);
      samples[i] = (Math.random() * 2 - 1) * envelope;
    }

    const makeLayer = (cutoff: number, level: number, resonance: number) => {
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = resonance;
      gain.gain.value = level;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      source.start();
      sources.push(source);
    };

    makeLayer(420, 0.018, 0.45);
    makeLayer(1250, 0.009, 0.7);
  };

  const playBell = () => {
    if (!context || !enabled || disposed || context.state !== "running") return;
    const audio = context;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.0025, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 2.5);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  };

  const applyLatestState = async () => {
    if (disposed) return;
    if (!enabled) {
      if (context?.state === "running") await context.suspend();
      return;
    }
    if (!context) {
      context = createContext();
      buildSoundscape(context);
      bellTimer = setInterval(playBell, 28_000);
    }
    if (context.state !== "running") await context.resume();
    if (!enabled && context.state === "running") await context.suspend();
  };

  const enqueue = () => {
    queue = queue.catch(() => undefined).then(applyLatestState);
    return queue;
  };

  return {
    setEnabled(value) {
      if (disposed) return Promise.resolve();
      enabled = value;
      return enqueue();
    },
    async dispose() {
      if (disposed) return queue;
      disposed = true;
      enabled = false;
      if (bellTimer !== undefined) clearInterval(bellTimer);
      bellTimer = undefined;
      queue = queue
        .catch(() => undefined)
        .then(async () => {
          for (const source of sources) {
            try {
              source.stop();
            } catch {
              /* already stopped */
            }
            source.disconnect();
          }
          sources = [];
          if (context && context.state !== "closed") await context.close();
          context = undefined;
        });
      return queue;
    },
  };
}
