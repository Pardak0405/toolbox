let pdfjs: typeof import("pdfjs-dist") | null = null;

export async function initPdfJs() {
  if (typeof window === "undefined") return null;
  if (!pdfjs) {
    const lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    pdfjs = lib;
  }
  return pdfjs;
}

export async function renderPdfThumbnails(file: File, limit = 8) {
  const lib = await initPdfJs();
  if (!lib) return [];
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const total = Math.min(pdf.numPages, limit);
  const urls: string[] = [];

  for (let pageIndex = 1; pageIndex <= total; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 0.3 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    urls.push(canvas.toDataURL("image/png"));
  }

  return urls;
}

export async function renderPdfPageToCanvas(file: File, pageIndex: number) {
  const lib = await initPdfJs();
  if (!lib) return null;
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  if (pageIndex >= pdf.numPages) return null;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

export async function extractPdfText(file: File) {
  const lib = await initPdfJs();
  if (!lib) return "";
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  let output = "";
  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    output += `${pageText}\n`;
  }
  return output.trim();
}
