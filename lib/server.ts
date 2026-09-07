import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import type { Bucket } from "./stats";
export const origin = () => process.env.APP_URL || "http://localhost:3000";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function getUser() {
  const jar = await cookies();
  const session = jar.get("tg_session")?.value;
  if (!session) return null;
  const rows =
    await db()`SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=${hash(session)} AND s.expires_at>now()`;
  return rows[0] || null;
}
export async function requireUser() {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Sign in with GitHub to continue.");
  return u;
}
export async function createSession(id: string) {
  const value = token();
  await db()`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(${hash(value)},${id},now()+interval '30 days')`;
  const jar = await cookies();
  jar.set("tg_session", value, {
    httpOnly: true,
    secure: origin().startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
}
export function publicUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    bio: u.bio,
    isPublic: u.is_public,
    githubLogin: u.github_login,
    githubConnected: !!u.github_stats,
  };
}
export async function userBuckets(id: string, daily = false) {
  const rows =
    await db()`SELECT ${daily ? db()`date_trunc('day',b.hour)` : db()`b.hour`} AS hour, SUM(b.keystrokes)::integer AS keystrokes, SUM(b.active_seconds)::integer AS "activeSeconds", SUM(b.sessions)::integer AS sessions, SUM(b.dev_keystrokes)::integer AS "devKeystrokes", MAX(b.peak_wpm)::integer AS "peakWpm" FROM buckets b JOIN devices d ON b.device_id=d.id WHERE d.user_id=${id} GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    hour: new Date(r.hour).toISOString(),
    keystrokes: Number(r.keystrokes),
    activeSeconds: Number(r.activeSeconds),
    sessions: Number(r.sessions),
    devKeystrokes: Number(r.devKeystrokes),
    peakWpm: Number(r.peakWpm),
  })) as Bucket[];
}
export function checkOrigin(req: Request) {
  if (req.headers.get("origin") !== origin())
    throw new HttpError(403, "Cross-origin request rejected.");
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 32000)
    throw new HttpError(413, "Request too large");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use application/json");
  const text = await req.text();
  if (text.length > 32000) throw new HttpError(413, "Request too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export async function rate(key: string, max: number, seconds: number) {
  const rows =
    await db()`INSERT INTO rate_limits(key,count,expires_at) VALUES(${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING count`;
  if (rows[0].count > max)
    throw new HttpError(429, "Too many requests. Please wait a minute.");
  if (Math.random() < 0.01)
    await db()`DELETE FROM rate_limits WHERE expires_at<now()`;
}
export async function device(req: Request) {
  const bearer = req.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(bearer))
    throw new HttpError(401, "Invalid device credential");
  const rows =
    await db()`SELECT * FROM devices WHERE token_hash=${hash(bearer.slice(7))} AND revoked=false`;
  if (!rows[0]) throw new HttpError(401, "Device revoked or not paired");
  await rate("device:" + rows[0].id, 30, 60);
  return rows[0];
}
export { randomUUID };
