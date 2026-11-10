// Drives headless Chrome over CDP (no dependencies) to measure the /buy page
// in screen and print media, and to count printed PDF pages.
//
//   node scripts/print-audit.mjs <url> [out.pdf] [viewportWidth]
//
// Set CHROME_PATH if Chrome is not at the default Windows location. This is a
// regression check for the print layout: two PayPal checkout forms used to
// turn /buy into a six page printout.
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const URL_TO_TEST = process.argv[2] ?? "https://learntk.vercel.app/buy";
const OUT_PDF = process.argv[3] ?? null;
const VIEWPORT_WIDTH = Number(process.argv[4] ?? 0);

const profile = fs.mkdtempSync("C:\\Users\\c85-lau\\AppData\\Local\\Temp\\cdp-");
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  ...(VIEWPORT_WIDTH > 0 ? [`--window-size=${VIEWPORT_WIDTH},900`] : []),
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  const events = new Map();

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    const waiters = events.get(msg.method);
    if (waiters?.length) {
      const waiter = waiters.shift();
      waiter(msg.params);
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", (e) => reject(new Error("ws error")));
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const once = (method) =>
    new Promise((resolve) => {
      if (!events.has(method)) events.set(method, []);
      events.get(method).push(resolve);
    });

  return { ws, ready, send, once };
}

const MEASURE = `(() => {
  const out = { printMedia: matchMedia('print').matches, innerWidth: window.innerWidth, docHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  const describe = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 60) : null,
      height: Math.round(r.height),
      width: Math.round(r.width),
      display: cs.display,
      position: cs.position,
      overflow: cs.overflow,
    };
  };
  out.cards = [...document.querySelectorAll('.course-card')].map(describe);
  out.buys = [...document.querySelectorAll('.course-buy')].map(describe);
  out.slots = [...document.querySelectorAll('.paypal-slot')].map(describe);
  out.forms = [...document.querySelectorAll('[id^=paypal-form-fields-container-][id$=-wrapper]')].map(describe);
  out.printNotes = [...document.querySelectorAll('.print-note')].map(describe);
  out.iframes = [...document.querySelectorAll('iframe')].map(describe);
  out.tallest = [...document.querySelectorAll('body *')]
    .map((el) => ({ el, h: el.getBoundingClientRect().height }))
    .sort((a, b) => b.h - a.h)
    .slice(0, 8)
    .map(({ el, h }) => ({ h: Math.round(h), tag: el.tagName.toLowerCase(), id: el.id || null, cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : null }));
  return JSON.stringify(out, null, 2);
})()`;

try {
  const workDir = fs.mkdtempSync("C:\\Users\\c85-lau\\AppData\\Local\\Temp\\cdp-");
  void workDir;
  const version = await waitForDebugger();
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = targets.find((t) => t.type === "page");
  if (!target) throw new Error("no page target");
  void version;

  const { ready, send, once, ws } = connect(target.webSocketDebuggerUrl);
  await ready;

  await send("Page.enable");
  await send("Runtime.enable");
  if (VIEWPORT_WIDTH > 0) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: 900,
      deviceScaleFactor: 1,
      mobile: VIEWPORT_WIDTH < 600,
    });
  }
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: URL_TO_TEST });
  await loaded;
  await sleep(8000); // let PayPal inject its form

  if (VIEWPORT_WIDTH > 0) {
    try {
      await send("Emulation.setDeviceMetricsOverride", {
        width: VIEWPORT_WIDTH,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
    } catch (error) {
      console.log("viewport override failed:", error.message);
    }
    await sleep(1000);
  }

  const screen = await send("Runtime.evaluate", { expression: MEASURE, returnByValue: true });
  console.log("=== SCREEN ===");
  console.log(screen.result.value);

  await send("Emulation.setEmulatedMedia", { media: "print" });
  await sleep(500);
  const print = await send("Runtime.evaluate", { expression: MEASURE, returnByValue: true });
  console.log("=== PRINT ===");
  console.log(print.result.value);

  if (OUT_PDF) {
    const pdf = await send("Page.printToPDF", {
      printBackground: false,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });
    const bytes = Buffer.from(pdf.data, "base64");
    fs.writeFileSync(OUT_PDF, bytes);
    const latin = bytes.toString("latin1");
    const count = (latin.match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`=== PDF === bytes=${bytes.length} pages=${count}`);
  }

  ws.close();
} finally {
  chrome.kill();
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true });
}
