import { lookup } from "node:dns/promises";
import { request as requestHttp } from "node:http";
import type { RequestOptions } from "node:https";
import { request as requestHttps } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import ipaddr from "ipaddr.js";

export type PinnedRequest = {
  url: URL;
  address: string;
  hostname: string;
  headers: Headers;
  signal: AbortSignal;
};

type ExternalFetchPorts = {
  resolve(hostname: string): Promise<string[]>;
  request(request: PinnedRequest): Promise<Response>;
};

function validateUrl(value: string | URL): URL {
  const url = new URL(value);
  if (url.username || url.password)
    throw new Error("external-image-credentials");
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("external-image-protocol");
  if (url.port) throw new Error("external-image-custom-port");
  return url;
}

export function isPublicAddress(value: string): boolean {
  if (!ipaddr.isValid(value)) return false;
  const address = ipaddr.process(value);
  return address.range() === "unicast";
}

export function createGuardedExternalFetch(
  ports: ExternalFetchPorts,
): (url: string, signal: AbortSignal) => Promise<Response> {
  return async (initialUrl, signal) => {
    let url = validateUrl(initialUrl);
    for (let redirects = 0; redirects <= 2; redirects += 1) {
      if (signal.aborted) throw new Error("image-download-timeout");
      const addresses = await ports.resolve(url.hostname);
      if (signal.aborted) throw new Error("image-download-timeout");
      if (
        addresses.length === 0 ||
        addresses.some((address) => !isPublicAddress(address))
      )
        throw new Error("external-image-disallowed-address");
      const address = addresses[0] as string;
      const response = await ports.request({
        url,
        address,
        hostname: url.hostname,
        headers: new Headers(),
        signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      await response.body?.cancel();
      if (redirects === 2) throw new Error("external-image-redirect-limit");
      const location = response.headers.get("location");
      if (!location) throw new Error("external-image-redirect-location");
      url = validateUrl(new URL(location, url));
    }
    throw new Error("external-image-redirect-limit");
  };
}

export const resolveExternalHost = async (
  hostname: string,
): Promise<string[]> =>
  (await lookup(hostname, { all: true, verbatim: true })).map(
    (answer) => answer.address,
  );

export function pinnedRequestOptions(
  url: URL,
  address: string,
  hostname: string,
): RequestOptions {
  return {
    protocol: url.protocol,
    hostname: address,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method: "GET",
    headers: { host: url.host },
    servername: hostname,
    rejectUnauthorized: true,
    lookup: (_name, _options, callback) =>
      callback(null, address, isIP(address)),
  };
}

export async function requestPinned({
  url,
  address,
  hostname,
  signal,
}: PinnedRequest): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("image-download-timeout"));
      return;
    }
    const request = (url.protocol === "https:" ? requestHttps : requestHttp)(
      pinnedRequestOptions(url, address, hostname),
      (incoming) => {
        const headers = new Headers();
        for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
          headers.append(
            incoming.rawHeaders[index] as string,
            incoming.rawHeaders[index + 1] as string,
          );
        }
        resolve(
          new Response(Readable.toWeb(incoming) as ReadableStream, {
            status: incoming.statusCode ?? 500,
            statusText: incoming.statusMessage,
            headers,
          }),
        );
      },
    );
    request.once("error", reject);
    const abort = () => request.destroy(new Error("image-download-timeout"));
    signal.addEventListener("abort", abort, { once: true });
    request.once("close", () => signal.removeEventListener("abort", abort));
    request.end();
  });
}

export const fetchExternalImage = createGuardedExternalFetch({
  resolve: resolveExternalHost,
  request: requestPinned,
});
