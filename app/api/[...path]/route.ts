import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  body,
  checkOrigin,
  createSession,
  device,
  getUser,
  hash,
  HttpError,
  origin,
  publicUser,
  randomUUID,
  rate,
  requireUser,
  token,
  userBuckets,
} from "@/lib/server";
import { ingestSchema, profileSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/"),
      url = new URL(req.url),
      method = req.method;
    if (path === "health") return json({ ok: true, service: "typegrid" });
    if (path === "auth/github" && method === "GET") {
      if (!process.env.GITHUB_CLIENT_ID)
        throw new HttpError(
          503,
          "GitHub sign-in is being configured. Please check back shortly.",
        );
      const state = token(),
        verifier = token(),
        jar = await cookies();
      for (const [name, value] of [
        ["tg_state", state],
        ["tg_verifier", verifier],
      ])
        jar.set(name, value, {
          httpOnly: true,
          secure: origin().startsWith("https:"),
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });
      const auth = new URL("https://github.com/login/oauth/authorize");
      auth.search = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: origin() + "/api/auth/callback",
        scope: "read:user",
        state,
        code_challenge: Buffer.from(hash(verifier), "hex").toString(
          "base64url",
        ),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.redirect(auth);
    }
    if (path === "auth/callback" && method === "GET") {
      const jar = await cookies(),
        state = jar.get("tg_state")?.value,
        verifier = jar.get("tg_verifier")?.value;
      jar.delete("tg_state");
      jar.delete("tg_verifier");
      if (
        !state ||
        state !== url.searchParams.get("state") ||
        !verifier ||
        !url.searchParams.get("code")
      )
        throw new HttpError(
          400,
          "Sign-in expired or was cancelled. Start again from Connect.",
        );
      const response = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: url.searchParams.get("code"),
            code_verifier: verifier,
            redirect_uri: origin() + "/api/auth/callback",
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      const auth = await response.json();
      if (!response.ok || !auth.access_token)
        throw new HttpError(401, "GitHub sign-in failed. Please try again.");
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: "Bearer " + auth.access_token,
          "User-Agent": "TypeGrid",
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!userRes.ok)
        throw new HttpError(502, "GitHub is temporarily unavailable");
      const gh = await userRes.json();
      const id = randomUUID(),
        base = String(gh.login)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "")
          .slice(0, 15)
          .padEnd(3, "_");
      const users =
        await db()`INSERT INTO users(id,github_id,github_login,username,avatar) VALUES(${id},${String(gh.id)},${gh.login},${base + "-" + String(gh.id).slice(-6)},${gh.avatar_url}) ON CONFLICT(github_id) DO UPDATE SET github_login=excluded.github_login RETURNING id`;
      // The OAuth token is intentionally never persisted.
      await createSession(users[0].id);
      await db()`DELETE FROM sessions WHERE expires_at<now()`;
      return NextResponse.redirect(origin() + "/dashboard");
    }
    if (
      path === "auth/local" &&
      method === "POST" &&
      process.env.NODE_ENV !== "production" &&
      process.env.LOCAL_DEMO_AUTH === "1"
    ) {
      checkOrigin(req);
      const id = randomUUID();
      const users =
        await db()`INSERT INTO users(id,github_id,github_login,username) VALUES(${id},'local-test','local-test','local-test') ON CONFLICT(github_id) DO UPDATE SET github_login=excluded.github_login RETURNING id`;
      await createSession(users[0].id);
      return json({ ok: true });
    }
    if (path === "me" && method === "GET") {
      const u = await getUser();
      if (!u) return json({ user: null, buckets: [], devices: [] });
      const [buckets, devices] = await Promise.all([
        userBuckets(u.id),
        db()`SELECT id,name,last_seen AS "lastSeen" FROM devices WHERE user_id=${u.id} AND revoked=false ORDER BY created_at`,
      ]);
      return json({
        user: publicUser(u),
        buckets,
        devices,
        github: u.github_stats,
      });
    }
    if (path.startsWith("profile/") && method === "GET") {
      const username = path.split("/")[1];
      const users =
        await db()`SELECT * FROM users WHERE username=${username} AND is_public=true`;
      if (!users[0]) return json({ user: null, buckets: [], devices: [] }, 404);
      const u = users[0];
      const buckets = await userBuckets(u.id, true);
      return json({
        user: {
          username: u.username,
          avatar: u.avatar,
          bio: u.bio,
          isPublic: true,
        },
        buckets: buckets.map((b) => ({
          hour: b.hour,
          keystrokes: b.keystrokes,
          activeSeconds: 0,
          sessions: 0,
          devKeystrokes: b.devKeystrokes,
          peakWpm: 0,
        })),
        devices: [],
      });
    }
    if (path === "leaderboard" && method === "GET") {
      const period = url.searchParams.get("period") || "week";
      if (!["day", "week", "month", "all"].includes(period))
        throw new HttpError(400, "Invalid period");
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      if (period === "week")
        start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      if (period === "month") start.setUTCDate(1);
      if (period === "all") start.setTime(0);
      const rows =
        await db()`SELECT u.username,SUM(b.keystrokes)::bigint AS keystrokes FROM users u JOIN devices d ON d.user_id=u.id JOIN buckets b ON b.device_id=d.id WHERE u.is_public=true AND b.hour>=${start.toISOString()} GROUP BY u.id HAVING SUM(b.keystrokes)>0 ORDER BY SUM(b.keystrokes) DESC,u.username LIMIT 100`;
      return json({
        rows: rows.map((r) => ({
          username: r.username,
          keystrokes: Number(r.keystrokes),
          level:
            Math.floor(Math.sqrt(Math.floor(Number(r.keystrokes) / 10) / 100)) +
            1,
        })),
      });
    }
    if (path === "devices/start" && method === "POST") {
      const ip = hash(
        req.headers.get("x-vercel-forwarded-for") ||
          req.headers.get("x-forwarded-for") ||
          "local",
      );
      await rate("pair-start:" + ip, 10, 600);
      await db()`DELETE FROM pairing WHERE expires_at<now()`;
      const secret = token(),
        code = token()
          .replace(/[^A-Z]/gi, "")
          .slice(0, 8)
          .toUpperCase();
      await db()`INSERT INTO pairing(secret_hash,code,expires_at) VALUES(${hash(secret)},${code},now()+interval '10 minutes')`;
      return json({
        secret,
        code: code.slice(0, 4) + "-" + code.slice(4),
        verificationUrl: origin() + "/connect",
        expiresIn: 600,
      });
    }
    if (path === "devices/poll" && method === "POST") {
      const { secret } = z
        .strictObject({ secret: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
        .parse(await body(req));
      await rate("poll:" + hash(secret), 15, 60);
      const result = await db().begin(async (tx) => {
        const rows =
          await tx`SELECT * FROM pairing WHERE secret_hash=${hash(secret)} AND expires_at>now() FOR UPDATE`;
        if (!rows[0])
          throw new HttpError(410, "Pairing expired. Run typegrid pair again.");
        if (!rows[0].user_id) return null;
        const id = randomUUID(),
          credential = token();
        await tx`INSERT INTO devices(id,user_id,token_hash,name) VALUES(${id},${rows[0].user_id},${hash(credential)},'Mac')`;
        await tx`DELETE FROM pairing WHERE secret_hash=${hash(secret)}`;
        return { deviceId: id, token: credential };
      });
      return json(result || { pending: true });
    }
    if (path === "ingest" && method === "POST") {
      const d = await device(req),
        payload = ingestSchema.parse(await body(req));
      await db().begin(async (tx) => {
        for (const b of payload.buckets)
          await tx`INSERT INTO buckets(device_id,hour,keystrokes,active_seconds,sessions,dev_keystrokes,peak_wpm) VALUES(${d.id},${b.hour},${b.keystrokes},${b.activeSeconds},${b.sessions},${b.devKeystrokes},${b.peakWpm}) ON CONFLICT(device_id,hour) DO UPDATE SET keystrokes=GREATEST(buckets.keystrokes,excluded.keystrokes),active_seconds=GREATEST(buckets.active_seconds,excluded.active_seconds),sessions=GREATEST(buckets.sessions,excluded.sessions),dev_keystrokes=GREATEST(buckets.dev_keystrokes,excluded.dev_keystrokes),peak_wpm=GREATEST(buckets.peak_wpm,excluded.peak_wpm)`;
        await tx`UPDATE devices SET last_seen=now() WHERE id=${d.id}`;
      });
      return json({ ok: true });
    }
    // All remaining mutations require a browser session and matching Origin.
    const u = await requireUser();
    if (method !== "GET") checkOrigin(req);
    await rate("user:" + u.id, 120, 60);
    if (path === "devices/approve" && method === "POST") {
      const { code } = z
        .strictObject({ code: z.string().min(8).max(9) })
        .parse(await body(req));
      await rate("approve:" + u.id, 10, 600);
      const count =
        await db()`SELECT count(*)::integer AS n FROM devices WHERE user_id=${u.id} AND revoked=false`;
      if (count[0].n >= 10)
        throw new HttpError(
          400,
          "Revoke a device before adding more than 10 machines.",
        );
      const rows =
        await db()`UPDATE pairing SET user_id=${u.id} WHERE code=${code.replace("-", "").toUpperCase()} AND expires_at>now() AND user_id IS NULL RETURNING code`;
      if (!rows.length)
        throw new HttpError(
          400,
          "Code expired or already used. Check the code shown by your agent.",
        );
      return json({ ok: true });
    }
    if (path === "profile" && method === "PATCH") {
      const p = profileSchema.parse(await body(req));
      await db()`UPDATE users SET username=${p.username},avatar=${p.avatar},bio=${p.bio},is_public=${p.isPublic} WHERE id=${u.id}`;
      return json({ ok: true });
    }
    if (path.startsWith("devices/") && method === "DELETE") {
      const id = z.uuid().parse(path.split("/")[1]);
      await db()`UPDATE devices SET revoked=true WHERE id=${id} AND user_id=${u.id}`;
      return json({ ok: true });
    }
    if (path === "auth/logout" && method === "POST") {
      const jar = await cookies();
      const value = jar.get("tg_session")?.value;
      if (value)
        await db()`DELETE FROM sessions WHERE token_hash=${hash(value)}`;
      jar.delete("tg_session");
      return json({ ok: true });
    }
    if (path === "account" && method === "DELETE") {
      await db()`DELETE FROM users WHERE id=${u.id}`;
      (await cookies()).delete("tg_session");
      return json({ ok: true });
    }
    if (path === "export" && method === "GET") {
      const [buckets, devices] = await Promise.all([
        userBuckets(u.id),
        db()`SELECT id,name,last_seen FROM devices WHERE user_id=${u.id}`,
      ]);
      return new NextResponse(
        JSON.stringify(
          { profile: publicUser(u), buckets, devices, github: u.github_stats },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition":
              'attachment; filename="typegrid-export.json"',
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (path === "github/sync" && method === "POST") {
      if (
        u.github_stats?.updatedAt &&
        Date.now() - Date.parse(u.github_stats.updatedAt) < 300000
      )
        throw new HttpError(
          429,
          "GitHub stats were refreshed recently. Try again in five minutes.",
        );
      const headers = {
        "User-Agent": "TypeGrid",
        Accept: "application/vnd.github+json",
      };
      const r = await fetch(
        "https://api.github.com/users/" + encodeURIComponent(u.github_login),
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!r.ok)
        throw new HttpError(
          502,
          "GitHub is temporarily unavailable. Try again later.",
        );
      const gh = await r.json();
      // Public events only; no scraping, private repo scopes, or retained OAuth tokens.
      const eventsRes = await fetch(
        "https://api.github.com/users/" +
          encodeURIComponent(u.github_login) +
          "/events/public?per_page=100",
        { headers, signal: AbortSignal.timeout(10000) },
      );
      const events = eventsRes.ok ? await eventsRes.json() : [];
      const stats = {
        repos: gh.public_repos,
        followers: gh.followers,
        contributions: events.length,
        updatedAt: new Date().toISOString(),
      };
      await db()`UPDATE users SET github_stats=${db().json(stats)} WHERE id=${u.id}`;
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error:
            "Invalid data. Only the documented aggregate fields are accepted.",
          details: e.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        400,
      );
    if ((e as { code?: string }).code === "23505")
      return json(
        {
          error:
            "That username or pairing code is already taken. Please try again.",
        },
        409,
      );
    console.error(
      "TypeGrid request failed:",
      e instanceof Error ? e.name : "UnknownError",
    );
    return json(
      { error: "Service temporarily unavailable. Please try again." },
      503,
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
