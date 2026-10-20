#!/usr/bin/env node
// Captures the Devpost gallery and the link-preview image.
//
//   npm run build && npx next start -p 3111 &     # the app must be running
//   node scripts/capture-media.mjs                # writes docs/media/*.png and src/app/opengraph-image.png
//
// Uses headless Chrome over the DevTools protocol. Set CHROME=/path/to/chrome if it isn't the macOS default.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP = process.env.APP_URL ?? "http://localhost:3111/";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = fileURLToPath(new URL("../docs/media/", import.meta.url));
const OG = fileURLToPath(new URL("../src/app/opengraph-image.png", import.meta.url));
const MEDIA = new URL("./media/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = fileURLToPath(new URL("../.cache/chrome-profile", import.meta.url));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9444", "--hide-scrollbars", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
process.on("exit", () => chrome.kill());

let targets;
for (let i = 0; i < 60; i++) { try { targets = await (await fetch("http://127.0.0.1:9444/json")).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const shot = async (path) => { writeFileSync(path, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64")); console.log("wrote", path.replace(process.cwd() + "/", "")); };
const rect = (sel, text) => js(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
const click = async (p) => { for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", clickCount: 1 }); };
const clickText = async (sel, text) => { const p = await rect(sel, text); if (!p) throw new Error(`not found: ${sel} "${text}"`); await click(p); };
const setSelect = (i, v) => js(`(() => { const s=document.querySelectorAll('select')[${i}]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
const view = (w, h, dpr) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
const open = async (url) => { await send("Page.navigate", { url }); await sleep(url.startsWith("file:") ? 3500 : 5500); };
const light = () => send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

await light();

// ---- app screens: 1200x800 at 1.5x = 1800x1200 (3:2)
await view(1200, 800, 1.5);
await open(APP);
await shot(OUT + "01-underlines.png");

// 02 popover: why a reference dies, with city bars and swaps
await js("window.scrollTo(0, 400)"); await sleep(300);
await clickText(".cb-mark", "Tom Brady"); await sleep(6000);
await shot(OUT + "02-why.png");
await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");

// 03 same set, different city
await open(APP);
await setSelect(1, "Boston"); await sleep(5000);
await shot(OUT + "03-boston.png");

// 04 Fix my set
await open(APP);
await clickText("button", "Fix my set");
for (let i = 0; i < 60; i++) { const t = await js("document.querySelector('[aria-label=\"Fix my set\"] header')?.innerText || ''"); if (t && !t.includes("Fixing")) break; await sleep(1000); }
await js("window.scrollTo(0, 330)"); await sleep(500);
await shot(OUT + "04-fix-my-set.png");

// 05 Tour mode
await open(APP);
await clickText("button", "Tour"); await sleep(3000);
await clickText("[aria-label='Tour stops'] button", "Denver"); await sleep(4500);
await js("window.scrollTo(0, 380)"); await sleep(400);
await shot(OUT + "05-tour.png");

// 06 the Qloo receipt
await open(APP);
await js("document.querySelector('details summary').click()"); await sleep(400);
await js("window.scrollTo(0, 420)"); await sleep(400);
await shot(OUT + "06-qloo-receipt.png");

// ---- composed images from scripts/media/*.html
await open(new URL("how-it-works.html", MEDIA).href);
await shot(OUT + "07-how-it-uses-qloo.png");
await open(new URL("mcp.html", MEDIA).href);
await shot(OUT + "08-mcp.png");

// ---- link preview, 1200x630 at 1x
await view(1200, 630, 1);
await open(new URL("og.html", MEDIA).href);
await shot(OG);
await js("0");
chrome.kill();
process.exit(0);
