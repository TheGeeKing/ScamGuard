import { createRequire } from "node:module";
import { PNG } from "pngjs";

const require = createRequire(import.meta.url);
const { PDQ } = require("pdq-wasm") as typeof import("pdq-wasm");
const ready = PDQ.init();

export const PERCEPTUAL_VERSION = "pdq-crops-v1";

export type PerceptualHash = {
  version: typeof PERCEPTUAL_VERSION;
  pdq: string;
  quality: number;
  crops: string[];
};

type Pixels = { data: Uint8Array; width: number; height: number };
const scales = [1, 0.95, 0.9, 0.8] as const;
const positions = [0, 0.5, 1] as const;

async function decode(bytes: ArrayBuffer): Promise<Pixels> {
  Bun.Image.backend = "bun";
  const encoded = await new Bun.Image(bytes, { maxPixels: 40_000_000 })
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .png()
    .buffer();
  const image = PNG.sync.read(encoded);
  const rgb = new Uint8Array(image.width * image.height * 3);
  for (let source = 0, target = 0; source < image.data.length; source += 4) {
    const alpha = image.data[source + 3] ?? 255;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = image.data[source + channel] ?? 0;
      rgb[target++] = Math.round((value * alpha + 255 * (255 - alpha)) / 255);
    }
  }
  return { data: rgb, width: image.width, height: image.height };
}

function crop(
  pixels: Pixels,
  scale: number,
  positionX: number,
  positionY: number,
): Pixels {
  const width = Math.max(1, Math.round(pixels.width * scale));
  const height = Math.max(1, Math.round(pixels.height * scale));
  const left = Math.round((pixels.width - width) * positionX);
  const top = Math.round((pixels.height - height) * positionY);
  const data = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row += 1) {
    const start = ((row + top) * pixels.width + left) * 3;
    data.set(pixels.data.subarray(start, start + width * 3), row * width * 3);
  }
  return { data, width, height };
}

function hash(pixels: Pixels): { hash: string; quality: number } {
  const result = PDQ.hash({ ...pixels, channels: 3 });
  return { hash: PDQ.toHex(result.hash), quality: result.quality };
}

export async function hashImageBytes(
  bytes: ArrayBuffer,
): Promise<PerceptualHash> {
  await ready;
  const pixels = await decode(bytes);
  const whole = hash(pixels);
  const crops: string[] = [];
  for (const scale of scales) {
    const offsets = scale === 1 ? ([0] as const) : positions;
    for (const y of offsets) {
      for (const x of offsets) crops.push(hash(crop(pixels, scale, x, y)).hash);
    }
  }
  return {
    version: PERCEPTUAL_VERSION,
    pdq: whole.hash,
    quality: whole.quality,
    crops: [...new Set(crops)],
  };
}

export async function perceptualDistance(
  left: string,
  right: string,
): Promise<number> {
  await ready;
  return PDQ.hammingDistance(PDQ.fromHex(left), PDQ.fromHex(right));
}
