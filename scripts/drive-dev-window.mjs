// Drives the TaskMap development window with trusted input over the WebView2 DevTools protocol.
//
// Synthetic DOM pointer events cannot start canvas drags (pointer capture rejects untrusted
// events), so interaction checks dispatch real mouse/keyboard input through the protocol instead.
// The OS cursor is not moved and the screen is not captured, so the machine stays usable.
//
// Launch the app with the DevTools endpoint first: `npm run app:dev:devtools` (port 9333, override
// with DEVTOOLS_PORT). Installed and stable builds never expose it.
//
// Usage:
//   node scripts/drive-dev-window.mjs eval "<expression>"     result of a page expression
//   node scripts/drive-dev-window.mjs click x y [right]
//   node scripts/drive-dev-window.mjs move x y [held]          hover, or drag after a press
//   node scripts/drive-dev-window.mjs press x y | release x y  hold the left button across calls
//   node scripts/drive-dev-window.mjs drag x1 y1 x2 y2 [steps]
//   node scripts/drive-dev-window.mjs type "<text>"
//   node scripts/drive-dev-window.mjs key <Enter|Escape|Tab|Backspace|Delete|ArrowUp|...>
//   node scripts/drive-dev-window.mjs shot <file.png> [x y width height]   page pixels, zoomed 4x
//
// Coordinates are CSS pixels in the page viewport.
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.DEVTOOLS_PORT ?? 9333);
const [command, ...args] = process.argv.slice(2);

const KEYS = {
  Enter: { code: "Enter", keyCode: 13, text: "\r" },
  Escape: { code: "Escape", keyCode: 27 },
  Tab: { code: "Tab", keyCode: 9 },
  Backspace: { code: "Backspace", keyCode: 8 },
  Delete: { code: "Delete", keyCode: 46 },
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
};

let targets;
try {
  targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
} catch {
  console.error(`No DevTools endpoint on port ${PORT}. Launch with: npm run app:dev:devtools`);
  process.exit(1);
}
// The hidden session-keeper window is a page target too; drive the visible app window.
const page = targets.find(
  (target) => target.type === "page" && !target.url.includes("session-keeper"),
);
if (!page) {
  console.error(`No TaskMap window among: ${targets.map((target) => target.url).join(", ")}`);
  process.exit(1);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 1;
const pending = new Map();
socket.onmessage = (message) => {
  const data = JSON.parse(message.data);
  if (data.id && pending.has(data.id)) {
    pending.get(data.id)(data);
    pending.delete(data.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (data) =>
      data.error ? reject(new Error(data.error.message)) : resolve(data.result),
    );
    socket.send(JSON.stringify({ id, method, params }));
  });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mouse = (type, x, y, extra = {}) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", pointerType: "mouse", ...extra });

switch (command) {
  case "eval": {
    const result = await send("Runtime.evaluate", {
      expression: args[0],
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      console.error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result.result.value, null, 1));
    }
    break;
  }
  case "click": {
    const [x, y] = args.map(Number);
    const button = args[2] === "right" ? "right" : "left";
    await mouse("mouseMoved", x, y, { button: "none" });
    await mouse("mousePressed", x, y, {
      button,
      buttons: button === "right" ? 2 : 1,
      clickCount: 1,
    });
    await mouse("mouseReleased", x, y, { button, buttons: 0, clickCount: 1 });
    break;
  }
  case "move": {
    const [x, y] = args.map(Number);
    // "held" continues a press started by an earlier call.
    await mouse("mouseMoved", x, y, args[2] === "held" ? { buttons: 1 } : { button: "none" });
    break;
  }
  case "press":
  case "release": {
    const [x, y] = args.map(Number);
    await mouse(command === "press" ? "mousePressed" : "mouseReleased", x, y, {
      buttons: command === "press" ? 1 : 0,
      clickCount: 1,
    });
    break;
  }
  case "drag": {
    const [x1, y1, x2, y2, steps = 12] = args.map(Number);
    await mouse("mouseMoved", x1, y1, { button: "none" });
    await mouse("mousePressed", x1, y1, { buttons: 1, clickCount: 1 });
    // Intermediate frames let drag thresholds, hover targets and placement previews react.
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      await mouse("mouseMoved", x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, { buttons: 1 });
      await wait(16);
    }
    await wait(60);
    await mouse("mouseReleased", x2, y2, { buttons: 0, clickCount: 1 });
    break;
  }
  case "type":
    await send("Input.insertText", { text: args[0] ?? "" });
    break;
  case "key": {
    const key = args[0];
    const known = KEYS[key];
    if (!known) throw new Error(`Unknown key "${key}". Known: ${Object.keys(KEYS).join(", ")}`);
    const { code, keyCode, text } = known;
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", ...base, text });
    await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    break;
  }
  case "shot": {
    const [x, y, width, height] = args.slice(1).map(Number);
    const clip = width ? { x, y, width, height, scale: 4 } : undefined;
    const result = await send("Page.captureScreenshot", { format: "png", clip });
    writeFileSync(args[0] ?? "window.png", Buffer.from(result.data, "base64"));
    break;
  }
  default:
    console.error("Commands: eval, click, drag, type, key, shot (see the header of this script).");
    process.exitCode = 1;
}
socket.close();
