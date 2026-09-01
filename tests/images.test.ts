import { describe, expect, test } from "bun:test";
import {
  canFetchImageSource,
  fingerprintImages,
  selectDiscordImageSources,
} from "../src/images/discord-images";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const gif = new TextEncoder().encode("GIF89a-complete-animation-bytes");

describe("Discord image fingerprinting", () => {
  test("selects attachments and visible embed media while preferring proxy URLs", () => {
    expect(
      selectDiscordImageSources({
        attachments: [
          {
            id: "attachment",
            url: "https://cdn.discordapp.com/a.png",
            contentType: "image/png",
          },
          {
            id: "document",
            url: "https://cdn.discordapp.com/a.pdf",
            contentType: "application/pdf",
          },
        ],
        embeds: [
          {
            image: {
              url: "https://origin.example/image.png",
              proxyUrl: "https://media.discordapp.net/proxy.png",
            },
            thumbnail: {
              url: "https://cdn.discordapp.com/thumb.png",
              proxyUrl: null,
            },
            authorIconUrl: "https://cdn.discordapp.com/decorative.png",
            footerIconUrl: "https://cdn.discordapp.com/footer.png",
          },
          {
            image: {
              url: "https://external.example/image.png",
              proxyUrl: null,
            },
          },
        ],
      }).map((source) => source.url),
    ).toEqual([
      "https://cdn.discordapp.com/a.png",
      "https://media.discordapp.net/proxy.png",
      "https://cdn.discordapp.com/thumb.png",
      "https://external.example/image.png",
    ]);
    expect(
      selectDiscordImageSources({
        attachments: [],
        embeds: [{ image: { url: "https://external.example/image.png" } }],
      })[0]?.transport,
    ).toBe("external");
    const external = {
      id: "external",
      url: "https://external.example/image.png",
      transport: "external" as const,
    };
    expect(canFetchImageSource(external, true)).toBe(true);
    expect(canFetchImageSource(external, false)).toBe(false);
  });

  test("streams every image with bounded concurrency and isolates failures", async () => {
    let active = 0;
    let maximumActive = 0;
    const sources = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      url: `https://cdn.discordapp.com/${index}.png`,
    }));
    const outcomes = await fingerprintImages(sources, {
      concurrency: 2,
      maxBytes: 1024,
      timeoutMs: 1000,
      fetch: async (url) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Bun.sleep(2);
        active -= 1;
        return new Response(
          url.endsWith("3.png") ? new Uint8Array([1, 2, 3]) : png,
        );
      },
    });

    expect(outcomes).toHaveLength(6);
    expect(maximumActive).toBe(2);
    expect(
      outcomes.filter((outcome) => outcome.status === "fingerprinted"),
    ).toHaveLength(5);
    expect(outcomes[3]).toMatchObject({
      status: "failed",
      diagnostic: "unsupported-image-signature",
    });
  });

  test("hashes a complete GIF and names size and timeout diagnostics", async () => {
    const expected = new Bun.CryptoHasher("sha256").update(gif).digest("hex");
    const [hashed] = await fingerprintImages(
      [{ id: "gif", url: "https://cdn.discordapp.com/a.gif" }],
      {
        concurrency: 1,
        maxBytes: 1024,
        timeoutMs: 1000,
        fetch: async () => new Response(gif),
      },
    );
    expect(hashed).toMatchObject({
      status: "fingerprinted",
      format: "gif",
      sha256: expected,
      bytes: gif.length,
    });

    const failures = await fingerprintImages(
      [
        { id: "large", url: "https://cdn.discordapp.com/large.png" },
        { id: "slow", url: "https://cdn.discordapp.com/slow.png" },
      ],
      {
        concurrency: 2,
        maxBytes: 8,
        timeoutMs: 5,
        fetch: async (url) => {
          if (url.includes("slow")) await Bun.sleep(20);
          return new Response(png);
        },
      },
    );
    expect(
      failures.map((failure) =>
        failure.status === "failed" ? failure.diagnostic : undefined,
      ),
    ).toEqual(["image-too-large", "image-download-timeout"]);
  });
});
