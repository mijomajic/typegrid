// Only disposable local databases: verifies real authorization and goal sync.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
const base = process.env.TYPEGRID_TEST_URL;
const database = process.env.DATABASE_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.ok(database && ["127.0.0.1", "localhost"].includes(new URL(database).hostname));
const sql = postgres(database, { max: 1 });
const hash = value => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const owner = randomUUID(), stranger = randomUUID();
const ownerSession = token(), strangerSession = token();
const macA = { id: randomUUID(), token: token() }, macB = { id: randomUUID(), token: token() }, macC = { id: randomUUID(), token: token() };
const username = "goals-" + owner.slice(0, 8);
const hard = { keystrokes: 20000, clicks: 3000 };
const cookie = { Cookie: "tg_session=" + ownerSession };
const auth = { Authorization: "Bearer " + macA.token };
async function call(path, data, method = "GET", headers = {}) {
  const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", Origin: base, ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
  return { status: r.status, data: await r.json() };
}
try {
  for (const [id, session] of [[owner, ownerSession], [stranger, strangerSession]]) {
    await sql`INSERT INTO users(id,github_id,github_login,username,is_public,onboarding_ready) VALUES(${id},${id},'goals-test',${id === owner ? username : "goals-" + stranger.slice(0,8)},false,true)`;
    await sql`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(${hash(session)},${id},now()+interval '1 hour')`;
  }
  for (const [mac, id] of [[macA, owner], [macB, owner], [macC, stranger]]) await sql`INSERT INTO devices(id,user_id,token_hash) VALUES(${mac.id},${id},${hash(mac.token)})`;
  assert.equal((await call("goals", { goals: hard }, "PATCH")).status, 401);
  assert.equal((await call("goals", { goals: hard }, "PATCH", auth)).status, 401);
  assert.equal((await call("goals", { goals: hard }, "PATCH", { ...cookie, Origin: "https://untrusted.example" })).status, 403);
  assert.equal((await call("goals", { goals: hard, userId: stranger }, "PATCH", cookie)).status, 400);
  assert.equal((await call("goals", { goals: { ...hard, clicks: 0 } }, "PATCH", cookie)).status, 400);
  assert.deepEqual((await call("goals", { goals: hard }, "PATCH", cookie)).data.goals, hard);
  let me = (await call("me", undefined, "GET", cookie)).data;
  assert.deepEqual(me.goals, hard);
  assert.equal(me.user.isPublic, false);
  assert.equal((await call("me", undefined, "GET", { Cookie: "tg_session=" + strangerSession })).data.goals, null);
  assert.equal((await call("me")).data.goals, undefined);

  const hour = new Date(); hour.setUTCMinutes(0, 0, 0);
  const bucket = (keys, clicks, date = hour) => ({ hour: date.toISOString(), keystrokes: keys, clicks, activeSeconds: 0, sessions: 0, devKeystrokes: 0, peakWpm: 0 });
  for (const [mac, keys, clicks] of [[macA, 1000, 100], [macB, 2000, 200], [macC, 9000, 900]]) {
    assert.equal((await call("ingest", { buckets: [bucket(keys, clicks)] }, "POST", { Authorization: "Bearer " + mac.token })).status, 200);
  }
  const yesterday = new Date(hour); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  await call("ingest", { buckets: [bucket(8000, 800, yesterday)] }, "POST", { Authorization: "Bearer " + macB.token });
  const sync = await call("ingest", { buckets: [bucket(1000, 100)], goalSync: true }, "POST", auth);
  assert.equal(sync.status, 200);
  assert.deepEqual(sync.data.goalState.goals, hard);
  assert.equal(sync.data.goalState.deviceId, macA.id);
  assert.deepEqual(sync.data.goalState.otherDevices, { day: hour.toISOString().slice(0, 10), keystrokes: 2000, clicks: 200 });
  assert.deepEqual((await call("ingest", { buckets: [] }, "POST", auth)).data, { ok: true });
  assert.equal((await call("profile/" + username)).status, 404);
  await sql`UPDATE users SET is_public=true WHERE id=${owner}`;
  const publicProfile = (await call("profile/" + username)).data;
  assert.equal(publicProfile.goals, undefined);
  assert.equal(publicProfile.user.goals, undefined);
  assert.deepEqual((await call("export", undefined, "GET", cookie)).data.goals, hard);
  const myProfile = await fetch(base + "/app/profile", { headers: cookie, redirect: "manual" });
  assert.equal(myProfile.headers.get("location"), "/u/" + username);
  assert.equal((await call("goals", { goals: null }, "PATCH", cookie)).status, 200);
  assert.equal((await call("ingest", { buckets: [], goalSync: true }, "POST", auth)).data.goalState.goals, null);
  await sql`UPDATE devices SET revoked=true WHERE id=${macA.id}`;
  assert.equal((await call("ingest", { buckets: [], goalSync: true }, "POST", auth)).status, 401);
  console.log("PASS: goal authorization, CSRF, validation, privacy, export, profile navigation, multi-device sync, UTC boundaries, old clients and revoked devices");
} finally {
  await sql`DELETE FROM users WHERE id IN (${owner},${stranger})`;
  await sql.end();
}
