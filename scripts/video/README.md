# Demo video

Everything in the demo video is generated from code: the screen recording, the captions, the cards and the music. Nothing is filmed or licensed.

```bash
cd scripts/video
npm i --no-save ffmpeg-static@5.3.0     # a self-contained ffmpeg, not added to the app's dependencies
# with the app running on :3111 (npm run build && npx next start -p 3111)
node record.mjs http://localhost:3111/  # scripted cursor + captions, recorded with Chrome's screencast
node cards.mjs                          # title, problem, MCP and end cards -> out/*.png
cp ../../docs/media/07-how-it-uses-qloo.png ../../docs/media/08-mcp.png out/   # then pad to 16:9 (see build.mjs input names)
node build.mjs                          # cards + recording + an original synthesized beat -> out/callback-demo.mp4
```

- `beat.mjs` synthesizes the lo-fi beat sample by sample (drums, bass, electric-piano chords, vinyl hiss). It's original audio, so there's nothing to clear for copyright.
- Output: 1920×1080, 30 fps, H.264 + AAC, about −16 LUFS.
