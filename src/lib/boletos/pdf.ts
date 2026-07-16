// Client-only PDF helpers using pdfjs-dist.
// Only import this from client-side code (event handlers, effects).

import type * as PdfjsLib from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfjsLib> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - worker as URL
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export interface PdfPageRender {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  text: string;
}

/**
 * Renderiza todas as páginas do PDF em canvases de alta resolução e extrai texto selecionável.
 * Retorna array de páginas com canvas + texto (texto pode ser string vazia se digitalizado).
 */
export async function renderPdf(
  data: ArrayBuffer,
  scale: number = 2,
): Promise<{ pages: PdfPageRender[]; fullText: string }> {
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const pages: PdfPageRender[] = [];
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, viewport, canvas } as any).promise;
    let text = "";
    try {
      const content = await page.getTextContent();
      text = content.items.map((it) => ("str" in it ? (it as { str: string }).str : "")).join(" ");
    } catch {
      text = "";
    }
    pages.push({ pageNumber: i, canvas, text });
    fullText += (fullText ? "\n" : "") + text;
  }
  return { pages, fullText };
}

/** Converte um arquivo (PDF/imagem) em ArrayBuffer. */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/** Converte imagem File em HTMLCanvasElement em alta resolução. */
export async function imageFileToCanvas(file: File, maxDim = 2400): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio * 2); // upscale x2
    const h = Math.round(img.height * ratio * 2);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível criar canvas.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

/** Converte canvas em base64 PNG (para envio à IA quando o PDF é digitalizado). */
export function canvasToBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1];
}