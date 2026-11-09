// Listening to the TB-3's USB audio for the LIVE waveform (docs/tb3-live-waveform-design.md): find the
// input, open it with the browser's processing off, and read the samples that arrived since the last
// read. Nothing is played: the graph ends in a silent gain node so it runs.

const FFT_SIZE = 32768; // the most each read can return: about 0.3 s at 96 kHz

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
  stop(): void;
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

// The chosen input by name, else the first with "TB-3" in its name.
export function pickInput(inputs: AudioInput[], chosen: string | null): AudioInput | undefined {
  return inputs.find((d) => d.name === chosen) ?? inputs.find((d) => /TB-3/i.test(d.name));
}

const RAW = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

function channelReader(ctx: AudioContext, analyser: AnalyserNode) {
  const buf = new Float32Array(FFT_SIZE);
  let last = ctx.currentTime;
  return () => {
    const now = ctx.currentTime;
    const n = Math.min(FFT_SIZE, Math.round((now - last) * ctx.sampleRate));
    last = now;
    analyser.getFloatTimeDomainData(buf);
    return buf.slice(FFT_SIZE - n);
  };
}

function mixOf(left: Float32Array, right: Float32Array) {
  const mix = new Float32Array(left.length);
  for (let i = 0; i < mix.length; i++) mix[i] = (left[i]! + (right[i] ?? left[i]!)) / 2;
  return mix;
}

function analysers(ctx: AudioContext, stream: MediaStream) {
  const source = ctx.createMediaStreamSource(stream);
  const stereo = (stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1) > 1;
  const split = ctx.createChannelSplitter(2);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  source.connect(split);
  const pair = [0, stereo ? 1 : 0].map((ch) => {
    const a = ctx.createAnalyser();
    a.fftSize = FFT_SIZE;
    split.connect(a, ch);
    a.connect(silent);
    return a;
  });
  silent.connect(ctx.destination);
  return pair as [AnalyserNode, AnalyserNode];
}

export async function listen(input: AudioInput): Promise<Listening> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: input.id }, channelCount: { ideal: 2 }, ...RAW },
  });
  const ctx = new AudioContext();
  await ctx.resume(); // made after an await, away from the click: it may start suspended
  const [l, r] = analysers(ctx, stream);
  const readL = channelReader(ctx, l);
  const readR = channelReader(ctx, r);
  return {
    name: input.name,
    sampleRate: ctx.sampleRate,
    read: () => {
      const left = readL();
      const right = readR();
      return { left, right, mix: mixOf(left, right), now: ctx.currentTime };
    },
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
