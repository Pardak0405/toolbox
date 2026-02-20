const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const PATH_CHARS = /[\\/]/g;
const DOT_DOT = /\.\./g;
const SAFE_FILENAME = /[^a-zA-Z0-9._ -]/g;

export function sanitizeText(value: unknown, maxLength = 500) {
  const input = String(value ?? "")
    .normalize("NFKC")
    .replace(CONTROL_CHARS, "")
    .trim();
  return input.slice(0, maxLength);
}

export function sanitizeFilename(name: unknown, forcedExt?: string) {
  const input = sanitizeText(name, 180)
    .replace(PATH_CHARS, "_")
    .replace(DOT_DOT, "_")
    .replace(SAFE_FILENAME, "_")
    .replace(/\s+/g, " ")
    .trim();

  const fallback = input || "download";
  if (!forcedExt) return fallback;

  const ext = forcedExt.startsWith(".") ? forcedExt : `.${forcedExt}`;
  const withoutExt = fallback.replace(/\.[a-zA-Z0-9]+$/, "");
  return `${withoutExt}${ext}`;
}
