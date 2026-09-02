import { expect, test } from "bun:test";
import { join } from "node:path";
import { createPerceptualWorker } from "../src/perceptual/worker-client";

test("persistent worker analyzes transferred bytes and survives a rejected image", async () => {
  const worker = createPerceptualWorker({ timeoutMs: 5_000 });
  try {
    await expect(
      worker.analyze(new Uint8Array([1, 2, 3]).buffer),
    ).rejects.toThrow();
    const bytes = await Bun.file(
      join(import.meta.dir, "..", "evidence", "image-7.jpg"),
    ).arrayBuffer();
    const result = await worker.analyze(bytes);
    expect(result.pdq).toBe(
      "97bdb8294000c11e2f5eb6ad355370d2b2adaf3e1e3c175018ad0bab734c5f93",
    );
    expect(result.crops.length).toBeGreaterThan(28);
  } finally {
    worker.close();
  }
});
