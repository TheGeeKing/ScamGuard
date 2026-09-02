import { expect, test } from "bun:test";
import { join } from "node:path";
import {
  centerCrop,
  decodeBenchmarkImage,
  hashPdqImage,
  hashPdqPixels,
  pdqDistance,
} from "./pdq-benchmark";

test("PDQ benchmark hashes a curated image deterministically", async () => {
  const image = join(import.meta.dir, "..", "..", "evidence", "image-7.jpg");
  const first = await hashPdqImage(image);
  const second = await hashPdqImage(image);

  expect(first.hash).toMatch(/^[a-f\d]{64}$/);
  expect(first.hash).toBe(
    "97bdb829d008c15e0f5ebead375270d2a0ad0f3e1e3c135899ad038b734c5f93",
  );
  expect(first.quality).toBeGreaterThan(49);
  expect(second).toEqual(first);
});

test("PDQ benchmark measures crop distance", async () => {
  const image = join(import.meta.dir, "..", "..", "evidence", "image-7.jpg");
  const pixels = await decodeBenchmarkImage(image);
  const original = await hashPdqPixels(pixels);
  const distances = await Promise.all(
    [5, 10, 20].map(async (percent) =>
      pdqDistance(
        original.hash,
        (await hashPdqPixels(centerCrop(pixels, percent))).hash,
      ),
    ),
  );

  expect(distances).toEqual([52, 90, 128]);
});
