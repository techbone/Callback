// Assembles cards + app recording + beat into out/callback-demo.mp4
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import ffmpeg from "ffmpeg-static";

const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const BG = "0xf5f3ee", FADE = 0.45, FPS = 30;
const enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS)];
const fades = (d) => `fade=t=in:st=0:d=${FADE}:color=${BG},fade=t=out:st=${(d - FADE).toFixed(2)}:d=${FADE}:color=${BG}`;

function card(png, seconds, out) {
  // a slow 2.5% push-in keeps a still card alive
  const z = `1+0.025*t/${seconds}`;
  run(["-loop", "1", "-framerate", String(FPS), "-t", String(seconds), "-i", png,
    "-vf", `scale=w='trunc(1920*(${z})/2)*2':h='trunc(1080*(${z})/2)*2':eval=frame:flags=lanczos,crop=1920:1080,${fades(seconds)},format=yuv420p`,
    ...enc, out]);
  return seconds;
}

// app recording: variable-rate screencast frames -> constant 30 fps
const idx = JSON.parse(readFileSync("frames/index.json", "utf8"));
const lines = [];
idx.frames.forEach((f, i) => {
  const next = i + 1 < idx.frames.length ? idx.frames[i + 1].t : idx.duration;
  lines.push(`file '${f.file.replace("frames/", "")}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
});
lines.push(`file '${idx.frames.at(-1).file.replace("frames/", "")}'`);
writeFileSync("frames/list.txt", lines.join("\n"));
const appDur = idx.duration;
run(["-f", "concat", "-safe", "0", "-i", "frames/list.txt", "-vf", `fps=${FPS},scale=1920:1080:flags=lanczos,${fades(appDur)},format=yuv420p`, ...enc, "out/seg-app.mp4"]);

const segs = [
  ["out/seg-title.mp4", card("out/card-title.png", 4.2, "out/seg-title.mp4")],
  ["out/seg-problem.mp4", card("out/card-problem.png", 5.2, "out/seg-problem.mp4")],
  ["out/seg-app.mp4", appDur],
  ["out/seg-how.mp4", card("out/card-07-how-it-uses-qloo.png", 7.5, "out/seg-how.mp4")],
  ["out/seg-mcp.mp4", card("out/card-08-mcp.png", 6.0, "out/seg-mcp.mp4")],
  ["out/seg-mcp-live.mp4", card("out/card-mcp-live.png", 7.0, "out/seg-mcp-live.mp4")],
  ["out/seg-end.mp4", card("out/card-end.png", 6.0, "out/seg-end.mp4")],
];
// re-order: the title and problem cards were built first above; keep the declared order
writeFileSync("out/segments.txt", segs.map(([f]) => `file '${f.replace("out/", "")}'`).join("\n"));
run(["-f", "concat", "-safe", "0", "-i", "out/segments.txt", "-c", "copy", "out/video-silent.mp4"]);

const total = segs.reduce((a, [, d]) => a + d, 0);
execFileSync("node", ["beat.mjs", String((total + 0.3).toFixed(2)), "out/beat.wav"], { stdio: "inherit" });
run(["-i", "out/video-silent.mp4", "-i", "out/beat.wav",
  "-filter_complex", "[1:a]aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a]",
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "out/callback-demo.mp4"]);
console.log(`done: ${total.toFixed(1)}s -> out/callback-demo.mp4`);
