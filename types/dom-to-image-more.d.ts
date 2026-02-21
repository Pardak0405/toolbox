declare module "dom-to-image-more" {
  type DomToImageOptions = {
    cacheBust?: boolean;
    width?: number;
    height?: number;
    style?: Record<string, string>;
  };

  export function toPng(node: HTMLElement, options?: DomToImageOptions): Promise<string>;
  const defaultExport: {
    toPng: typeof toPng;
  };
  export default defaultExport;
}
