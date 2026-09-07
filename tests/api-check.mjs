// Disposable local account; exercises the real database and HTTP handlers.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000";
let cookie = "";
async function call(path, body, method = "POST", extra = {}) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  return { status: r.status, data: await r.json() };
}
assert.equal((await call("auth/local", {})).status, 200);
try {
  let me = await call("me", undefined, "GET");
  assert.equal(me.data.user.isPublic, false);
  const start = (await call("devices/start", {})).data;
  assert.equal(
    (await call("devices/poll", { secret: start.secret })).data.pending,
    true,
  );
  assert.equal(
    (await call("devices/approve", { code: start.code })).status,
    200,
  );
  const device = (await call("devices/poll", { secret: start.secret })).data;
  assert.ok(device.token);
  assert.equal(
    (await call("devices/poll", { secret: start.secret })).status,
    410,
  );
  const hour = new Date();
  hour.setUTCMinutes(0, 0, 0);
  const b = {
    hour: hour.toISOString(),
    keystrokes: 140,
    activeSeconds: 30,
    sessions: 1,
    devKeystrokes: 90,
    peakWpm: 28,
  };
  const auth = { Authorization: "Bearer " + device.token };
  assert.equal(
    (await call("ingest", { buckets: [b] }, "POST", auth)).status,
    200,
  );
  assert.equal(
    (await call("ingest", { buckets: [b] }, "POST", auth)).status,
    200,
  );
  assert.equal(
    (
      await call(
        "ingest",
        { buckets: [{ ...b, keystrokes: 100 }] },
        "POST",
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "ingest",
        { buckets: [{ ...b, text: "must reject" }] },
        "POST",
        auth,
      )
    ).status,
    400,
  );
  me = await call("me", undefined, "GET");
  assert.equal(
    me.data.buckets.reduce((n, b) => n + b.keystrokes, 0),
    140,
  );
  let lb = await call("leaderboard?period=all", undefined, "GET");
  assert.ok(!lb.data.rows.some((r) => r.username === "local-test"));
  const profile = {
    username: "local-test",
    avatar: "",
    bio: "Disposable verification account",
    isPublic: true,
  };
  assert.equal(
    (
      await call("profile", profile, "PATCH", {
        Origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal((await call("profile", profile, "PATCH")).status, 200);
  lb = await call("leaderboard?period=all", undefined, "GET");
  assert.ok(
    lb.data.rows.some(
      (r) => r.username === "local-test" && r.keystrokes === 140,
    ),
  );
  const pub = await call("profile/local-test", undefined, "GET");
  assert.equal(pub.data.buckets[0].sessions, 0);
  assert.equal(pub.data.devices.length, 0);
  assert.ok(pub.data.buckets[0].hour.includes("T00:00:00"));
  assert.equal(
    (await call("devices/" + device.deviceId, {}, "DELETE")).status,
    200,
  );
  assert.equal(
    (await call("ingest", { buckets: [] }, "POST", auth)).status,
    401,
  );
  me = await call("me", undefined, "GET");
  assert.equal(me.data.buckets[0].keystrokes, 140);
  const exported = await call("export", undefined, "GET");
  assert.equal(exported.status, 200);
  assert.equal(JSON.stringify(exported.data).includes(device.token), false);
  console.log(
    "PASS: pairing, replay safety, rejection of content, CSRF, privacy, leaderboard, revocation, export",
  );
} finally {
  assert.equal((await call("account", {}, "DELETE")).status, 200);
  console.log("Disposable account deleted.");
}
