// Renders cards/*.html to 1920x1080 PNGs.
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";
const { chrome, send } = await launch(9556, new URL("./.profile-cards", import.meta.url).pathname);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
for (const name of ["title", "problem", "mcp-live", "end"]) {
  await send("Page.navigate", { url: new URL(`./cards/${name}.html`, import.meta.url).href });
  await sleep(3000);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`out/card-${name}.png`, Buffer.from(shot.result.data, "base64"));
  console.log("card", name);
}
chrome.kill();
process.exit(0);
