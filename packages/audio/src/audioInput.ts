// Listening to a device's USB audio (docs/tb3-live-waveform-design.md, docs/sp404-design.md): find the input,
// open it with the browser's processing off, and read the samples that arrived since the last read. Nothing is
// played: the graph ends in a silent gain node so it runs.

const TIME_SIZE = 32768; // the most each read can return: about 0.3 s at 96 kHz

export interface AudioInput {
  id: string;
  name: string;
}

// The newest samples per channel, mixed for the waveform.
export interface Frame {
  left: Float32Array;
  right: Float32Array;
  mix: Float32Array;
  now: number; // seconds, on the audio clock
}

export interface Listening {
  name: string;
  sampleRate: number;
  read(): Frame;
  // The spectrum of L + R in dB per bin (fftSize / 2 bins), when opened with `spectrumSize`.
  spectrum?(into: Float32Array): void;
  // The same for the spectrogram, unsmoothed, when opened with `spectrogramSize`.
  spectrogram?(into: Float32Array): void;
  stop(): void;
}

export interface ListenOptions {
  spectrumSize?: number; // FFT size for `spectrum`, a power of two (32 to 32768)
  spectrumSmoothing?: number; // the analyser's smoothingTimeConstant, 0 to 1
  spectrogramSize?: number; // FFT size for `spectrogram`: smaller than the spectrum's, for sharper timing
}

const isAudioInput = (d: MediaDeviceInfo) => d.kind === "audioinput" && d.deviceId !== "default";
const toInput = (d: MediaDeviceInfo): AudioInput => ({ id: d.deviceId, name: d.label });

export async function listAudioInputs(): Promise<AudioInput[]> {
  return (await navigator.mediaDevices.enumerateDevices()).filter(isAudioInput).map(toInput);
}

// Names only show once the page may use audio input: ask with a brief open of the default input.
export async function listAudioInputsWithNames(): Promise<AudioInput[]> {
  const first = await listAudioInputs();
  if (first.some((d) => d.name)) return first;
  const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
  probe.getTracks().forEach((t) => t.stop());
  return listAudioInputs();
}

// The chosen input by name, else the first whose name matches `device`.
export function pickInputFor(inputs: AudioInput[], chosen: string | null, device: RegExp): AudioInput | undefined {
  return inputs.find((d) => d.name === chosen) ?? inputs.find((d) => device.test(d.name));
}

// Why an input couldn't be opened, in words for the panel.
export function explainAudioError(e: unknown, app: string): string {
  if (e instanceof DOMException && e.name === "NotAllowedError")
    return `Audio input not allowed: allow ${app} in the system's microphone settings`;
  return e instanceof Error ? e.message : String(e);
}

const RAW = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

function channelReader(ctx: AudioContext, analyser: AnalyserNode) {
  const buf = new Float32Array(TIME_SIZE);
  let last = ctx.currentTime;
  return () => {
    const now = ctx.currentTime;
    const n = Math.min(TIME_SIZE, Math.round((now - last) * ctx.sampleRate));
    last = now;
    analyser.getFloatTimeDomainData(buf);
    return buf.slice(TIME_SIZE - n);
  };
}

function mixOf(left: Float32Array, right: Float32Array) {
  const mix = new Float32Array(left.length);
  for (let i = 0; i < mix.length; i++) mix[i] = (left[i]! + (right[i] ?? left[i]!)) / 2;
  return mix;
}

interface Graph {
  pair: [AnalyserNode, AnalyserNode];
  spectrum?: AnalyserNode;
  spectrogram?: AnalyserNode;
}

interface Ends {
  source: AudioNode;
  silent: AudioNode;
}

// A mono analyser of L + R for frequency reads, when a size is asked for.
function fftAnalyser(ctx: AudioContext, { source, silent }: Ends, fft: { size?: number; smoothing: number }) {
  if (!fft.size) return undefined;
  const a = ctx.createAnalyser();
  a.fftSize = fft.size;
  a.smoothingTimeConstant = fft.smoothing;
  a.channelCount = 1;
  a.channelCountMode = "explicit"; // L and R are mixed down
  source.connect(a);
  a.connect(silent);
  return a;
}

const reader = (a: AnalyserNode | undefined) =>
  a && ((into: Float32Array) => a.getFloatFrequencyData(into as Float32Array<ArrayBuffer>));

function buildGraph(ctx: AudioContext, stream: MediaStream, opts: ListenOptions): Graph {
  const source = ctx.createMediaStreamSource(stream);
  const stereo = (stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1) > 1;
  const split = ctx.createChannelSplitter(2);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  source.connect(split);
  const pair = [0, stereo ? 1 : 0].map((ch) => {
    const a = ctx.createAnalyser();
    a.fftSize = TIME_SIZE;
    split.connect(a, ch);
    a.connect(silent);
    return a;
  }) as [AnalyserNode, AnalyserNode];
  const ends = { source, silent };
  const spectrum = fftAnalyser(ctx, ends, { size: opts.spectrumSize, smoothing: opts.spectrumSmoothing ?? 0.5 });
  const spectrogram = fftAnalyser(ctx, ends, { size: opts.spectrogramSize, smoothing: 0 });
  silent.connect(ctx.destination);
  return { pair, spectrum, spectrogram };
}

export async function listen(input: AudioInput, opts: ListenOptions = {}): Promise<Listening> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: input.id }, channelCount: { ideal: 2 }, ...RAW },
  });
  const ctx = new AudioContext();
  await ctx.resume(); // made after an await, away from the click: it may start suspended
  const { pair, spectrum, spectrogram } = buildGraph(ctx, stream, opts);
  const readL = channelReader(ctx, pair[0]);
  const readR = channelReader(ctx, pair[1]);
  return {
    name: input.name,
    sampleRate: ctx.sampleRate,
    read: () => {
      const left = readL();
      const right = readR();
      return { left, right, mix: mixOf(left, right), now: ctx.currentTime };
    },
    spectrum: reader(spectrum),
    spectrogram: reader(spectrogram),
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
