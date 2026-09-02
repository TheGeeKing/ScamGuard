import { expect, test } from "bun:test";
import { join } from "node:path";
import { PNG } from "pngjs";
import { cropMatchDistances, cropMultihash } from "./crop-multihash";
import {
  type BenchmarkPixels,
  centerCrop,
  decodeBenchmarkBytes,
  decodeBenchmarkImage,
  hashPdqPixels,
  pdqDistance,
} from "./pdq-benchmark";

function pngBytes(pixels: BenchmarkPixels): Uint8Array {
  const png = new PNG({ width: pixels.width, height: pixels.height });
  for (let source = 0, target = 0; source < pixels.data.length; source += 3) {
    png.data[target++] = pixels.data[source] ?? 0;
    png.data[target++] = pixels.data[source + 1] ?? 0;
    png.data[target++] = pixels.data[source + 2] ?? 0;
    png.data[target++] = 255;
  }
  return PNG.sync.write(png);
}

function mapPixels(
  pixels: BenchmarkPixels,
  map: (value: number) => number,
): BenchmarkPixels {
  return { ...pixels, data: pixels.data.map(map) };
}

function withOverlay(pixels: BenchmarkPixels): BenchmarkPixels {
  const data = pixels.data.slice();
  const startX = Math.floor(pixels.width * 0.7);
  const startY = Math.floor(pixels.height * 0.8);
  for (let y = startY; y < pixels.height; y += 1) {
    for (let x = startX; x < pixels.width; x += 1) {
      const index = (y * pixels.width + x) * 3;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
    }
  }
  return { ...pixels, data };
}

function syntheticNegative(seed: number): BenchmarkPixels {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      data[index] = (x * (seed * 7 + 3) + y * 11) % 256;
      data[index + 1] = (y * (seed * 5 + 9) + x * 13) % 256;
      data[index + 2] = ((x ^ y) * (seed * 3 + 1)) % 256;
    }
  }
  return { data, width, height };
}

test("whole-image PDQ recalls bounded visual edits", async () => {
  const source = await decodeBenchmarkImage(
    join(import.meta.dir, "..", "..", "evidence", "image-7.jpg"),
  );
  const sourceHash = (await hashPdqPixels(source)).hash;
  const encoded = pngBytes(source);
  const variants = [
    await decodeBenchmarkBytes(
      await new Bun.Image(encoded).jpeg({ quality: 65 }).buffer(),
    ),
    await decodeBenchmarkBytes(
      await new Bun.Image(encoded).webp({ quality: 65 }).buffer(),
    ),
    await decodeBenchmarkBytes(
      await new Bun.Image(encoded)
        .resize(256, 256, { fit: "inside" })
        .png()
        .buffer(),
    ),
    mapPixels(source, (value) => Math.min(255, Math.round(value * 1.12))),
    mapPixels(source, (value) =>
      Math.max(0, Math.min(255, Math.round((value - 128) * 1.12 + 128))),
    ),
    withOverlay(source),
  ];
  const distances = await Promise.all(
    variants.map(async (variant) =>
      pdqDistance(sourceHash, (await hashPdqPixels(variant)).hash),
    ),
  );

  expect(distances).toEqual([2, 2, 16, 2, 6, 66]);
  expect(distances.slice(0, 5).every((distance) => distance <= 31)).toBe(true);
});

test("crop pyramid recalls crop plus JPEG recompression", async () => {
  const source = await decodeBenchmarkImage(
    join(import.meta.dir, "..", "..", "evidence", "image-7.jpg"),
  );
  const cropped = centerCrop(source, 20);
  const recompressed = await decodeBenchmarkBytes(
    await new Bun.Image(pngBytes(cropped)).jpeg({ quality: 65 }).buffer(),
  );
  const distances = await cropMatchDistances(
    await cropMultihash(recompressed),
    await cropMultihash(source),
  );

  expect(Math.min(...distances)).toBeLessThanOrEqual(15);
  expect(
    Math.min(
      ...(await cropMatchDistances(
        await cropMultihash(withOverlay(source)),
        await cropMultihash(source),
      )),
    ),
  ).toBeLessThanOrEqual(15);
});

test("synthetic redistributable negatives do not strongly match Evidence", async () => {
  const source = await decodeBenchmarkImage(
    join(import.meta.dir, "..", "..", "evidence", "image-7.jpg"),
  );
  const sourceHash = (await hashPdqPixels(source)).hash;
  const sourceCrops = await cropMultihash(source);
  for (let seed = 1; seed <= 12; seed += 1) {
    const negative = syntheticNegative(seed);
    expect(
      await pdqDistance(sourceHash, (await hashPdqPixels(negative)).hash),
    ).toBeGreaterThan(31);
    expect(
      Math.min(
        ...(await cropMatchDistances(
          await cropMultihash(negative),
          sourceCrops,
        )),
      ),
    ).toBeGreaterThan(31);
  }
});
