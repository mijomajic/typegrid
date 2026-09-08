// Disposable local account; exercises the real database and HTTP handlers.
import assert from "node:assert/strict";
const base = process.env.TYPEGRID_TEST_URL || "http://127.0.0.1:3000";
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
  assert.equal(me.data.user.isPublic, true);
  assert.equal(me.data.user.onboardingReady, false);
  assert.equal(
    (await call("devices/approve", { code: "ABCDEFGH" })).status,
    409,
  );
  assert.equal(
    (
      await call(
        "profile",
        { username: "local-test", avatar: "", bio: "", isPublic: false },
        "PATCH",
      )
    ).status,
    200,
  );
  me = await call("me", undefined, "GET");
  assert.equal(me.data.user.isPublic, false);
  assert.equal(me.data.user.onboardingReady, true);
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
    clicks: 35,
    activeSeconds: 30,
    sessions: 1,
    devKeystrokes: 90,
    peakWpm: 28,
  };
  const auth = { Authorization: "Bearer " + device.token };
  assert.equal(
    (
      await call(
        "ingest",
        { buckets: [], codingProviders: ["codex"], inputMonitoring: true },
        "POST",
        auth,
      )
    ).status,
    200,
  );
  assert.deepEqual((await call("coding", undefined, "GET")).data.connections, [
    { provider: "codex", online: true },
  ]);
  await call("ingest", { buckets: [] }, "POST", auth);
  assert.equal(
    (await call("coding", undefined, "GET")).data.connections.length,
    1,
  );
  await call("ingest", { buckets: [], codingProviders: [] }, "POST", auth);
  assert.deepEqual(
    (await call("coding", undefined, "GET")).data.connections,
    [],
  );
  await call(
    "ingest",
    { buckets: [], codingProviders: ["codex"] },
    "POST",
    auth,
  );
  const coding = {
    streamId: "11111111-1111-4111-8111-111111111111",
    buckets: [
      { hour: b.hour, provider: "claude", tokens: 1234, workSeconds: 42 },
    ],
  };
  assert.equal((await call("coding/ingest", coding, "POST", auth)).status, 200);
  assert.equal((await call("coding/ingest", coding, "POST", auth)).status, 200);
  assert.equal(
    (
      await call(
        "coding/ingest",
        { ...coding, prompt: "rejected" },
        "POST",
        auth,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("coding", undefined, "GET")).data.rows[0].tokens,
    1234,
  );
  const cursor = {
    streamId: "22222222-2222-4222-8222-222222222222",
    buckets: [
      { hour: b.hour, provider: "cursor", tokens: 0, workSeconds: 120 },
    ],
  };
  assert.equal((await call("coding/ingest", cursor, "POST", auth)).status, 200);
  assert.equal((await call("coding/ingest", cursor, "POST", auth)).status, 200);
  const cursorRow = (await call("coding", undefined, "GET")).data.rows.find(
    (r) => r.provider === "cursor",
  );
  assert.equal(cursorRow.tokens, 0);
  assert.equal(cursorRow.seconds, 120);
  assert.equal(
    (await call("coding?username=local-test", undefined, "GET")).data.rows
      .length,
    0,
  );

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
  assert.equal(
    me.data.buckets.reduce((n, b) => n + b.clicks, 0),
    35,
  );
  // A legacy retry without click counts must not erase newer click totals.
  const { clicks, ...legacyBucket } = b;
  assert.equal(
    (await call("ingest", { buckets: [legacyBucket] }, "POST", auth)).status,
    200,
  );
  assert.equal(
    (await call("me", undefined, "GET")).data.buckets.reduce(
      (n, b) => n + b.clicks,
      0,
    ),
    35,
  );
  const privateClicks = await call(
    "leaderboard?period=all&metric=clicks",
    undefined,
    "GET",
  );
  assert.equal(privateClicks.status, 200);
  assert.ok(!privateClicks.data.rows.some((r) => r.username === "local-test"));
  assert.equal(
    (await call("leaderboard?metric=unknown", undefined, "GET")).status,
    400,
  );
  let lb = await call("leaderboard?period=all", undefined, "GET");
  assert.ok(!lb.data.rows.some((r) => r.username === "local-test"));
  const privateOwn = await call("profile/local-test", undefined, "GET");
  assert.equal(privateOwn.status, 200);
  assert.equal(privateOwn.data.detailed, true);
  const privatePreview = await call(
    "profile/local-test?view=public",
    undefined,
    "GET",
  );
  assert.equal(privatePreview.status, 200);
  assert.equal(privatePreview.data.detailed, false);
  const savedCookie = cookie;
  cookie = "";
  assert.equal(
    (await call("profile/local-test", undefined, "GET")).status,
    404,
  );
  cookie = savedCookie;
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
  const invalidProfile = await call(
    "profile",
    { ...profile, username: "@Bad Name" },
    "PATCH",
  );
  assert.equal(invalidProfile.status, 400);
  assert.match(invalidProfile.data.error, /Username must be/);
  assert.equal((await call("me", undefined, "GET")).data.user.isPublic, false);
  assert.equal((await call("profile", profile, "PATCH")).status, 200);
  assert.equal(
    (await call("profile", { ...profile, username: "Local-Test" }, "PATCH"))
      .status,
    200,
  );
  assert.equal(
    (await call("profile/LOCAL-TEST", undefined, "GET")).status,
    200,
  );
  assert.equal(
    (await call("coding?username=LOCAL-TEST", undefined, "GET")).data.rows.find(
      (r) => r.provider === "claude",
    ).tokens,
    1234,
  );
  assert.equal(
    (
      await call("leaderboard?period=all&metric=tokens", undefined, "GET")
    ).data.rows.find((r) => r.username === "local-test").keystrokes,
    1234,
  );
  const savedProfile = (await call("me", undefined, "GET")).data.user;
  assert.equal(savedProfile.isPublic, true);
  assert.equal(savedProfile.bio, profile.bio);
  assert.equal(savedProfile.username, profile.username);
  lb = await call("leaderboard?period=all", undefined, "GET");
  assert.ok(
    lb.data.rows.some(
      (r) => r.username === "local-test" && r.keystrokes === 140,
    ),
  );
  const oldHour = new Date(hour.getTime() - 2 * 86400000).toISOString();
  assert.equal(
    (
      await call(
        "ingest",
        { buckets: [{ ...b, hour: oldHour, keystrokes: 10000 }] },
        "POST",
        auth,
      )
    ).status,
    200,
  );
  const todayRank = (
    await call("leaderboard?period=day", undefined, "GET")
  ).data.rows.find((r) => r.username === "local-test");
  assert.equal(todayRank.keystrokes, 140);
  assert.equal(
    todayRank.level,
    4,
    "Displayed level uses lifetime XP, independent of leaderboard period",
  );
  const clickCookie = cookie;
  cookie = "";
  for (const period of ["day", "week", "month", "all"]) {
    const ranking = await call(
      "leaderboard?period=" + period + "&metric=clicks",
      undefined,
      "GET",
    );
    assert.equal(ranking.status, 200);
    const start = new Date(hour);
    start.setUTCHours(0, 0, 0, 0);
    if (period === "week")
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    if (period === "month") start.setUTCDate(1);
    if (period === "all") start.setTime(0);
    const score = 35 + (Date.parse(oldHour) >= start.getTime() ? 35 : 0);
    const row = ranking.data.rows.find((r) => r.username === "local-test");
    assert.equal(row.score, score);
    assert.equal(row.clicks, score);
    assert.equal(row.level, null);
    assert.ok(ranking.data.rows.every((r) => r.score > 0));
  }
  cookie = clickCookie;
  const own = await call("profile/local-test", undefined, "GET");
  assert.equal(own.data.isOwner, true);
  assert.equal(own.data.detailed, true);
  assert.ok(own.data.buckets.some((b) => b.sessions > 0));
  assert.ok(own.data.codingHistory.some((r) => r.tokens > 0));
  const pub = await call("profile/local-test?view=public", undefined, "GET");
  assert.equal(pub.data.buckets[0].sessions, 0);
  assert.equal(pub.data.devices.length, 0);
  assert.equal(pub.data.detailed, false);
  assert.equal(
    pub.data.buckets.reduce((n, b) => n + b.clicks, 0),
    70,
  );
  assert.ok(pub.data.codingHistory.every((r) => r.seconds === 0));
  const ownerCookie = cookie;
  cookie = "";
  const visitor = await call("profile/local-test", undefined, "GET");
  assert.equal(visitor.status, 200);
  assert.equal(visitor.data.detailed, false);
  assert.equal(visitor.data.isOwner, false);
  assert.equal(visitor.data.viewer, null);
  assert.ok(
    visitor.data.buckets.every(
      (b) => b.sessions === 0 && b.activeSeconds === 0 && b.peakWpm === 0,
    ),
  );
  cookie = ownerCookie;
  assert.ok(pub.data.buckets[0].hour.includes("T00:00:00"));
  assert.deepEqual(
    (await call("coding?username=local-test", undefined, "GET")).data
      .connections,
    [],
  );

  assert.equal(
    (await call("devices/" + device.deviceId, {}, "DELETE")).status,
    200,
  );
  assert.equal(
    (await call("ingest", { buckets: [] }, "POST", auth)).status,
    401,
  );
  assert.equal((await call("coding/ingest", coding, "POST", auth)).status, 401);
  assert.deepEqual(
    (await call("coding", undefined, "GET")).data.connections,
    [],
  );
  me = await call("me", undefined, "GET");
  assert.equal(
    me.data.buckets.reduce((n, b) => n + b.keystrokes, 0),
    10140,
  );
  const exported = await call("export", undefined, "GET");
  assert.equal(exported.status, 200);
  assert.equal(
    exported.data.buckets.reduce((n, b) => n + b.clicks, 0),
    70,
  );
  assert.equal(JSON.stringify(exported.data).includes(device.token), false);
  console.log(
    "PASS: pairing, replay safety, rejection of content, CSRF, privacy, leaderboard, revocation, export",
  );
} finally {
  assert.equal((await call("account", {}, "DELETE")).status, 200);
  console.log("Disposable account deleted.");
}
