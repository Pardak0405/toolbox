import { FILE_LIMITS } from "@/config/security";

let ocrWorker: Worker | null = null;

function getBrowserOcrWorker() {
  if (typeof window === "undefined") return null;
  if (!ocrWorker) {
    ocrWorker = new Worker(new URL("../../lib/workers/ocr.worker.ts", import.meta.url), {
      type: "module"
    });
  }
  return ocrWorker;
}

function waitForWorkerResult(
  worker: Worker,
  signal?: AbortSignal,
  timeoutMs = FILE_LIMITS.ocrTimeoutMsPerPage
) {
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("OCR timeout exceeded."));
    }, timeoutMs);

    const onAbort = () => {
      clearTimeout(timeout);
      worker.terminate();
      ocrWorker = null;
      reject(new DOMException("OCR aborted", "AbortError"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const onMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === "done") {
        cleanup();
        resolve(String(payload?.text || ""));
      }
      if (type === "error") {
        cleanup();
        reject(new Error(String(payload?.message || "OCR failed")));
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error("OCR worker crashed."));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runOcrOnCanvas(
  canvas: HTMLCanvasElement,
  language = "eng",
  options?: { signal?: AbortSignal; timeoutMs?: number }
) {
  const worker = getBrowserOcrWorker();
  if (!worker) return "";
  const dataUrl = canvas.toDataURL("image/png");
  worker.postMessage({ type: "recognize", payload: { language, dataUrl } });
  return waitForWorkerResult(worker, options?.signal, options?.timeoutMs);
}
