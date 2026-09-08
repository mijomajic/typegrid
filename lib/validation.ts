import { z } from "zod";
export const bucketSchema = z
  .strictObject({
    hour: z.iso
      .datetime()
      .refine(
        (s) =>
          new Date(s).getUTCMinutes() === 0 &&
          new Date(s).getUTCSeconds() === 0 &&
          new Date(s).getUTCMilliseconds() === 0,
        "Use a UTC hour boundary",
      )
      .refine(
        (s) =>
          Date.parse(s) <= Date.now() + 3600000 &&
          Date.parse(s) > Date.now() - 31 * 86400000,
        "Hour outside retention window",
      ),
    mouseActiveSeconds: z.number().min(0).max(3600).default(0),
    clicks: z.number().int().min(0).max(360000).default(0),
    keystrokes: z.number().int().min(0).max(360000),
    activeSeconds: z.number().int().min(0).max(3600),
    sessions: z.number().int().min(0).max(3600),
    devKeystrokes: z.number().int().min(0).max(360000),
    peakWpm: z.number().int().min(0).max(1200),
  })
  .refine((b) => b.devKeystrokes <= b.keystrokes, "Dev count exceeds total");
export const ingestSchema = z.strictObject({
  inputMonitoring: z.boolean().optional(),
  buckets: z.array(bucketSchema).max(48),
  codingProviders: z
    .array(z.enum(["claude", "codex", "cursor"]))
    .max(3)
    .optional(),
});
export const profileSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_-]{3,24}$/,
      "Username must be 3–24 lowercase letters, numbers, underscores or hyphens.",
    ),
  bio: z.string().max(160, "Bio must be 160 characters or fewer."),
  avatar: z
    .string()
    .max(250)
    .refine(
      (s) =>
        s === "" ||
        /^https:\/\/avatars\.githubusercontent\.com\/u\/\d+(?:\?v=\d+)?$/.test(
          s,
        ),
      "Use a GitHub avatar URL",
    ),
  isPublic: z.boolean(),
});

export const codingSchema = z.strictObject({
  streamId: z.uuid(),
  buckets: z
    .array(
      z.strictObject({
        hour: z.iso.datetime().refine((s) => {
          const d = Date.parse(s);
          return (
            d % 3600000 === 0 &&
            d >= Date.now() - 31 * 86400000 &&
            d <= Date.now() + 3600000
          );
        }),
        provider: z.enum(["claude", "codex", "cursor"]),
        tokens: z.number().int().min(0).max(1000000000),
        workSeconds: z.number().min(0).max(864000),
      }),
    )
    .max(48),
});
