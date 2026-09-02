import { expect, test } from "bun:test";
import { join } from "node:path";
import { hashImageBytes, PERCEPTUAL_VERSION } from "../src/perceptual/hash";

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
  expect(result.crops).toHaveLength(28);
});
