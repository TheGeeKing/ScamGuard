import { describe, expect, test } from "bun:test";

describe("container packaging", () => {
  test("forwards diagnostic and update policy settings while preserving empty skip lists", async () => {
    const compose = await Bun.file("compose.yml").text();
    expect(compose).toContain("LOG_LEVEL: ${LOG_LEVEL:-info}");
    expect(compose).toContain("IGNORED_EMBED_HOSTS: ${IGNORED_EMBED_HOSTS:-}");
    expect(compose).toContain("SKIPPED_MESSAGE_UPDATE_CAUSES: ${SKIPPED_MESSAGE_UPDATE_CAUSES-embeds-only,no-relevant-change}");
  });
  test("includes curated Evidence in the runtime image", async () => {
    const dockerfile = await Bun.file("Dockerfile").text();
    const dockerignore = await Bun.file(".dockerignore").text();

    expect(dockerfile).toContain("COPY evidence ./evidence");
    expect(dockerignore.split(/\r?\n/)).not.toContain("evidence");
  });
});
