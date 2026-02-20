/// <reference lib="webworker" />
import { createWorker } from "tesseract.js";

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

let worker: OcrWorker | null = null;
let currentLanguage = "eng";

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data || {};

  if (type === "recognize") {
    try {
      const { language, dataUrl } = payload;
      if (!worker || currentLanguage !== language) {
        if (worker) await worker.terminate();
        currentLanguage = language;
        worker = await createWorker(language);
      }
      const { data } = await worker.recognize(dataUrl);
      self.postMessage({ type: "done", payload: { text: data.text || "" } });
    } catch (error) {
      self.postMessage({
        type: "error",
        payload: { message: error instanceof Error ? error.message : "OCR failed" }
      });
    }
  }

  if (type === "terminate") {
    if (worker) {
      await worker.terminate();
      worker = null;
    }
    self.postMessage({ type: "terminated" });
  }
};
