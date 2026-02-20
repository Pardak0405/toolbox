import { z } from "zod";
import { FILE_LIMITS } from "@/config/security";
import { sanitizeText } from "@/lib/sanitize";

export function validateFileTypeSize(
  file: File,
  allowedTypes: string[],
  maxBytes = FILE_LIMITS.defaultHardBytes
) {
  if (file.size > maxBytes) {
    return { ok: false, reason: `File too large: ${Math.ceil(file.size / 1024 / 1024)}MB` };
  }

  if (allowedTypes.length > 0) {
    const ext = file.name.toLowerCase().split(".").pop() || "";
    const set = new Set(allowedTypes.map((type) => type.toLowerCase()));
    const mime = String(file.type || "").toLowerCase();
    const isImageLike =
      set.has("image") ||
      set.has("jpg") ||
      set.has("jpeg") ||
      set.has("png");
    const extAllowed =
      set.has(ext) ||
      (isImageLike && (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(ext)));
    if (!extAllowed) {
      return { ok: false, reason: `Unsupported file type: .${ext || "unknown"}` };
    }
  }

  return { ok: true as const };
}

export async function estimatePdfPages(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  return doc.numPages;
}

export function validateToolOptionsWithZod<T extends z.ZodTypeAny>(schema: T, raw: unknown) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.issues.map((i) => i.message) };
  }
  return { ok: true as const, data: parsed.data };
}

export const workflowQuerySchema = z.object({
  name: z
    .string()
    .max(80)
    .transform((v) => sanitizeText(v, 80))
    .optional(),
  steps: z.array(z.string().regex(/^[a-z0-9-]{2,60}$/)).max(20)
});
