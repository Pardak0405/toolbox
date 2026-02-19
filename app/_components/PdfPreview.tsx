"use client";

import { useEffect, useState } from "react";
import { initPdfJs, renderPdfThumbnails } from "@/app/_lib/pdfjs";

export default function PdfPreview({
  file
}: {
  file: File | null;
}) {
  const [thumbs, setThumbs] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!file) {
        setThumbs([]);
        return;
      }
      await initPdfJs();
      const urls = await renderPdfThumbnails(file, 8);
      if (mounted) setThumbs(urls);
    }
    run();
    return () => {
      mounted = false;
    };
  }, [file]);

  if (!file) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">
        Upload a PDF to preview pages.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-semibold">Preview</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {thumbs.map((src, index) => (
          <div key={src} className="rounded-lg border border-line bg-fog p-2">
            <img src={src} alt={`Page ${index + 1}`} className="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
