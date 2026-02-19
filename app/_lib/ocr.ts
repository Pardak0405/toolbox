import type { Worker } from "tesseract.js";

let worker: Worker | null = null;
let currentLang = "eng";

export async function getOcrWorker(language = "eng") {
  if (typeof window === "undefined") return null;
  if (!worker || currentLang !== language) {
    currentLang = language;
    const tesseract = await import("tesseract.js");
    worker = await tesseract.createWorker(language);
  }
  return worker;
}

export async function runOcrOnCanvas(canvas: HTMLCanvasElement, language = "eng") {
  const ocrWorker = await getOcrWorker(language);
  if (!ocrWorker) return "";
  const { data } = await ocrWorker.recognize(canvas);
  return data.text;
}
