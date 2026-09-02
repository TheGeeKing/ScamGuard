import type { PerceptualHash } from "./hash";

type Reply = { id: number; result?: PerceptualHash; error?: string };

export function createPerceptualWorker(options: { timeoutMs: number }): {
  analyze(bytes: ArrayBuffer): Promise<PerceptualHash>;
  close(): void;
} {
  let worker: Worker;
  let nextId = 0;
  let pending:
    | {
        id: number;
        resolve(value: PerceptualHash): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;

  const spawn = (): Worker => {
    const next = new Worker(new URL("./hash-worker.ts", import.meta.url).href);
    next.onmessage = (event: MessageEvent<Reply>) => {
      if (!pending || event.data.id !== pending.id) return;
      clearTimeout(pending.timer);
      const current = pending;
      pending = undefined;
      if (event.data.result) current.resolve(event.data.result);
      else
        current.reject(
          new Error(event.data.error ?? "perceptual-analysis-failed"),
        );
    };
    next.onerror = (event) => {
      const current = pending;
      pending = undefined;
      if (current) {
        clearTimeout(current.timer);
        current.reject(event.error ?? new Error("perceptual-worker-failed"));
      }
      next.terminate();
      worker = spawn();
    };
    return next;
  };
  worker = spawn();

  return {
    analyze: (bytes) => {
      if (pending) return Promise.reject(new Error("perceptual-worker-busy"));
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending = undefined;
          worker.terminate();
          worker = spawn();
          reject(new Error("perceptual-analysis-timeout"));
        }, options.timeoutMs);
        pending = { id, resolve, reject, timer };
        const transferred = bytes.slice(0);
        worker.postMessage({ id, bytes: transferred }, [transferred]);
      });
    },
    close: () => {
      worker.terminate();
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error("perceptual-worker-closed"));
        pending = undefined;
      }
    },
  };
}
