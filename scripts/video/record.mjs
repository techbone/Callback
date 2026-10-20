// Records the live app with a scripted cursor and captions.
//   node record.mjs <app-url>      -> frames/*.jpg + frames/index.json
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const APP = process.argv[2] ?? "http://localhost:3111/";
rmSync("frames", { recursive: true, force: true });
mkdirSync("frames");
const { chrome, send, js, on } = await launch(9555, new URL("./.profile-rec", import.meta.url).pathname);

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Page.enable");
await send("Page.navigate", { url: APP });
await sleep(7000);

// ---- overlay: a cursor, click ripples, and captions
await js(`(() => {
  const st = document.createElement("style");
  st.textContent = \`
    #demo-cursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:99999;pointer-events:none;transform:translate(760px,470px);transition:transform 750ms cubic-bezier(.45,0,.2,1);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
    .demo-ripple{position:fixed;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:rgba(27,26,23,.2);z-index:99998;pointer-events:none;animation:demo-r 500ms ease-out forwards}
    @keyframes demo-r{from{transform:scale(.25);opacity:1}to{transform:scale(1.5);opacity:0}}
    #demo-cap{position:fixed;left:50%;bottom:26px;transform:translate(-50%,10px);max-width:900px;background:#1b1a17;color:#f5f3ee;font:500 19px/1.45 var(--font-sans),Inter,system-ui,sans-serif;letter-spacing:-.005em;padding:12px 22px;border-radius:12px;z-index:99997;opacity:0;transition:opacity 380ms ease,transform 380ms ease;text-align:center;box-shadow:0 10px 34px rgba(0,0,0,.2)}
    #demo-cap.on{opacity:1;transform:translate(-50%,0)}
    html{scroll-behavior:smooth}\`;
  document.head.appendChild(st);
  const c = document.createElement("div");
  c.id = "demo-cursor";
  c.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 2.5l15.5 9.2-6.9 1.5 3.9 7.3-2.6 1.4-3.9-7.3-5.9 4.6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  const cap = document.createElement("div");
  cap.id = "demo-cap";
  document.body.appendChild(cap);
})()`);

const pos = { x: 760, y: 470 };
async function move(x, y, ms = 750) {
  await js(`(() => { const c = document.getElementById("demo-cursor"); c.style.transitionDuration = "${ms}ms"; c.style.transform = "translate(${x}px, ${y}px)"; })()`);
  pos.x = x; pos.y = y;
  await sleep(ms + 60);
}
async function ripple() {
  await js(`(() => { const r = document.createElement("div"); r.className = "demo-ripple"; r.style.left = "${pos.x}px"; r.style.top = "${pos.y}px"; document.body.appendChild(r); setTimeout(() => r.remove(), 600); })()`);
}
async function click(x, y, opts = {}) {
  await move(x, y, opts.ms ?? 750);
  await ripple();
  if (opts.real !== false) for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  await sleep(250);
}
async function caption(text, hold = 0) {
  await js(`(() => { const c = document.getElementById("demo-cap"); c.classList.remove("on"); })()`);
  await sleep(text ? 320 : 0);
  if (text) await js(`(() => { const c = document.getElementById("demo-cap"); c.textContent = ${JSON.stringify(text)}; c.classList.add("on"); })()`);
  if (hold) await sleep(hold);
}
const rect = (sel, text, which = 0) =>
  js(`(() => { const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>${text === undefined ? "true" : `e.textContent.trim()===${JSON.stringify(text)}`}); const el=els[${which}]; if(!el) return null; const r=el.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),top:r.top,bottom:r.bottom,left:r.left}; })()`);
async function scrollTo(y, wait = 900) { await js(`window.scrollTo(0, ${y})`); await sleep(wait); }
async function scrollToEl(sel, text, offset = 140) {
  await js(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>${text === undefined ? "true" : `e.textContent.trim()===${JSON.stringify(text)}`}); if(el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - ${offset}); })()`);
  await sleep(950);
}
const setSelect = (i, v) => js(`(() => { const s=document.querySelectorAll('select')[${i}]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
async function waitFor(expr, timeout = 40000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await js(expr)) return true; await sleep(300); } return false; }

// ---- screencast
const frames = [];
on("Page.screencastFrame", (p) => {
  const file = `frames/f${String(frames.length).padStart(5, "0")}.jpg`;
  writeFileSync(file, Buffer.from(p.data, "base64"));
  frames.push({ file, ts: p.metadata.timestamp });
  send("Page.screencastFrameAck", { sessionId: p.sessionId });
});
await send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const t0 = Date.now() / 1000;
await sleep(700);

// 1. the set, underlined
await caption("Paste what you're about to say. Pick the room.");
let r = await rect("select", undefined, 1);
await move(r.x, r.y, 900);
await sleep(1900);
await caption("Every reference is checked against Qloo's taste data.");
for (const name of ["Waffle House", "Outkast", "Tom Brady", "P-Valley"]) { r = await rect(".cb-mark", name); if (r) await move(r.x, r.y + 2, 650); await sleep(350); }
await sleep(600);
await caption("Green lands here. Yellow: known, no heat. Red dies here.");
r = await rect(".cb-mark", "Dies here");
if (r) await move(r.x, r.y, 800);
await sleep(2600);

// 2. same set, another city
await caption("Same set, in Boston. It nearly flips.");
r = await rect("select", undefined, 1);
await click(r.x, r.y, { real: false });
await setSelect(1, "Boston");
await sleep(1500);
for (const name of ["Dunkin'", "Waffle House", "Tom Brady"]) { r = await rect(".cb-mark", name); if (r) await move(r.x, r.y + 2, 600); await sleep(300); }
await sleep(1600);
r = await rect("select", undefined, 1);
await click(r.x, r.y, { real: false });
await setSelect(1, "Atlanta");
await caption("Back in Atlanta, why does Tom Brady die?");
await sleep(2200);

// 3. why: the popover
await scrollTo(250);
r = await rect(".cb-mark", "Tom Brady");
await click(r.x, r.y);
await caption("Click any reference: its rank across 8 cities, from Qloo.");
await waitFor(`!!document.querySelector('.absolute.z-20 li button')`, 15000);
r = await rect(".absolute.z-20 ol li", undefined, 0);
if (r) await move(r.x + 40, r.y, 700);
r = await rect(".absolute.z-20 ol li", undefined, 3);
if (r) await move(r.x + 40, r.y, 900);
await sleep(1800);
await caption("And swaps Atlanta actually loves, with the Qloo tags they share.");
r = await rect(".absolute.z-20 li button", undefined, 0);
if (r) await move(r.x + 60, r.y, 800);
r = await rect(".absolute.z-20 li button", undefined, 1);
if (r) await move(r.x + 60, r.y, 700);
await sleep(2600);
await click(1240, 140, { ms: 650 }); // click away to close
await caption("");

// 4. Fix my set
await scrollTo(0, 900);
r = await rect("button", "Fix my set");
await caption("Fix my set: an agent swaps everything that dies…");
await move(r.x, r.y, 800);
await sleep(700);
await click(r.x, r.y, { ms: 300 });
await sleep(2200);
await scrollToEl('[aria-label="Fix my set"]', undefined, 230);
await caption("…picks the swap that fits the joke, rewrites that line, and re-checks.");
await waitFor(`(document.querySelector('[aria-label="Fix my set"] header')?.innerText || '').includes('Fixed')`, 40000);
await sleep(800);
r = await rect('[aria-label="Fix my set"] li', undefined, 1);
if (r) await move(r.left + 320, r.y, 800);
await caption("A quarterback for “a guy who throws.” Every step explained.");
await sleep(3400);
r = await rect("button", "Undo");
if (r) { await caption("And every change can be undone."); await click(r.x, r.y); await sleep(1800); }

// 5. Tour mode
await scrollTo(0, 900);
await caption("On tour? One set, every city.");
r = await rect("button", "Tour");
await click(r.x, r.y);
await sleep(2200);
r = await rect("[aria-label='Tour stops'] button", "Denver");
await click(r.x, r.y);
await sleep(2500);
await scrollToEl("table", undefined, 120);
await caption("Keep what lands everywhere. Swap the rest, city by city.");
r = await rect("tbody tr", undefined, 1);
if (r) await move(r.left + 900, r.y, 900);
await sleep(3600);

// 6. receipt
await scrollToEl("details", undefined, 260);
r = await rect("details summary");
await caption("Every verdict is a Qloo call. Here's the receipt.");
await click(r.x, r.y);
await sleep(4200);
await caption("");
await sleep(900);

await send("Page.stopScreencast");
const t1 = Date.now() / 1000;
const first = frames[0].ts;
writeFileSync("frames/index.json", JSON.stringify({ frames: frames.map((f) => ({ file: f.file, t: f.ts - first })), duration: frames.at(-1).ts - first + 0.8, wall: t1 - t0 }, null, 1));
console.log(`recorded ${frames.length} frames over ${(t1 - t0).toFixed(1)}s`);
chrome.kill();
process.exit(0);
