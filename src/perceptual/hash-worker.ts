import { hashImageBytes } from "./hash";

declare const self: Worker;

self.onmessage = async (
  event: MessageEvent<{ id: number; bytes: ArrayBuffer }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: await hashImageBytes(event.data.bytes),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error:
        error instanceof Error ? error.message : "perceptual-analysis-failed",
    });
  }
};
