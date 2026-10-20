// Original lo-fi beat, synthesized sample by sample. No samples or loops from anywhere.
//   node beat.mjs <seconds> <out.wav>
import { writeFileSync } from "node:fs";

const SECONDS = Number(process.argv[2] ?? 130);
const OUT = process.argv[3] ?? "beat.wav";
const SR = 44100;
const N = Math.ceil(SECONDS * SR);
const L = new Float32Array(N), R = new Float32Array(N);

let seed = 7;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

const BPM = 84, BEAT = 60 / BPM, BAR = 4 * BEAT, SWING = 0.58;
const CHORDS = [
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 40, notes: [52, 55, 59, 62] }, // Em7
  { root: 38, notes: [50, 53, 57, 60] }, // Dm7
  { root: 36, notes: [48, 52, 55, 59] }, // Cmaj7
];
const bars = Math.ceil(SECONDS / BAR);
const INTRO = 2; // bars of keys only before the drums come in

const add = (buf, i, v) => { if (i >= 0 && i < N) buf[i] += v; };
const kickEnv = new Float32Array(N); // for ducking the keys

function kick(t0, amp) {
  let ph = 0;
  for (let i = 0; i < 0.45 * SR; i++) {
    const t = i / SR, f = 46 + 75 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 7.5) * amp, n = Math.floor(t0 * SR) + i;
    add(L, n, v); add(R, n, v);
    if (n < N) kickEnv[n] = Math.max(kickEnv[n], Math.exp(-t * 6) * amp);
  }
}
function snare(t0, amp) {
  let prev = 0;
  for (let i = 0; i < 0.3 * SR; i++) {
    const t = i / SR, x = rand() * 2 - 1, hp = x - prev; prev = x;
    const v = (hp * 0.55 * Math.exp(-t * 20) + Math.sin(2 * Math.PI * 185 * t) * 0.35 * Math.exp(-t * 32)) * amp;
    const n = Math.floor(t0 * SR) + i;
    add(L, n, v * 0.95); add(R, n, v);
    // a short room tail
    add(L, n + Math.floor(0.031 * SR), v * 0.18); add(R, n + Math.floor(0.043 * SR), v * 0.18);
  }
}
function hat(t0, amp) {
  let prev = 0;
  for (let i = 0; i < 0.06 * SR; i++) {
    const t = i / SR, x = rand() * 2 - 1, hp = x - prev; prev = x;
    const v = hp * Math.exp(-t * 85) * amp, n = Math.floor(t0 * SR) + i;
    add(L, n, v * 0.7); add(R, n, v);
  }
}
function key(t0, dur, m, amp, detune) {
  const f = midi(m);
  let lp = 0, lpR = 0;
  for (let i = 0; i < (dur + 0.6) * SR; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.012) * (0.45 + 0.55 * Math.exp(-t * 1.4)) * (t > dur ? Math.exp(-(t - dur) * 7) : 1);
    const trem = 1 + 0.06 * Math.sin(2 * Math.PI * 4.2 * t);
    const tone = (x) => Math.sin(x) + 0.28 * Math.sin(2 * x) + 0.08 * Math.sin(3 * x);
    const vl = tone(2 * Math.PI * f * (1 - detune) * t) * env * trem * amp;
    const vr = tone(2 * Math.PI * f * (1 + detune) * t) * env * trem * amp;
    lp += 0.18 * (vl - lp); lpR += 0.18 * (vr - lpR); // gentle low-pass for warmth
    const n = Math.floor(t0 * SR) + i;
    add(L, n, lp); add(R, n, lpR);
  }
}
function bass(t0, dur, m, amp) {
  const f = midi(m);
  for (let i = 0; i < (dur + 0.15) * SR; i++) {
    const t = i / SR, env = Math.min(1, t / 0.008) * (t > dur ? Math.exp(-(t - dur) * 25) : Math.exp(-t * 0.9));
    const v = (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(4 * Math.PI * f * t)) * env * amp, n = Math.floor(t0 * SR) + i;
    add(L, n, v); add(R, n, v);
  }
}

const keysL = new Float32Array(N), keysR = new Float32Array(N);
for (let b = 0; b < bars; b++) {
  const t = b * BAR, c = CHORDS[b % 4];
  // keys go to their own bus so the kick can duck them
  const [sl, sr] = [L.slice(), R.slice()];
  L.fill(0); R.fill(0);
  c.notes.forEach((m, j) => key(t + j * 0.012, BEAT * 2.6, m, 0.14, 0.0009));
  c.notes.slice(1).forEach((m, j) => key(t + BEAT * 2.5 + j * 0.01, BEAT * 1.2, m + 12 * (j === 2 ? 1 : 0), 0.07, 0.0011));
  for (let i = 0; i < N; i++) { keysL[i] += L[i]; keysR[i] += R[i]; }
  L.set(sl); R.set(sr);

  if (b >= INTRO) {
    bass(t, BEAT * 1.4, c.root, 0.32);
    bass(t + BEAT * 2.5, BEAT * 0.9, c.root, 0.24);
    bass(t + BEAT * 3.5, BEAT * 0.45, c.root + 7, 0.18);
    kick(t, 0.7); kick(t + BEAT * 2, 0.58);
    if (b % 2 === 1) kick(t + BEAT * 2.75, 0.4);
    snare(t + BEAT, 0.42); snare(t + BEAT * 3, 0.45);
    for (let e = 0; e < 8; e++) {
      const off = e % 2 === 0 ? 0 : SWING;
      hat(t + BEAT * (Math.floor(e / 2) + off), (e % 2 === 0 ? 0.16 : 0.1) * (0.8 + 0.4 * rand()));
    }
  }
}

// vinyl: low hiss and sparse crackle
let hiss = 0;
for (let i = 0; i < N; i++) {
  hiss += 0.05 * ((rand() * 2 - 1) - hiss);
  let v = hiss * 0.02;
  if (rand() < 0.00012) v += (rand() * 2 - 1) * 0.12;
  L[i] += v; R[i] += v * 0.9;
}

// mix: duck keys under the kick, saturate softly, normalise, fade
let peak = 0;
const out = new Float32Array(N * 2);
for (let i = 0; i < N; i++) {
  const duck = 1 - 0.35 * kickEnv[i];
  const l = Math.tanh((L[i] + keysL[i] * duck) * 1.3), r = Math.tanh((R[i] + keysR[i] * duck) * 1.3);
  out[2 * i] = l; out[2 * i + 1] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const fadeIn = 1.5 * SR, fadeOut = 3.5 * SR;
for (let i = 0; i < N; i++) {
  const g = (0.89 / peak) * Math.min(1, i / fadeIn) * Math.min(1, (N - i) / fadeOut);
  out[2 * i] *= g; out[2 * i + 1] *= g;
}

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N * 2; i++) data.writeInt16LE(Math.max(-1, Math.min(1, out[i])) * 32767, i * 2);
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40);
writeFileSync(OUT, Buffer.concat([header, data]));
console.log(`wrote ${OUT}: ${SECONDS}s, ${bars} bars at ${BPM} bpm`);
