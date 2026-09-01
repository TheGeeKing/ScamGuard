import { describe, expect, test } from "bun:test";
import {
  createGuardedExternalFetch,
  isPublicAddress,
  pinnedRequestOptions,
  requestPinned,
} from "../src/images/external-fetch";

describe("guarded external image fetch", () => {
  test("rejects credentials, custom ports, and non-public DNS answers", async () => {
    const requested: unknown[] = [];
    const fetchExternal = createGuardedExternalFetch({
      resolve: async (hostname) =>
        hostname === "private.example" ? ["127.0.0.1"] : ["203.0.113.8"],
      request: async (request) => {
        requested.push(request);
        return new Response("never");
      },
    });

    for (const url of [
      "https://user:secret@public.example/image.png",
      "https://public.example:8443/image.png",
      "ftp://public.example/image.png",
      "http://private.example/image.png",
    ]) {
      await expect(
        fetchExternal(url, AbortSignal.timeout(100)),
      ).rejects.toThrow();
    }
    expect(requested).toEqual([]);
  });

  test("pins a public address, keeps the hostname, and sends no ambient headers", async () => {
    const requests: Array<{
      url: URL;
      address: string;
      hostname: string;
      headers: Headers;
    }> = [];
    const fetchExternal = createGuardedExternalFetch({
      resolve: async () => ["93.184.216.34"],
      request: async (request) => {
        requests.push(request);
        return new Response("image");
      },
    });

    await fetchExternal(
      "https://example.com/image.png",
      AbortSignal.timeout(100),
    );
    await fetchExternal(
      "http://example.com/image.png",
      AbortSignal.timeout(100),
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      address: "93.184.216.34",
      hostname: "example.com",
    });
    expect(requests[0] ? [...requests[0].headers] : undefined).toEqual([]);
  });

  test("classifies public and internal IPv4 and IPv6 destinations", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
    for (const address of [
      "10.0.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "::1",
      "fe80::1",
      "fc00::1",
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }
  });

  test("revalidates and pins two redirects but refuses a third", async () => {
    const requested: string[] = [];
    let cancelled = 0;
    const fetchExternal = createGuardedExternalFetch({
      resolve: async (hostname) => [
        hostname === "one.example" ? "93.184.216.1" : "93.184.216.2",
      ],
      request: async ({ url, address }) => {
        requested.push(`${url.hostname}:${address}`);
        if (url.hostname === "one.example")
          return new Response(
            new ReadableStream({
              cancel: () => {
                cancelled += 1;
              },
            }),
            {
              status: 302,
              headers: { location: "https://two.example/image.png" },
            },
          );
        return new Response(
          new ReadableStream({
            cancel: () => {
              cancelled += 1;
            },
          }),
          {
            status: 302,
            headers: { location: "https://three.example/image.png" },
          },
        );
      },
    });

    await expect(
      fetchExternal("https://one.example/image.png", AbortSignal.timeout(100)),
    ).rejects.toThrow("external-image-redirect-limit");
    expect(requested).toEqual([
      "one.example:93.184.216.1",
      "two.example:93.184.216.2",
      "three.example:93.184.216.2",
    ]);
    expect(cancelled).toBe(3);
  });

  test("does not request after a signal aborts during DNS resolution", async () => {
    let requested = false;
    const controller = new AbortController();
    const fetchExternal = createGuardedExternalFetch({
      resolve: async () => {
        await Bun.sleep(10);
        return ["93.184.216.34"];
      },
      request: async () => {
        requested = true;
        return new Response("unexpected");
      },
    });
    const pending = fetchExternal(
      "https://example.com/image.png",
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow("image-download-timeout");
    expect(requested).toBe(false);
  });

  test("pins HTTP sockets and retains TLS hostname verification", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response("pinned"),
    });
    try {
      const response = await requestPinned({
        url: new URL(`http://must-not-resolve.invalid:${server.port}/image`),
        address: "127.0.0.1",
        hostname: "must-not-resolve.invalid",
        headers: new Headers(),
        signal: AbortSignal.timeout(1000),
      });
      expect(await response.text()).toBe("pinned");
    } finally {
      await server.stop();
    }

    expect(
      pinnedRequestOptions(
        new URL("https://example.com/image"),
        "93.184.216.34",
        "example.com",
      ),
    ).toMatchObject({
      hostname: "93.184.216.34",
      servername: "example.com",
      rejectUnauthorized: true,
    });
  });
});
