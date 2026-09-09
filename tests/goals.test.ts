import test from "node:test";
import assert from "node:assert/strict";
import { goalsUpdateSchema, goalPresets, goalProgress } from "../lib/goals.ts";

test("presets are valid targets and Hard is 20k / 3k", () => {
  for (const { keystrokes, clicks } of goalPresets) assert.ok(goalsUpdateSchema.safeParse({ goals: { keystrokes, clicks } }).success);
  assert.equal(goalPresets[2].keystrokes, 20000);
  assert.equal(goalPresets[2].clicks, 3000);
});
test("each target must be reached; progress never rounds up early", () => {
  const goals = { keystrokes: 20000, clicks: 3000 };
  assert.equal(goalProgress(goals, 0, 0).percent, 0);
  assert.equal(goalProgress(goals, 10000, 1500).percent, 50);
  assert.equal(goalProgress(goals, 100000, 0).percent, 50);
  assert.equal(goalProgress(goals, 20000, 2999).percent, 99);
  assert.equal(goalProgress(goals, 19999, 3000).complete, false);
  assert.deepEqual(goalProgress(goals, 30000, 4000), { keys: 1, clicks: 1, percent: 100, complete: true });
});
test("goal changes reject missing, invalid and extra fields", () => {
  for (const goals of [{}, { keystrokes: 10 }, { keystrokes: 0, clicks: 1 }, { keystrokes: 1, clicks: -1 }, { keystrokes: 1.5, clicks: 1 }, { keystrokes: 1000001, clicks: 1 }, { keystrokes: "20000", clicks: 3000 }, { keystrokes: 1, clicks: 1, text: "no" }]) {
    assert.equal(goalsUpdateSchema.safeParse({ goals }).success, false);
  }
  assert.equal(goalsUpdateSchema.safeParse({ goals: null, userId: "another-user" }).success, false);
  assert.ok(goalsUpdateSchema.safeParse({ goals: null }).success);
});
