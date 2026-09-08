import { afterEach, expect, test } from "bun:test";
import { setLogLevel, writeLog } from "../src/logging";

afterEach(() => setLogLevel("info"));

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

test("log level filters less severe events", () => {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (line) => lines.push(String(line));
  console.warn = (line) => lines.push(String(line));
  try {
    setLogLevel("warn");
    writeLog("debug", "debug.hidden");
    writeLog("info", "info.hidden");
    writeLog("warn", "warn.visible");
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }

  expect(lines.map((line) => JSON.parse(line).event)).toEqual([
    "warn.visible",
  ]);
});
