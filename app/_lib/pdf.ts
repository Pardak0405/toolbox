import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { renderPdfPageToCanvas } from "@/app/_lib/pdfjs";

function bytesToBlob(bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

export async function mergePdf(files: File[]) {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const pdfBytes = await merged.save();
  return bytesToBlob(pdfBytes, "application/pdf");
}

export async function splitPdf(file: File) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const outputs: Blob[] = [];
  for (const pageIndex of doc.getPageIndices()) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(doc, [pageIndex]);
    out.addPage(page);
    outputs.push(bytesToBlob(await out.save(), "application/pdf"));
  }
  return outputs;
}

export async function removePages(file: File, removeIndices: number[]) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const kept = doc
    .getPageIndices()
    .filter((index) => !removeIndices.includes(index));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(doc, kept);
  pages.forEach((page) => out.addPage(page));
  return bytesToBlob(await out.save(), "application/pdf");
}

export async function extractPages(file: File, extractIndices: number[]) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(doc, extractIndices);
  pages.forEach((page) => out.addPage(page));
  return bytesToBlob(await out.save(), "application/pdf");
}

export async function rotatePdf(file: File, angle: number) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  doc.getPages().forEach((page) => page.setRotation(degrees(angle)));
  return bytesToBlob(await doc.save(), "application/pdf");
}

export async function addPageNumbers(file: File, startAt = 1) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((page, index) => {
    const { width } = page.getSize();
    page.drawText(String(startAt + index), {
      x: width - 50,
      y: 24,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2)
    });
  });
  return bytesToBlob(await doc.save(), "application/pdf");
}

export async function addWatermark(file: File, text: string) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 5,
      y: height / 2,
      size: 40,
      font,
      color: rgb(0.9, 0.2, 0.2),
      rotate: degrees(20)
    });
  });
  return bytesToBlob(await doc.save(), "application/pdf");
}

export async function cropPdf(file: File, margin = 24) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.setCropBox(margin, margin, width - margin * 2, height - margin * 2);
  });
  return bytesToBlob(await doc.save(), "application/pdf");
}

export async function imagesToPdf(files: File[]) {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const ext = file.name.toLowerCase();
    const image = ext.endsWith(".png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return bytesToBlob(await doc.save(), "application/pdf");
}

export async function pdfToImages(file: File, format: "png" | "jpeg" = "png") {
  const outputs: Blob[] = [];
  let index = 0;
  while (true) {
    const canvas = await renderPdfPageToCanvas(file, index);
    if (!canvas) break;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, `image/${format}`)
    );
    if (!blob) break;
    outputs.push(blob);
    index += 1;
  }
  return outputs;
}

export async function redactPdf(file: File, keyword: string) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: width * 0.1,
      y: height * 0.6,
      width: width * 0.8,
      height: 30,
      color: rgb(0, 0, 0)
    });
    page.drawText(`Redacted: ${keyword}`, {
      x: width * 0.1,
      y: height * 0.6 + 8,
      size: 10,
      font,
      color: rgb(1, 1, 1)
    });
  });
  return bytesToBlob(await doc.save(), "application/pdf");
}

export async function annotatePdf(file: File, note: string) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: width * 0.08,
      y: height * 0.1,
      width: width * 0.84,
      height: 60,
      color: rgb(1, 0.95, 0.85)
    });
    page.drawText(note, {
      x: width * 0.1,
      y: height * 0.12 + 20,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2)
    });
  });
  return bytesToBlob(await doc.save(), "application/pdf");
}
