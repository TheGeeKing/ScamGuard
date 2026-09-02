import { createRequire } from "node:module";
import { PNG } from "pngjs";

const require = createRequire(import.meta.url);
const { PDQ } = require("pdq-wasm") as typeof import("pdq-wasm");
const ready = PDQ.init();

export const PERCEPTUAL_VERSION = "pdq-crops-segments-v2";

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
  widthScale: number,
  positionX: number,
  positionY: number,
  heightScale = widthScale,
): Pixels {
  const width = Math.max(1, Math.round(pixels.width * widthScale));
  const height = Math.max(1, Math.round(pixels.height * heightScale));
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

function differenceHash(pixels: Pixels): string {
  let value = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const luma = (sampleX: number) => {
        const px = Math.min(
          pixels.width - 1,
          Math.floor((sampleX * pixels.width) / 9),
        );
        const py = Math.min(
          pixels.height - 1,
          Math.floor((y * pixels.height) / 8),
        );
        const index = (py * pixels.width + px) * 3;
        return (
          0.299 * (pixels.data[index] ?? 0) +
          0.587 * (pixels.data[index + 1] ?? 0) +
          0.114 * (pixels.data[index + 2] ?? 0)
        );
      };
      value = (value << 1n) | (luma(x) > luma(x + 1) ? 1n : 0n);
    }
  }
  return value.toString(16).padStart(16, "0");
}

function segmentHashes(pixels: Pixels): string[] {
  const size = Math.min(300, pixels.width, pixels.height);
  const gray = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(
        pixels.width - 1,
        Math.floor((x * pixels.width) / size),
      );
      const sourceY = Math.min(
        pixels.height - 1,
        Math.floor((y * pixels.height) / size),
      );
      const index = (sourceY * pixels.width + sourceX) * 3;
      gray[y * size + x] = Math.round(
        0.299 * (pixels.data[index] ?? 0) +
          0.587 * (pixels.data[index + 1] ?? 0) +
          0.114 * (pixels.data[index + 2] ?? 0),
      );
    }
  }

  const integral = new Uint32Array((size + 1) * (size + 1));
  for (let y = 0; y < size; y += 1) {
    let row = 0;
    for (let x = 0; x < size; x += 1) {
      row += gray[y * size + x] ?? 0;
      integral[(y + 1) * (size + 1) + x + 1] =
        (integral[y * (size + 1) + x + 1] ?? 0) + row;
    }
  }
  const bright = new Uint8Array(gray.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = Math.max(0, x - 4);
      const right = Math.min(size - 1, x + 4);
      const top = Math.max(0, y - 4);
      const bottom = Math.min(size - 1, y + 4);
      const stride = size + 1;
      const sum =
        (integral[(bottom + 1) * stride + right + 1] ?? 0) -
        (integral[top * stride + right + 1] ?? 0) -
        (integral[(bottom + 1) * stride + left] ?? 0) +
        (integral[top * stride + left] ?? 0);
      bright[y * size + x] =
        sum / ((right - left + 1) * (bottom - top + 1)) > 128 ? 1 : 0;
    }
  }

  const visited = new Uint8Array(bright.length);
  const regions: Array<{
    count: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }> = [];
  for (let start = 0; start < bright.length; start += 1) {
    if (visited[start]) continue;
    const kind = bright[start];
    const pending = [start];
    visited[start] = 1;
    let count = 0;
    let minX = size;
    let minY = size;
    let maxX = 0;
    let maxY = 0;
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) break;
      const x = current % size;
      const y = Math.floor(current / size);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const next of [
        current - size,
        current + size,
        current - 1,
        current + 1,
      ]) {
        if (next < 0 || next >= bright.length || visited[next]) continue;
        const nextX = next % size;
        const nextY = Math.floor(next / size);
        if (
          Math.abs(nextX - x) + Math.abs(nextY - y) !== 1 ||
          bright[next] !== kind
        )
          continue;
        visited[next] = 1;
        pending.push(next);
      }
    }
    if (count > 500) regions.push({ count, minX, minY, maxX, maxY });
  }

  return regions
    .sort((left, right) => right.count - left.count)
    .slice(0, 20)
    .map((region) => {
      const widthFraction = (region.maxX + 1 - region.minX) / size;
      const heightFraction = (region.maxY + 1 - region.minY) / size;
      const x =
        region.minX / Math.max(1, size - (region.maxX + 1 - region.minX));
      const y =
        region.minY / Math.max(1, size - (region.maxY + 1 - region.minY));
      return `d:${differenceHash(crop(pixels, widthFraction, x, y, heightFraction))}`;
    });
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
    crops: [...new Set([...crops, ...segmentHashes(pixels)])],
  };
}

export async function perceptualDistance(
  left: string,
  right: string,
): Promise<number> {
  if (left.startsWith("d:") || right.startsWith("d:")) {
    if (!left.startsWith("d:") || !right.startsWith("d:")) return 256;
    let bits = BigInt(`0x${left.slice(2)}`) ^ BigInt(`0x${right.slice(2)}`);
    let distance = 0;
    while (bits > 0n) {
      distance += Number(bits & 1n);
      bits >>= 1n;
    }
    return distance * 2;
  }
  await ready;
  return PDQ.hammingDistance(PDQ.fromHex(left), PDQ.fromHex(right));
}
