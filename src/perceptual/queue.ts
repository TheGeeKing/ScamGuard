import type { PerceptualHash } from "./hash";

export type PerceptualJob = {
  id: string;
  guildId: string;
  userId: string;
  bytes: ArrayBuffer;
};

type QueueOptions = {
  maxJobs: number;
  maxBytes: number;
  maxJobsPerUser: number;
  quantum: number;
};

type QueuedJob = PerceptualJob & {
  resolve(value: PerceptualHash): void;
  reject(error: unknown): void;
};

export type PerceptualQueue = {
  enqueue(job: PerceptualJob):
    | { status: "queued"; result: Promise<PerceptualHash> }
    | {
        status: "rejected";
        reason: "queue-limit" | "byte-limit" | "user-limit";
      };
  status(): {
    active: number;
    queued: number;
    queuedBytes: number;
    rejected: number;
  };
  close(): Promise<void>;
};

export function createPerceptualQueue(
  options: QueueOptions,
  analyze: (job: PerceptualJob) => Promise<PerceptualHash>,
): PerceptualQueue {
  const groups = new Map<string, QueuedJob[]>();
  const ready: string[] = [];
  const outstanding = new Map<string, number>();
  let active = 0;
  let queued = 0;
  let queuedBytes = 0;
  let rejected = 0;
  let served = 0;
  let accepting = true;
  let draining: Promise<void> | undefined;

  const drain = async (): Promise<void> => {
    while (ready.length > 0) {
      const key = ready[0] as string;
      const group = groups.get(key) as QueuedJob[];
      const job = group.shift() as QueuedJob;
      queued -= 1;
      active = 1;
      try {
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            job.resolve(await analyze(job));
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (lastError) job.reject(lastError);
      } finally {
        active = 0;
        queuedBytes -= job.bytes.byteLength;
        const remaining = (outstanding.get(key) ?? 1) - 1;
        if (remaining === 0) outstanding.delete(key);
        else outstanding.set(key, remaining);
      }
      served += 1;
      if (group.length === 0) {
        groups.delete(key);
        ready.shift();
        served = 0;
      } else if (served >= options.quantum && ready.length > 1) {
        ready.push(ready.shift() as string);
        served = 0;
      }
    }
  };

  const startDrain = (): void => {
    if (draining) return;
    draining = drain().finally(() => {
      draining = undefined;
      if (ready.length > 0) startDrain();
    });
  };

  return {
    enqueue: (job) => {
      const key = `${job.guildId}:${job.userId}`;
      const reason =
        !accepting || active + queued >= options.maxJobs
          ? "queue-limit"
          : queuedBytes + job.bytes.byteLength > options.maxBytes
            ? "byte-limit"
            : (outstanding.get(key) ?? 0) >= options.maxJobsPerUser
              ? "user-limit"
              : undefined;
      if (reason) {
        rejected += 1;
        return { status: "rejected", reason };
      }
      let resolve!: (value: PerceptualHash) => void;
      let reject!: (error: unknown) => void;
      const result = new Promise<PerceptualHash>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const group = groups.get(key);
      const queuedJob = { ...job, resolve, reject };
      if (group) group.push(queuedJob);
      else {
        groups.set(key, [queuedJob]);
        ready.push(key);
      }
      outstanding.set(key, (outstanding.get(key) ?? 0) + 1);
      queued += 1;
      queuedBytes += job.bytes.byteLength;
      startDrain();
      return { status: "queued", result };
    },
    status: () => ({ active, queued, queuedBytes, rejected }),
    close: async () => {
      accepting = false;
      await draining;
    },
  };
}
