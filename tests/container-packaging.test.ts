import { describe, expect, test } from "bun:test";

describe("container packaging", () => {
  test("includes curated Evidence in the runtime image", async () => {
    const dockerfile = await Bun.file("Dockerfile").text();
    const dockerignore = await Bun.file(".dockerignore").text();

    expect(dockerfile).toContain("COPY evidence ./evidence");
    expect(dockerignore.split(/\r?\n/)).not.toContain("evidence");
  });
});
