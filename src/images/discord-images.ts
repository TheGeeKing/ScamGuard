export type ImageSource = {
  id: string;
  url: string;
  transport?: "discord" | "external";
};

type DiscordMedia = { url: string; proxyUrl?: string | null };

type DiscordMessageMedia = {
  attachments: { id: string; url: string; contentType?: string | null }[];
  embeds: {
    image?: DiscordMedia | null;
    thumbnail?: DiscordMedia | null;
    authorIconUrl?: string | null;
    footerIconUrl?: string | null;
  }[];
};

const discordMediaHosts = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
  "images-ext-1.discordapp.net",
  "images-ext-2.discordapp.net",
]);

export function isApprovedDiscordMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      discordMediaHosts.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function canFetchImageSource(
  source: ImageSource,
  externalEnabled: boolean,
): boolean {
  return (
    isApprovedDiscordMediaUrl(source.url) ||
    (externalEnabled && source.transport === "external")
  );
}

export function selectDiscordImageSources(
  message: DiscordMessageMedia,
): ImageSource[] {
  const sources: ImageSource[] = message.attachments
    .filter((attachment) => attachment.contentType?.startsWith("image/"))
    .map((attachment) => ({
      id: `attachment:${attachment.id}`,
      url: attachment.url,
      transport: "discord" as const,
    }));
  for (const [embedIndex, embed] of message.embeds.entries()) {
    for (const [kind, media] of [
      ["image", embed.image],
      ["thumbnail", embed.thumbnail],
    ] as const) {
      if (!media) continue;
      const url =
        media.proxyUrl && isApprovedDiscordMediaUrl(media.proxyUrl)
          ? media.proxyUrl
          : media.url;
      sources.push({
        id: `embed:${embedIndex}:${kind}`,
        url,
        transport: isApprovedDiscordMediaUrl(url) ? "discord" : "external",
      });
    }
  }
  return sources;
}

type ImageFormat = "png" | "jpeg" | "gif" | "webp";

export type FingerprintOutcome =
  | {
      status: "fingerprinted";
      sourceId: string;
      sha256: string;
      format: ImageFormat;
      bytes: number;
      content: ArrayBuffer;
    }
  | { status: "failed"; sourceId: string; diagnostic: string };

type FingerprintOptions = {
  concurrency: number;
  maxBytes: number;
  timeoutMs: number;
  fetch(url: string, signal: AbortSignal): Promise<Response>;
  validateSource?(source: ImageSource): boolean;
};

function identifyFormat(bytes: Uint8Array): ImageFormat | null {
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "jpeg";
  const text = new TextDecoder().decode(bytes.subarray(0, 12));
  if (text.startsWith("GIF87a") || text.startsWith("GIF89a")) return "gif";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "webp";
  return null;
}

async function fingerprintOne(
  source: ImageSource,
  options: FingerprintOptions,
): Promise<FingerprintOutcome> {
  if (
    !(options.validateSource?.(source) ?? isApprovedDiscordMediaUrl(source.url))
  ) {
    return {
      status: "failed",
      sourceId: source.id,
      diagnostic: "unapproved-discord-media-url",
    };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("image-download-timeout"));
    }, options.timeoutMs);
  });

  try {
    return await Promise.race([
      (async (): Promise<FingerprintOutcome> => {
        const response = await options.fetch(source.url, controller.signal);
        if (!response.ok || !response.body)
          throw new Error("image-download-failed");
        const declaredLength = Number(response.headers.get("content-length"));
        if (declaredLength > options.maxBytes)
          throw new Error("image-too-large");

        const reader = response.body.getReader();
        const hasher = new Bun.CryptoHasher("sha256");
        const prefix: number[] = [];
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > options.maxBytes) {
            await reader.cancel();
            throw new Error("image-too-large");
          }
          hasher.update(chunk.value);
          chunks.push(chunk.value.slice());
          for (const byte of chunk.value) {
            if (prefix.length === 12) break;
            prefix.push(byte);
          }
        }
        const format = identifyFormat(Uint8Array.from(prefix));
        if (!format) throw new Error("unsupported-image-signature");
        const content = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) {
          content.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return {
          status: "fingerprinted",
          sourceId: source.id,
          sha256: hasher.digest("hex"),
          format,
          bytes,
          content: content.buffer,
        };
      })(),
      timeout,
    ]);
  } catch (error) {
    return {
      status: "failed",
      sourceId: source.id,
      diagnostic:
        error instanceof Error ? error.message : "image-processing-failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fingerprintImages(
  sources: ImageSource[],
  options: FingerprintOptions,
): Promise<FingerprintOutcome[]> {
  const results = new Array<FingerprintOutcome>(sources.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < sources.length) {
      const index = next;
      next += 1;
      results[index] = await fingerprintOne(
        sources[index] as ImageSource,
        options,
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(options.concurrency, sources.length) },
      worker,
    ),
  );
  return results;
}
