import { z } from "zod";

export const dailyGoalsSchema = z.strictObject({
  keystrokes: z.number().int().min(1).max(1000000),
  clicks: z.number().int().min(1).max(1000000),
});
export const goalsUpdateSchema = z.strictObject({
  goals: dailyGoalsSchema.nullable(),
});
export type DailyGoals = z.infer<typeof dailyGoalsSchema>;
export const goalPresets = [
  {
    name: "Easy",
    description: "A little everyday momentum.",
    keystrokes: 5000,
    clicks: 750,
  },
  {
    name: "Medium",
    description: "Find your daily rhythm.",
    keystrokes: 10000,
    clicks: 1500,
  },
  {
    name: "Hard",
    description: "Make it a big day.",
    keystrokes: 20000,
    clicks: 3000,
  },
] as const;

// Each target contributes half. Extra keystrokes cannot fill the click goal.
export function goalProgress(
  goals: DailyGoals,
  keystrokes: number,
  clicks: number,
) {
  const keys = Math.min(1, Math.max(0, keystrokes) / goals.keystrokes);
  const mouse = Math.min(1, Math.max(0, clicks) / goals.clicks);
  return {
    keys,
    clicks: mouse,
    percent: Math.floor((keys + mouse) * 50),
    complete: keys === 1 && mouse === 1,
  };
}
