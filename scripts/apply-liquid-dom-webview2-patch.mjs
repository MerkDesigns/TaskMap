import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const COMPATIBILITY_MARKER = "/* taskmap-liquid-dom-webview2-copy-signature:v1 */";
const TARGETS = [
  "node_modules/@liquid-dom/core/dist/index.js",
  "node_modules/@liquid-dom/core/dist/index.cjs",
];

const COPY_CALLS = [
  {
    label: "scene HTML texture copy",
    texture: "entry.texture",
  },
  {
    label: "glass HTML texture copy",
    texture: "entry.sourceTexture",
  },
];

function replaceCopyCall(source, { label, texture }, includeMarker) {
  const original = `this.device.queue.copyElementImageToTexture(
          entry.html.host,
          entry.deviceWidth,
          entry.deviceHeight,
          { texture: ${texture} }
        );`;
  const copy = `this.device.queue.copyElementImageToTexture(
          { source: entry.html.host },
          {
            destination: { texture: ${texture} },
            width: entry.deviceWidth,
            height: entry.deviceHeight
          }
        );`;
  const replacement = `${includeMarker ? `${COMPATIBILITY_MARKER}\n        ` : ""}${copy}`;
  const first = source.indexOf(original);
  if (first >= 0) {
    if (source.indexOf(original, first + original.length) >= 0) {
      throw new Error(`Found multiple ${label} calls; @liquid-dom/core may have changed.`);
    }
    return source.slice(0, first) + replacement + source.slice(first + original.length);
  }

  const patched = source.indexOf(copy);
  if (patched < 0 || source.indexOf(copy, patched + copy.length) >= 0) {
    throw new Error(`Could not find one unambiguous ${label}; @liquid-dom/core may have changed.`);
  }
  if (!includeMarker) return source;
  return source.slice(0, patched) + `${COMPATIBILITY_MARKER}\n        ` + source.slice(patched);
}

for (const target of TARGETS) {
  const path = resolve(target);
  let source = await readFile(path, "utf8");
  if (source.includes(COMPATIBILITY_MARKER)) {
    console.log(`Liquid DOM WebView2 patch already applied: ${target}`);
    continue;
  }

  source = COPY_CALLS.reduce(
    (current, copyCall, index) => replaceCopyCall(current, copyCall, index === 0),
    source,
  );
  await writeFile(path, source, "utf8");
  console.log(`Applied Liquid DOM WebView2 patch: ${target}`);
}
