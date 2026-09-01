import type { Signal } from "./scamguard";

export type BehaviorObservation = {
  guildId: string;
  userId: string;
  messageId: string;
  channelId: string;
  imageCount: number;
  imageDigests: string[];
  accountCreatedAt: Date;
  guildJoinedAt: Date | null;
};

type RecentMessage = BehaviorObservation & { observedAt: Date };

const seconds = (value: number): number => value * 1000;
const days = (value: number): number => value * 24 * 60 * 60 * 1000;

export function createBehaviorTracker(now: () => Date): {
  observe(observation: BehaviorObservation): Signal[];
  cleanupMessageIds(guildId: string, userId: string): string[];
} {
  const recent = new Map<string, RecentMessage[]>();
  const identity = (guildId: string, userId: string) => `${guildId}:${userId}`;

  const active = (guildId: string, userId: string): RecentMessage[] => {
    const key = identity(guildId, userId);
    const cutoff = now().getTime() - 5 * 60 * 1000;
    const messages = (recent.get(key) ?? []).filter(
      (message) => message.observedAt.getTime() > cutoff,
    );
    recent.set(key, messages);
    return messages;
  };

  return {
    observe: (observation) => {
      const messages = active(observation.guildId, observation.userId);
      messages.push({ ...observation, observedAt: now() });
      recent.set(identity(observation.guildId, observation.userId), messages);

      const currentTime = now().getTime();
      const within = (duration: number) =>
        messages.filter(
          (message) => message.observedAt.getTime() >= currentTime - duration,
        );
      const signals: Signal[] = [];

      if (within(seconds(5)).length >= 5) {
        signals.push({
          key: "message-burst-5s",
          group: "message-burst",
          weight: 15,
        });
      }

      const images10s = within(seconds(10)).filter(
        (message) => message.imageCount > 0,
      );
      if (images10s.length >= 5) {
        signals.push({
          key: "image-burst-10s",
          group: "image-burst",
          weight: 25,
        });
      }

      const imageChannels15s = new Set(
        within(seconds(15))
          .filter((message) => message.imageCount > 0)
          .map((message) => message.channelId),
      );
      const imageChannels10s = new Set(
        images10s.map((message) => message.channelId),
      );
      if (imageChannels15s.size >= 5) {
        signals.push({
          key: "channel-spread-5",
          group: "channel-spread",
          weight: 50,
        });
      } else if (imageChannels10s.size >= 3) {
        signals.push({
          key: "channel-spread-3",
          group: "channel-spread",
          weight: 30,
        });
      }

      const digestChannels = new Map<string, Set<string>>();
      for (const message of within(seconds(15))) {
        for (const digest of new Set(message.imageDigests)) {
          const channels = digestChannels.get(digest) ?? new Set<string>();
          channels.add(message.channelId);
          digestChannels.set(digest, channels);
        }
      }
      const largestRepeat = Math.max(
        0,
        ...[...digestChannels.values()].map((channels) => channels.size),
      );
      if (largestRepeat >= 3) {
        signals.push({
          key: "exact-repeat-3-channels",
          group: "exact-repeat",
          weight: 80,
        });
      } else if (largestRepeat >= 2) {
        signals.push({
          key: "exact-repeat-2-channels",
          group: "exact-repeat",
          weight: 35,
        });
      }

      if (
        observation.guildJoinedAt &&
        currentTime - observation.guildJoinedAt.getTime() < seconds(10 * 60)
      ) {
        signals.push({
          key: "recent-guild-join",
          group: "guild-age",
          weight: 8,
        });
      }
      const accountAge = currentTime - observation.accountCreatedAt.getTime();
      if (accountAge < days(1)) {
        signals.push({
          key: "account-under-1d",
          group: "account-age",
          weight: 10,
        });
      } else if (accountAge < days(7)) {
        signals.push({
          key: "account-under-7d",
          group: "account-age",
          weight: 5,
        });
      }

      return signals;
    },
    cleanupMessageIds: (guildId, userId) =>
      active(guildId, userId).map((message) => message.messageId),
  };
}
