// Client-only barcode reader using ZXing.
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from "@zxing/library";

function makeReader() {
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.ITF,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return reader;
}

function canvasToLuminance(canvas: HTMLCanvasElement): RGBLuminanceSource {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sem contexto 2D");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const luminances = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // luminância padrão ITU-R BT.601
    luminances[j] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
  }
  return new RGBLuminanceSource(luminances, width, height);
}

/** Rotaciona canvas em graus (0/90/180/270) e devolve novo canvas. */
function rotateCanvas(src: HTMLCanvasElement, deg: 0 | 90 | 180 | 270): HTMLCanvasElement {
  if (deg === 0) return src;
  const c = document.createElement("canvas");
  const w = src.width;
  const h = src.height;
  if (deg === 180) {
    c.width = w;
    c.height = h;
  } else {
    c.width = h;
    c.height = w;
  }
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -w / 2, -h / 2);
  return c;
}

/**
 * Tenta ler qualquer código de barras compatível em um canvas.
 * Faz múltiplas tentativas rotacionando 0°, 90°, 180°, 270°.
 * Retorna o texto do primeiro código lido (só dígitos preservados).
 */
export function decodeBarcodeFromCanvas(canvas: HTMLCanvasElement): string | null {
  const reader = makeReader();
  const angles: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
  for (const deg of angles) {
    const rotated = rotateCanvas(canvas, deg);
    try {
      const src = canvasToLuminance(rotated);
      const bitmap = new BinaryBitmap(new HybridBinarizer(src));
      const result = reader.decode(bitmap);
      const text = result.getText();
      if (text) return text;
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        // continua tentando
      }
    }
  }
  return null;
}

/** Tenta em múltiplos canvases (páginas). */
export function decodeBarcodeFromCanvases(canvases: HTMLCanvasElement[]): string | null {
  // 1º passe: canvas inteiro.
  for (const c of canvases) {
    const res = decodeBarcodeFromCanvas(c);
    if (res) return res;
  }
  // 2º passe: recorta a metade inferior (onde geralmente fica o código de
  // barras em boletos/guias) para reduzir ruído do topo da página.
  for (const c of canvases) {
    const cropped = cropBottomHalf(c);
    if (!cropped) continue;
    const res = decodeBarcodeFromCanvas(cropped);
    if (res) return res;
  }
  return null;
}

function cropBottomHalf(src: HTMLCanvasElement): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const w = src.width;
  const h = src.height;
  const cropY = Math.floor(h * 0.5);
  const cropH = h - cropY;
  if (cropH <= 0) return null;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = cropH;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, cropY, w, cropH, 0, 0, w, cropH);
  return out;
}