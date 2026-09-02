import { cropMultihash } from "./crop-multihash";
import { decodeBenchmarkBytes, hashPdqPixels } from "./pdq-benchmark";

declare const self: Worker;

self.onmessage = async (
  event: MessageEvent<{ id: string; bytes: ArrayBuffer }>,
) => {
  try {
    const pixels = await decodeBenchmarkBytes(event.data.bytes);
    self.postMessage({
      id: event.data.id,
      result: {
        pdq: await hashPdqPixels(pixels),
        crops: await cropMultihash(pixels),
      },
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
};
