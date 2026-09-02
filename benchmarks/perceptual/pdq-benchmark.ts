import { createRequire } from "node:module";
import { PNG } from "pngjs";

const require = createRequire(import.meta.url);
const { PDQ } = require("pdq-wasm") as typeof import("pdq-wasm");
const ready = PDQ.init();

export type PdqBenchmarkHash = { hash: string; quality: number };
export type BenchmarkPixels = {
  data: Uint8Array;
  width: number;
  height: number;
};

export async function decodeBenchmarkImage(
  path: string,
): Promise<BenchmarkPixels> {
  Bun.Image.backend = "bun";
  const encoded = await Bun.file(path).image().png().buffer();
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

export async function hashPdqPixels(
  pixels: BenchmarkPixels,
): Promise<PdqBenchmarkHash> {
  await ready;
  const result = PDQ.hash({
    ...pixels,
    channels: 3,
  });
  return { hash: PDQ.toHex(result.hash), quality: result.quality };
}

export async function hashPdqImage(path: string): Promise<PdqBenchmarkHash> {
  return hashPdqPixels(await decodeBenchmarkImage(path));
}

export function centerCrop(
  pixels: BenchmarkPixels,
  percent: number,
): BenchmarkPixels {
  const insetX = Math.floor((pixels.width * percent) / 200);
  const insetY = Math.floor((pixels.height * percent) / 200);
  const width = pixels.width - insetX * 2;
  const height = pixels.height - insetY * 2;
  const data = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row += 1) {
    const start = ((row + insetY) * pixels.width + insetX) * 3;
    data.set(pixels.data.subarray(start, start + width * 3), row * width * 3);
  }
  return { data, width, height };
}

export async function pdqDistance(
  left: string,
  right: string,
): Promise<number> {
  await ready;
  return PDQ.hammingDistance(PDQ.fromHex(left), PDQ.fromHex(right));
}
