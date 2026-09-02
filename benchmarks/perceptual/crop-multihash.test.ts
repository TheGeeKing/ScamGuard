import { expect, test } from "bun:test";
import { join } from "node:path";
import { cropMatchDistances, cropMultihash } from "./crop-multihash";
import { centerCrop, decodeBenchmarkImage } from "./pdq-benchmark";

test("crop multihash retains a close window after center crops", async () => {
  const image = join(import.meta.dir, "..", "..", "evidence", "image-7.jpg");
  const pixels = await decodeBenchmarkImage(image);
  const reference = await cropMultihash(pixels);

  expect(reference.length).toBeGreaterThanOrEqual(20);
  for (const percent of [5, 10, 20]) {
    const query = await cropMultihash(centerCrop(pixels, percent));
    const distances = await cropMatchDistances(query, reference);
    expect(Math.min(...distances)).toBeLessThanOrEqual(15);
  }
});

test("crop multihash separates visually unrelated curated images", async () => {
  const left = await decodeBenchmarkImage(
    join(import.meta.dir, "..", "..", "evidence", "image-6.jpg"),
  );
  const right = await decodeBenchmarkImage(
    join(import.meta.dir, "..", "..", "evidence", "image-8.jpg"),
  );

  const distances = await cropMatchDistances(
    await cropMultihash(left),
    await cropMultihash(right),
  );
  expect(Math.min(...distances)).toBeGreaterThan(31);
});
