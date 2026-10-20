// Places the Kokoro voice-over on the demo video: cuts the clips, puts each on its caption,
// ducks the beat under the voice, sets the loudness, and muxes it with the silent video.
//   node mix-voice.mjs <voice.mp3> [video-silent.mp4] [beat.wav] [out.mp4]
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import ffmpeg from "ffmpeg-static";

const [voice = "voice.mp3", video = "out/video-silent.mp4", beat = "out/beat.wav", outFile = "out/callback-demo-voiceover.mp4"] = process.argv.slice(2);
const lines = JSON.parse(readFileSync(new URL("./voiceover.json", import.meta.url), "utf8")).lines;
mkdirSync("out/vo", { recursive: true });

const ff = (args, opts = {}) => {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-y", ...args], { encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(r.stderr.split("\n").slice(-6).join("\n"));
  return r.stderr;
};
const lufs = (file) => Number(/I:\s+(-?[\d.]+) LUFS/.exec(ff(["-i", file, "-af", "ebur128=framelog=quiet", "-f", "null", "-"]))?.[1]);
const dur = (file) => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr); return +m[1] * 3600 + +m[2] * 60 + +m[3]; };

// 1. split the take at the 1.2 s gaps between lines
const total = dur(voice);
const sil = ff(["-i", voice, "-af", "silencedetect=noise=-42dB:d=0.9", "-f", "null", "-"]);
const starts = [...sil.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...sil.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const clips = [];
let prev = 0;
starts.forEach((s, i) => { clips.push([prev, s]); prev = ends[i]; });
clips.push([prev, total]);
if (clips.length !== lines.length) throw new Error(`found ${clips.length} clips in the audio, expected ${lines.length}; check the [1.2s] gaps`);

// 2. cut each clip, fit it to its slot, place it
const MAX_TEMPO = 1.18;
const placed = [];
clips.forEach(([a, b], i) => {
  const l = lines[i];
  const d = b - a + 0.1;
  const slot = l.end - l.start;
  let start = l.start, tempo = 1;
  if (d > slot) {
    start = Math.max(0.35, l.start - Math.min(0.3, d - slot));
    tempo = Math.min(MAX_TEMPO, d / (l.end - start));
  }
  const len = d / tempo;
  const over = start + len - l.end;
  const file = `out/vo/${String(i + 1).padStart(2, "0")}.wav`;
  ff(["-ss", String(Math.max(0, a - 0.04)), "-t", String(d), "-i", voice, "-af", `${tempo > 1.001 ? `atempo=${tempo.toFixed(4)},` : ""}afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, len - 0.06).toFixed(3)}:d=0.06,aresample=48000,aformat=channel_layouts=mono`, file]);
  placed.push({ file, start, len, tempo, over });
  console.log(`${String(i + 1).padStart(2, " ")}  ${start.toFixed(1).padStart(5)}s  ${len.toFixed(1)}s  tempo ${tempo.toFixed(2)}${over > 0.05 ? `  OVER SLOT by ${over.toFixed(2)}s` : ""}`);
});

// 3. voice track
const videoLen = dur(video);
const inputs = placed.flatMap((p) => ["-i", p.file]);
const delays = placed.map((p, i) => `[${i}:a]adelay=${Math.round(p.start * 1000)}:all=1[v${i}]`).join(";");
ff([...inputs, "-filter_complex", `${delays};${placed.map((_, i) => `[v${i}]`).join("")}amix=inputs=${placed.length}:normalize=0,apad=whole_dur=${videoLen.toFixed(2)},atrim=0:${videoLen.toFixed(2)}[o]`, "-map", "[o]", "-ar", "48000", "out/voice-track.wav"]);
const vGain = -16 - lufs("out/voice-track.wav");
const bGain = -22 - lufs(beat);
console.log(`voice gain ${vGain.toFixed(1)} dB, music bed ${bGain.toFixed(1)} dB`);

// 4. mix: beat ducked under the voice, then one fixed gain to -16 LUFS overall
ff(["-i", beat, "-i", "out/voice-track.wav", "-filter_complex",
  `[0:a]volume=${bGain.toFixed(2)}dB,aresample=48000,aformat=channel_layouts=stereo[m];` +
  `[1:a]volume=${vGain.toFixed(2)}dB,asplit=2[vs][vk];[vs]pan=stereo|c0=c0|c1=c0[vst];` +
  `[m][vk]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=550:makeup=1[md];` +
  `[md][vst]amix=inputs=2:normalize=0,atrim=0:${videoLen.toFixed(2)},alimiter=limit=0.89:level=false[o]`,
  "-map", "[o]", "-ar", "48000", "out/mix.wav"]);
const g = -16 - lufs("out/mix.wav");
ff(["-i", video, "-i", "out/mix.wav", "-filter_complex", `[1:a]volume=${g.toFixed(2)}dB,alimiter=limit=0.89:level=false,aformat=sample_fmts=fltp:channel_layouts=stereo[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outFile]);
console.log(`wrote ${outFile} (${videoLen.toFixed(1)}s, mix ${(-16).toFixed(0)} LUFS)`);
