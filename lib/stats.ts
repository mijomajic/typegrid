export type Bucket = {
  hour: string;
  keystrokes: number;
  clicks?: number;
  activeSeconds: number;
  sessions: number;
  devKeystrokes: number;
  peakWpm: number;
};
export function summarize(buckets: Bucket[], now = new Date()) {
  const days = new Map<string, number>();
  let keys = 0,
    clicks = 0,
    active = 0,
    sessions = 0,
    dev = 0,
    peak = 0;
  for (const b of buckets) {
    keys += b.keystrokes;
    clicks += b.clicks ?? 0;
    active += b.activeSeconds;
    sessions += b.sessions;
    dev += b.devKeystrokes;
    peak = Math.max(peak, b.peakWpm);
    days.set(
      b.hour.slice(0, 10),
      (days.get(b.hour.slice(0, 10)) || 0) + b.keystrokes,
    );
  }
  let streak = 0;
  let date = new Date(now.toISOString().slice(0, 10));
  if (!days.get(date.toISOString().slice(0, 10)))
    date.setUTCDate(date.getUTCDate() - 1);
  while (days.get(date.toISOString().slice(0, 10))) {
    streak++;
    date.setUTCDate(date.getUTCDate() - 1);
  }
  const xp = Math.floor(keys / 10),
    level = Math.floor(Math.sqrt(xp / 100)) + 1;
  return {
    keys,
    clicks,
    words: Math.floor(keys / 5),
    active,
    sessions,
    dev,
    peak,
    streak,
    xp,
    level,
    nextLevel: level * level * 100,
    record: Math.max(0, ...days.values()),
    days: Object.fromEntries(days),
  };
}
export const achievements = [
  {
    id: "first",
    name: "Hello, Grid.",
    description: "Your first 100 keystrokes.",
    target: 100,
    metric: "keys",
  },
  {
    id: "flow",
    name: "In the flow",
    description: "One hour of active typing.",
    target: 3600,
    metric: "active",
  },
  {
    id: "10k",
    name: "Getting warmed up",
    description: "10,000 keystrokes and counting.",
    target: 10000,
    metric: "keys",
  },
  {
    id: "week",
    name: "Seven-day signal",
    description: "A seven-day typing streak.",
    target: 7,
    metric: "streak",
  },
  {
    id: "code",
    name: "Builder mode",
    description: "25,000 keystrokes in dev apps.",
    target: 25000,
    metric: "dev",
  },
  {
    id: "100k",
    name: "Keyboard citizen",
    description: "100,000 keystrokes on the Grid.",
    target: 100000,
    metric: "keys",
  },
  {
    id: "month",
    name: "Always connected",
    description: "A 30-day typing streak.",
    target: 30,
    metric: "streak",
  },
  {
    id: "million",
    name: "One in a million",
    description: "One million keystrokes. All yours.",
    target: 1000000,
    metric: "keys",
  },
] as const;
