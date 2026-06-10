export type FormatMarker = "*" | "**" | "__";

function isMarkerChar(char: string | undefined) {
  return char === "*" || char === "_";
}

// The run of contiguous formatting-marker characters that directly wrap the selection.
// Markers separated from the selection by any non-marker character are not part of its wrap.
function wrappingRuns(text: string, start: number, end: number) {
  let before = start;
  while (before > 0 && isMarkerChar(text[before - 1])) {
    before -= 1;
  }

  let after = end;
  while (after < text.length && isMarkerChar(text[after])) {
    after += 1;
  }

  return {
    before: text.slice(before, start),
    after: text.slice(end, after),
    beforeIndex: before,
    afterIndex: after,
  };
}

function countMarkers(run: string) {
  let stars = 0;
  let underscores = 0;
  for (const char of run) {
    if (char === "*") {
      stars += 1;
    } else if (char === "_") {
      underscores += 1;
    }
  }
  return { stars, underscores };
}

// Active formats are those whose markers wrap BOTH sides of the selection, regardless of
// nesting order (e.g. bold stays detected even when underline sits between it and the text).
function activeFormats(before: string, after: string) {
  const b = countMarkers(before);
  const a = countMarkers(after);
  return {
    bold: b.stars >= 2 && a.stars >= 2,
    italic: b.stars % 2 === 1 && a.stars % 2 === 1,
    underline: b.underscores >= 2 && a.underscores >= 2,
  };
}

export function isTextFormatActive(text: string, start: number, end: number, marker: FormatMarker) {
  if (start === end) {
    return false;
  }

  const { before, after } = wrappingRuns(text, start, end);
  const formats = activeFormats(before, after);

  return marker === "**" ? formats.bold : marker === "*" ? formats.italic : formats.underline;
}

export function toggleTextFormat(text: string, start: number, end: number, marker: FormatMarker) {
  if (start === end) {
    return { text, start, end };
  }

  const { before, after, beforeIndex, afterIndex } = wrappingRuns(text, start, end);
  const formats = activeFormats(before, after);

  if (marker === "**") {
    formats.bold = !formats.bold;
  } else if (marker === "*") {
    formats.italic = !formats.italic;
  } else {
    formats.underline = !formats.underline;
  }

  // Rebuild the wrap canonically: stars carry bold/italic (`***` = both), underscores carry underline.
  const stars = "*".repeat((formats.bold ? 2 : 0) + (formats.italic ? 1 : 0));
  const underscores = formats.underline ? "__" : "";
  const open = `${stars}${underscores}`;
  const close = `${underscores}${stars}`;
  const inner = text.slice(start, end);
  const nextStart = beforeIndex + open.length;

  return {
    text: `${text.slice(0, beforeIndex)}${open}${inner}${close}${text.slice(afterIndex)}`,
    start: nextStart,
    end: nextStart + inner.length,
  };
}

export function renderFormattedText(text: string) {
  const segments: Array<{ text: string; bold: boolean; italic: boolean; underline: boolean }> = [];
  let bold = false;
  let italic = false;
  let underline = false;
  let buffer = "";

  const flush = () => {
    if (!buffer) {
      return;
    }

    segments.push({ text: buffer, bold, italic, underline });
    buffer = "";
  };

  for (let index = 0; index < text.length; ) {
    if (text.startsWith("__", index)) {
      flush();
      underline = !underline;
      index += 2;
      continue;
    }

    if (text.startsWith("***", index)) {
      flush();
      bold = !bold;
      italic = !italic;
      index += 3;
      continue;
    }

    if (text.startsWith("**", index)) {
      flush();
      bold = !bold;
      index += 2;
      continue;
    }

    if (text[index] === "*") {
      flush();
      italic = !italic;
      index += 1;
      continue;
    }

    buffer += text[index];
    index += 1;
  }

  flush();

  return segments.map((segment, index) => {
    let content = <span>{segment.text}</span>;

    if (segment.underline) {
      content = <u>{content}</u>;
    }

    if (segment.italic) {
      content = <em>{content}</em>;
    }

    if (segment.bold) {
      content = <strong>{content}</strong>;
    }

    return <span key={index}>{content}</span>;
  });
}
