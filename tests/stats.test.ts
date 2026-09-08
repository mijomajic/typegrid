import test from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../lib/stats.ts";
import { ingestSchema } from "../lib/validation.ts";
const hour = new Date();
hour.setUTCMinutes(0, 0, 0);
const bucket = {
  hour: hour.toISOString(),
  keystrokes: 100,
  activeSeconds: 20,
  sessions: 1,
  devKeystrokes: 70,
  peakWpm: 20,
};
test("ingestion rejects content, unknown metadata, invalid bounds and non-hour times", () => {
  assert.equal(ingestSchema.safeParse({ buckets: [bucket] }).success, true);
  for (const extra of [
    { text: "secret" },
    { keyCodes: [23] },
    { windowTitle: "private" },
    { url: "https://private" },
  ])
    assert.equal(
      ingestSchema.safeParse({ buckets: [{ ...bucket, ...extra }] }).success,
      false,
    );
  assert.equal(
    ingestSchema.safeParse({ buckets: [{ ...bucket, devKeystrokes: 101 }] })
      .success,
    false,
  );
  assert.equal(
    ingestSchema.safeParse({ buckets: [{ ...bucket, keystrokes: -1 }] })
      .success,
    false,
  );
  assert.equal(
    ingestSchema.safeParse({
      buckets: [
        { ...bucket, hour: new Date(hour.getTime() + 1).toISOString() },
      ],
    }).success,
    false,
  );
  assert.equal(
    ingestSchema.safeParse({ buckets: [bucket], text: "no" }).success,
    false,
  );
});
test("words, XP, streaks and records derive only from counters", () => {
  const today = new Date("2026-09-07T12:00:00Z");
  const result = summarize(
    [
      { ...bucket, hour: "2026-09-07T10:00:00Z" },
      { ...bucket, hour: "2026-09-06T10:00:00Z" },
      { ...bucket, hour: "2026-09-04T10:00:00Z" },
    ],
    today,
  );
  assert.equal(result.keys, 300);
  assert.equal(result.words, 60);
  assert.equal(result.streak, 2);
  assert.equal(result.record, 100);
  assert.equal(result.xp, 30);
  assert.equal(summarize([], today).streak, 0);
  assert.equal(
    summarize([{ ...bucket, hour: "2026-09-06T10:00:00Z" }], today).streak,
    1,
  );
});

test("agent status accepts only supported provider names and remains backward compatible", () => {
  for (const codingProviders of [
    undefined,
    [],
    ["codex"],
    ["claude", "codex", "cursor"],
  ])
    assert.equal(
      ingestSchema.safeParse({ buckets: [], codingProviders }).success,
      true,
    );
  for (const codingProviders of [
    ["unknown"],
    ["codex", "codex", "codex", "codex"],
    [{ provider: "codex", prompt: "private" }],
  ])
    assert.equal(
      ingestSchema.safeParse({ buckets: [], codingProviders }).success,
      false,
    );
});

test("permission heartbeat contains only a boolean", () => {
  assert.equal(
    ingestSchema.safeParse({ buckets: [], inputMonitoring: true }).success,
    true,
  );
  assert.equal(
    ingestSchema.safeParse({ buckets: [], inputMonitoring: "allowed" }).success,
    false,
  );
});

test("click ingestion accepts legacy agents and rejects mouse metadata and invalid counts", () => {
  assert.equal(ingestSchema.parse({ buckets: [bucket] }).buckets[0].clicks, 0);
  assert.equal(
    ingestSchema.parse({ buckets: [{ ...bucket, clicks: 42 }] }).buckets[0]
      .clicks,
    42,
  );
  for (const clicks of [-1, 360001, 1.5, "2", null])
    assert.equal(
      ingestSchema.safeParse({ buckets: [{ ...bucket, clicks }] }).success,
      false,
    );
  for (const extra of [
    { x: 10, y: 20 },
    { button: 0 },
    { target: "private" },
    { coordinates: [10, 20] },
  ])
    assert.equal(
      ingestSchema.safeParse({ buckets: [{ ...bucket, clicks: 1, ...extra }] })
        .success,
      false,
    );
});

test("clicks aggregate across buckets without changing typing metrics", () => {
  const baseline = summarize([bucket, bucket]);
  const mixed = summarize([
    { ...bucket, clicks: 42 },
    { ...bucket, clicks: 8 },
  ]);
  assert.equal(mixed.clicks, 50);
  assert.deepEqual({ ...mixed, clicks: 0 }, baseline);
  const clickOnly = summarize([
    {
      ...bucket,
      keystrokes: 0,
      clicks: 100,
      activeSeconds: 0,
      sessions: 0,
      devKeystrokes: 0,
      peakWpm: 0,
    },
  ]);
  assert.equal(clickOnly.clicks, 100);
  assert.equal(clickOnly.streak, 0);
  assert.equal(clickOnly.words, 0);
  assert.equal(clickOnly.xp, 0);
});
