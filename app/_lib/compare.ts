export function diffCanvases(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const aCtx = a.getContext("2d");
  const bCtx = b.getContext("2d");
  if (!aCtx || !bCtx) return null;

  const aData = aCtx.getImageData(0, 0, width, height);
  const bData = bCtx.getImageData(0, 0, width, height);
  const out = context.createImageData(width, height);

  for (let i = 0; i < out.data.length; i += 4) {
    const diff = Math.abs(aData.data[i] - bData.data[i]) +
      Math.abs(aData.data[i + 1] - bData.data[i + 1]) +
      Math.abs(aData.data[i + 2] - bData.data[i + 2]);
    if (diff > 30) {
      out.data[i] = 239;
      out.data[i + 1] = 68;
      out.data[i + 2] = 68;
      out.data[i + 3] = 200;
    } else {
      out.data[i] = aData.data[i];
      out.data[i + 1] = aData.data[i + 1];
      out.data[i + 2] = aData.data[i + 2];
      out.data[i + 3] = 255;
    }
  }

  context.putImageData(out, 0, 0);
  return canvas;
}
