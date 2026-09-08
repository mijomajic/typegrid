import { z } from "zod";
import { createHash } from "node:crypto";
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const desktopStartSchema = z.strictObject({ challenge: secret });
export const desktopExchangeSchema = z.strictObject({
  request: secret,
  verifier: secret,
});
export const desktopChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");
