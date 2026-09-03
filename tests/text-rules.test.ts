import { describe, expect, test } from "bun:test";
import { matchTextRules } from "../src/text/rules";

describe("Text rules", () => {
  test("recognizes every configured scam phrase", () => {
    const examples = [
      ["Get 50$ for Steam today", "cash-for-steam"],
      ["STEAM gift 50$", "steam-gift-cash"],
      ["Alert @everyone", "everyone-mention"],
      ["Alert @here", "here-mention"],
      ["steam codes are worth 50$", "steam-cash"],
      ["50$ gift", "cash-gift"],
      ["Telegram   username", "telegram-username"],
      ["Call + 1 ( 909 ) 787 - 5410", "north-american-phone"],
      ["ASK ME (HOW)", "ask-me-how"],
      ["The first 20 people", "limited-people-offer"],
      ["How to start earning $100k", "earnings-promise"],
      ["Hiring: sales ( remote )", "remote-hiring"],
      ["Earn $100 and contact WhatsApp", "cash-whatsapp"],
      ["Earn $100 and contact Telegram", "cash-telegram"],
      ["HEY BABE", "hey-babe"],
    ] as const;

    for (const [content, ruleId] of examples) {
      expect(matchTextRules(content).map((match) => match.id)).toContain(
        ruleId,
      );
    }
  });

  test("matches the supplied scam examples after case and whitespace normalization", () => {
    const examples = [
      {
        content: `I'll help the first 10 people interested on how to  start earning $50k or more within a week. But you will reimburse me 10% of your profits when you receive it. Note: only interested people should send me a friend request or message Asking me  (HOW) via 👇Telegram username

@Marie_Sebastian

Or contact via telegram link on my Bio!`,
        ruleId: "telegram-username",
      },
      {
        content: `I'll help the first 10 people interested in how to start earning $100k or more from the crypto market within a week but you will reimburse me 10% of your profits when you receive it. Note: Only interested people should send me a dm! ask me (HOW) via Telegram or WhatsApp +1(909) 787-5410
@Henry_liam1
https://t.me/Henry_liam1`,
        ruleId: "earnings-promise",
      },
      {
        content:
          "Hi @everyone!\nI’m donating this DJ controller(used like New)I bought for my granddaughter. She had so much passion for Music. Sadly we lost her last year and seeing it here saddens me. It’s a Used like new Dj controller in Excellent Condition. I would love to gift it to someone who could really use it, If you you know could benefit from this, please reach out for pickup location",
        ruleId: "everyone-mention",
      },
      {
        content:
          "Hi @here\nIf you are from the U.S., Canada, Mexico, the UK, or the Netherlands, and are currently enrolled in university or have graduated within the last 7 years, there are remote part-time jobs available for you.\nPlease contact me if you are interested.\nMy Telegram ID: Rica109",
        ruleId: "here-mention",
      },
      {
        content:
          "I'll help the first 20 people interested in how to earn $100k within 72 hours but you will reimburse me 10% of your dividend when you receive it. Note: Only interested people should send me a dm! ask me HOW ! on TELEGRAM or WhatsApp @Officialruben85454\n+1 (402) 908-2540",
        ruleId: "cash-whatsapp",
      },
    ];

    for (const example of examples) {
      expect(
        matchTextRules(example.content).map((match) => match.id),
      ).toContain(example.ruleId);
    }
  });

  test("does not match nearby benign text", () => {
    for (const content of [
      "I bought a Steam game for my friend.",
      "Our remote team is hiring a designer.",
      "Telegram has usernames.",
      "Hey everyone, the meeting starts at ten.",
    ]) {
      expect(matchTextRules(content)).toEqual([]);
    }
  });
});
