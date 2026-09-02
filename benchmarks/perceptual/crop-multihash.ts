import {
  type BenchmarkPixels,
  hashPdqPixels,
  pdqDistance,
} from "./pdq-benchmark";

export type CropMultihash = string[];

const SCALES = [1, 0.95, 0.9, 0.8] as const;
const POSITIONS = [0, 0.5, 1] as const;

function cropPixels(
  pixels: BenchmarkPixels,
  scale: number,
  positionX: number,
  positionY: number,
): BenchmarkPixels {
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

export async function cropMultihash(
  pixels: BenchmarkPixels,
): Promise<CropMultihash> {
  const hashes: string[] = [];
  for (const scale of SCALES) {
    const positions = scale === 1 ? ([0] as const) : POSITIONS;
    for (const positionY of positions) {
      for (const positionX of positions) {
        hashes.push(
          (await hashPdqPixels(cropPixels(pixels, scale, positionX, positionY)))
            .hash,
        );
      }
    }
  }
  return [...new Set(hashes)];
}

export async function cropMatchDistances(
  query: CropMultihash,
  reference: CropMultihash,
): Promise<number[]> {
  return Promise.all(
    query.map(async (hash) =>
      Math.min(
        ...(await Promise.all(
          reference.map((candidate) => pdqDistance(hash, candidate)),
        )),
      ),
    ),
  );
}
