import { expect, test } from "bun:test";
import {
  PERCEPTUAL_VERSION,
  type PerceptualHash,
} from "../src/perceptual/hash";
import { matchPerceptual } from "../src/perceptual/matcher";

const hash = (pdq: string): PerceptualHash => ({
  version: PERCEPTUAL_VERSION,
  pdq,
  quality: 100,
  crops: [],
});
const zero = "0".repeat(64);

test("matcher applies non-linear confidence across distinct references", async () => {
  const oneStrong = await matchPerceptual(
    hash("f".repeat(5) + "0".repeat(59)),
    [{ sourceSha256: "a", classification: "known", hash: hash(zero) }],
  );
  const twoVeryStrong = await matchPerceptual(
    hash("f".repeat(3) + "0".repeat(61)),
    [
      { sourceSha256: "a", classification: "known", hash: hash(zero) },
      { sourceSha256: "b", classification: "known", hash: hash(zero) },
    ],
  );
  const weakOnly = await matchPerceptual(
    hash("f".repeat(10) + "0".repeat(54)),
    [
      { sourceSha256: "a", classification: "known", hash: hash(zero) },
      { sourceSha256: "b", classification: "known", hash: hash(zero) },
      { sourceSha256: "c", classification: "known", hash: hash(zero) },
      { sourceSha256: "d", classification: "known", hash: hash(zero) },
    ],
  );

  expect(oneStrong.proposedScore).toBe(60);
  expect(twoVeryStrong.proposedScore).toBe(100);
  expect(weakOnly.proposedScore).toBe(30);
});

test("an equally close safe reference suppresses known matches", async () => {
  const query = hash("f".repeat(3) + "0".repeat(61));
  const result = await matchPerceptual(query, [
    { sourceSha256: "known", classification: "known", hash: hash(zero) },
    { sourceSha256: "safe", classification: "safe", hash: hash(zero) },
  ]);

  expect(result).toEqual({
    proposedScore: 0,
    matches: [],
    suppressedBySafe: true,
  });
});
