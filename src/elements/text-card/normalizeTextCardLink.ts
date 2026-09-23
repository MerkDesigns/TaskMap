// Retained link-entry policy. Normalization does not open a URL/path or grant workflow execution.
export function normalizeTextCardLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || /^\\\\[^\\]/.test(trimmed)) return trimmed;
  if (/^file:/i.test(trimmed)) {
    try {
      return decodeURIComponent(new URL(trimmed).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
    } catch {
      return null;
    }
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
