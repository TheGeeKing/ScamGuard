import { expect, test } from "bun:test";
import { writeLog } from "../src/logging";

test("operational logs are structured JSON with selected metadata", () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    writeLog("info", "assessment.completed", {
      guildId: "guild-1",
      score: 100,
    });
  } finally {
    console.log = original;
  }

  expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
    level: "info",
    event: "assessment.completed",
    guildId: "guild-1",
    score: 100,
  });
});
