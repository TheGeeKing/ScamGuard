import { expect, test } from "bun:test";
import { join } from "node:path";

type WorkerReply = {
  id: string;
  result?: { pdq: { hash: string; quality: number }; crops: string[] };
  error?: string;
};

function runWorker(path: string): Promise<WorkerReply> {
  const worker = new Worker(new URL("./hash-worker.ts", import.meta.url).href);
  return new Promise((resolve, reject) => {
    worker.onerror = (event) => reject(event.error);
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      worker.terminate();
      resolve(event.data);
    };
    void Bun.file(path)
      .arrayBuffer()
      .then((bytes) => worker.postMessage({ id: "fixture", bytes }, [bytes]));
  });
}

test("worker returns deterministic whole-image and crop hashes", async () => {
  const image = join(import.meta.dir, "..", "..", "evidence", "image-7.jpg");
  const reply = await runWorker(image);

  expect(reply.error).toBeUndefined();
  expect(reply.result?.pdq).toEqual({
    hash: "97bdb8294000c11e2f5eb6ad355370d2b2adaf3e1e3c175018ad0bab734c5f93",
    quality: 100,
  });
  expect(reply.result?.crops).toHaveLength(28);
});

test("a terminated worker can be replaced", async () => {
  const terminated = new Worker(
    new URL("./hash-worker.ts", import.meta.url).href,
  );
  terminated.terminate();

  const image = join(import.meta.dir, "..", "..", "evidence", "image-7.jpg");
  expect((await runWorker(image)).result?.crops).toHaveLength(28);
});
