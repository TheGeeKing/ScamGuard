import { expect, test } from "bun:test";
import type { PerceptualHash } from "../src/perceptual/hash";
import { createPerceptualQueue } from "../src/perceptual/queue";

const result: PerceptualHash = {
  version: "pdq-crops-v1",
  pdq: "a".repeat(64),
  quality: 100,
  crops: ["a".repeat(64)],
};

test("queue alternates users after its scheduling quantum", async () => {
  const order: string[] = [];
  const queue = createPerceptualQueue(
    { maxJobs: 8, maxBytes: 1024, maxJobsPerUser: 4, quantum: 2 },
    async (job) => {
      order.push(job.id);
      await Bun.sleep(1);
      return result;
    },
  );
  const jobs = [
    queue.enqueue({
      id: "a1",
      guildId: "g",
      userId: "a",
      bytes: new ArrayBuffer(1),
    }),
    queue.enqueue({
      id: "a2",
      guildId: "g",
      userId: "a",
      bytes: new ArrayBuffer(1),
    }),
    queue.enqueue({
      id: "a3",
      guildId: "g",
      userId: "a",
      bytes: new ArrayBuffer(1),
    }),
    queue.enqueue({
      id: "b1",
      guildId: "g",
      userId: "b",
      bytes: new ArrayBuffer(1),
    }),
  ];

  await Promise.all(
    jobs.map((job) => (job.status === "queued" ? job.result : undefined)),
  );
  expect(order).toEqual(["a1", "a2", "b1", "a3"]);
  expect(queue.status()).toEqual({
    active: 0,
    queued: 0,
    queuedBytes: 0,
    rejected: 0,
  });
  await queue.close();
});

test("queue rejects global and per-user excess without delaying accepted jobs", async () => {
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = createPerceptualQueue(
    { maxJobs: 2, maxBytes: 2, maxJobsPerUser: 1, quantum: 2 },
    async () => {
      await blocked;
      return result;
    },
  );
  const first = queue.enqueue({
    id: "a",
    guildId: "g",
    userId: "a",
    bytes: new ArrayBuffer(1),
  });
  const sameUser = queue.enqueue({
    id: "a2",
    guildId: "g",
    userId: "a",
    bytes: new ArrayBuffer(1),
  });
  const second = queue.enqueue({
    id: "b",
    guildId: "g",
    userId: "b",
    bytes: new ArrayBuffer(1),
  });
  const full = queue.enqueue({
    id: "c",
    guildId: "g",
    userId: "c",
    bytes: new ArrayBuffer(1),
  });

  expect(sameUser).toEqual({ status: "rejected", reason: "user-limit" });
  expect(full).toEqual({ status: "rejected", reason: "queue-limit" });
  release?.();
  await Promise.all([
    first.status === "queued" ? first.result : undefined,
    second.status === "queued" ? second.result : undefined,
  ]);
  expect(queue.status().rejected).toBe(2);
  await queue.close();
});
