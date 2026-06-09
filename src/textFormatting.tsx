export type FormatMarker = "*" | "**" | "__";

function countStarsBefore(text: string, index: number) {
  let count = 0;
  for (let position = index - 1; position >= 0 && text[position] === "*"; position -= 1) {
    count += 1;
  }
  return count;
}

function countStarsAfter(text: string, index: number) {
  let count = 0;
  for (let position = index; position < text.length && text[position] === "*"; position += 1) {
    count += 1;
  }
  return count;
}

export function isTextFormatActive(text: string, start: number, end: number, marker: FormatMarker) {
  if (start === end) {
    return false;
  }

  if (marker === "*" || marker === "**") {
    const beforeStars = countStarsBefore(text, start);
    const afterStars = countStarsAfter(text, end);

    return marker === "*"
      ? beforeStars % 2 === 1 && afterStars % 2 === 1
      : beforeStars >= 2 && afterStars >= 2;
  }

  return text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker;
}

export function toggleTextFormat(text: string, start: number, end: number, marker: FormatMarker) {
  if (isTextFormatActive(text, start, end, marker)) {
    const markerLength = marker.length;

    return {
      text: `${text.slice(0, start - markerLength)}${text.slice(start, end)}${text.slice(
        end + markerLength,
      )}`,
      start: start - markerLength,
      end: end - markerLength,
    };
  }

  return {
    text: `${text.slice(0, start)}${marker}${text.slice(start, end)}${marker}${text.slice(end)}`,
    start: start + marker.length,
    end: end + marker.length,
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
