import { expect, test } from "bun:test";
import { join } from "node:path";
import { PNG } from "pngjs";
import { decodeBenchmarkImage } from "../benchmarks/perceptual/pdq-benchmark";
import { hashImageBytes, PERCEPTUAL_VERSION } from "../src/perceptual/hash";
import { matchPerceptual } from "../src/perceptual/matcher";

test("hashes encoded image bytes with a versioned portable representation", async () => {
  const bytes = await Bun.file(
    join(import.meta.dir, "..", "evidence", "image-7.jpg"),
  ).arrayBuffer();
  const result = await hashImageBytes(bytes);

  expect(result.version).toBe(PERCEPTUAL_VERSION);
  expect(result.pdq).toBe(
    "97bdb8294000c11e2f5eb6ad355370d2b2adaf3e1e3c175018ad0bab734c5f93",
  );
  expect(result.quality).toBe(100);
  expect(result.crops.length).toBeGreaterThan(28);
  expect(result.crops.some((value) => value.startsWith("d:"))).toBe(true);
});

test("matches a severe asymmetric crop through segmented hashes", async () => {
  const path = join(import.meta.dir, "..", "evidence", "1.jpg");
  const source = await decodeBenchmarkImage(path);
  const left = Math.floor(source.width * 0.24);
  const width = source.width - left;
  const height = Math.floor(source.height * 0.75);
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * source.width + x + left) * 3;
      const targetIndex = (y * width + x) * 4;
      png.data[targetIndex] = source.data[sourceIndex] ?? 0;
      png.data[targetIndex + 1] = source.data[sourceIndex + 1] ?? 0;
      png.data[targetIndex + 2] = source.data[sourceIndex + 2] ?? 0;
      png.data[targetIndex + 3] = 255;
    }
  }
  const [query, reference] = await Promise.all([
    hashImageBytes(new Uint8Array(PNG.sync.write(png)).buffer as ArrayBuffer),
    hashImageBytes(await Bun.file(path).arrayBuffer()),
  ]);

  const result = await matchPerceptual(query, [
    { sourceSha256: "source", classification: "known", hash: reference },
  ]);
  expect(result.matches[0]?.sourceSha256).toBe("source");
  expect(result.proposedScore).toBeGreaterThan(0);
});
