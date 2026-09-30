import { describe, expect, it } from "vitest";
import { createAmbience } from "./audio";

class FakeAudioContext {
  state: AudioContextState = "suspended";
  oscillators: Array<{
    started: number;
    stopped: number;
    stop(): void;
    start(): void;
    connect(): void;
    frequency: { value: number };
    type: OscillatorType;
  }> = [];
  gains: Array<{ gain: { value: number }; connect(): void }> = [];
  filters: Array<{
    frequency: { value: number };
    Q: { value: number };
    type: BiquadFilterType;
    connect(): void;
  }> = [];
  bufferSources: Array<{
    loop: boolean;
    starts: number;
    stops: number;
    start(): void;
    stop(): void;
    connect(): void;
    disconnect(): void;
  }> = [];
  resumeCalls = 0;
  resumeFailures = 0;
  suspendCalls = 0;
  closeCalls = 0;
  destination = {} as AudioDestinationNode;

  createOscillator() {
    const oscillator = {
      started: 0,
      stopped: 0,
      frequency: { value: 0 },
      type: "sine" as OscillatorType,
      connect() {},
      start() {
        this.started += 1;
      },
      stop() {
        this.stopped += 1;
      },
    };
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }
  createGain() {
    const gain = { gain: { value: 1 }, connect() {} };
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
  createBiquadFilter() {
    const filter = {
      frequency: { value: 0 },
      Q: { value: 0 },
      type: "lowpass" as BiquadFilterType,
      connect() {},
    };
    this.filters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }
  createBuffer() {
    return {
      getChannelData: () => new Float32Array(16),
    } as unknown as AudioBuffer;
  }
  createBufferSource() {
    const source = {
      loop: false,
      starts: 0,
      stops: 0,
      connect() {},
      disconnect() {},
      start() {
        this.starts += 1;
      },
      stop() {
        this.stops += 1;
      },
    };
    this.bufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
  async resume() {
    this.resumeCalls += 1;
    if (this.resumeFailures > 0) {
      this.resumeFailures -= 1;
      throw new Error("resume failed");
    }
    this.state = "running";
  }
  async suspend() {
    this.suspendCalls += 1;
    this.state = "suspended";
  }
  async close() {
    this.closeCalls += 1;
    this.state = "closed";
  }
}

const factory = (context: FakeAudioContext) => () =>
  context as unknown as AudioContext;

describe("optional pond ambience", () => {
  it("stays silent until enabled, then builds a restrained original soundscape", async () => {
    const context = new FakeAudioContext();
    const ambience = createAmbience(factory(context));

    expect(context.oscillators).toHaveLength(0);
    await ambience.setEnabled(true);

    expect(context.resumeCalls).toBe(1);
    expect(context.oscillators).toHaveLength(0);
    expect(context.gains.every(({ gain }) => gain.value <= 0.04)).toBe(true);
    expect(context.filters.length).toBeGreaterThan(0);
    expect(context.bufferSources).toHaveLength(2);
  });

  it("suspends and resumes the same sources, then stops and closes on dispose", async () => {
    const context = new FakeAudioContext();
    const ambience = createAmbience(factory(context));

    await ambience.setEnabled(true);
    const sources = [...context.bufferSources];
    await ambience.setEnabled(false);
    expect(context.suspendCalls).toBe(1);
    expect(context.state).toBe("suspended");

    await ambience.setEnabled(true);
    expect(context.resumeCalls).toBe(2);
    expect(context.bufferSources).toEqual(sources);
    expect(sources.every((source) => source.starts === 1)).toBe(true);

    await ambience.dispose();
    expect(sources.every((source) => source.stops === 1)).toBe(true);
    expect(context.closeCalls).toBe(1);
    expect(context.state).toBe("closed");
    await ambience.setEnabled(true);
    expect(context.resumeCalls).toBe(2);
  });

  it("coalesces rapid enable-disable-enable calls without duplicating sound sources", async () => {
    const context = new FakeAudioContext();
    const ambience = createAmbience(factory(context));

    await Promise.all([
      ambience.setEnabled(true),
      ambience.setEnabled(false),
      ambience.setEnabled(true),
    ]);

    expect(context.state).toBe("running");
    expect(context.bufferSources).toHaveLength(2);
    expect(context.bufferSources.every((source) => source.starts === 1)).toBe(
      true,
    );
    await ambience.dispose();
  });

  it("can retry after a transient resume failure without poisoning later toggles", async () => {
    const context = new FakeAudioContext();
    context.resumeFailures = 1;
    const ambience = createAmbience(factory(context));

    await expect(ambience.setEnabled(true)).rejects.toThrow("resume failed");
    await expect(ambience.setEnabled(true)).resolves.toBeUndefined();
    expect(context.state).toBe("running");
    await ambience.dispose();
  });
});
