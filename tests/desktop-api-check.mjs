// Run only against a disposable local database and local dev server.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
const base = process.env.TYPEGRID_TEST_URL;
const database = process.env.DATABASE_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.ok(
  database && ["127.0.0.1", "localhost"].includes(new URL(database).hostname),
);
const sql = postgres(database, { max: 1 });
const hash = (value) => createHash("sha256").update(value).digest("hex");
let browserCookie = "";
async function call(path, data, cookie = "", origin = base) {
  const response = await fetch(base + "/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
try {
  browserCookie = (await call("auth/local", {})).cookie;
  const owner = await call("me", undefined, browserCookie);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(
    (
      await call(
        "auth/desktop/start",
        { challenge },
        "",
        "https://wrong.example",
      )
    ).status,
    403,
  );
  const start = await call("auth/desktop/start", { challenge });
  assert.equal(start.status, 200);
  assert.equal(new URL(start.data.authorizationUrl).origin, base);
  assert.equal(
    (
      await call("auth/desktop/exchange", {
        request: start.data.request,
        verifier,
      })
    ).status,
    401,
  );
  // Simulate successful provider authorization without contacting GitHub or using a real account.
  await sql`UPDATE desktop_logins SET user_id=${owner.data.user.id} WHERE request_hash=${hash(start.data.request)}`;
  assert.equal(
    (
      await call("auth/desktop/exchange", {
        request: start.data.request,
        verifier: randomBytes(32).toString("base64url"),
      })
    ).status,
    401,
  );
  const exchange = await call("auth/desktop/exchange", {
    request: start.data.request,
    verifier,
  });
  assert.equal(exchange.status, 200);
  assert.ok(exchange.cookie?.startsWith("tg_session="));
  assert.equal(
    (await call("me", undefined, exchange.cookie)).data.user.id,
    owner.data.user.id,
  );
  assert.equal(
    (
      await call("auth/desktop/exchange", {
        request: start.data.request,
        verifier,
      })
    ).status,
    401,
  );
  const expired = await call("auth/desktop/start", { challenge });
  await sql`UPDATE desktop_logins SET user_id=${owner.data.user.id},expires_at=now()-interval '1 second' WHERE request_hash=${hash(expired.data.request)}`;
  assert.equal(
    (
      await call("auth/desktop/exchange", {
        request: expired.data.request,
        verifier,
      })
    ).status,
    401,
  );
  const unauthenticated = await call("me");
  assert.equal(unauthenticated.data.user, null);
  console.log(
    "PASS: desktop PKCE handoff, origin checks, independent account session, wrong proof, expiry, and single-use redemption.",
  );
} finally {
  if (browserCookie)
    await fetch(base + "/api/account", {
      method: "DELETE",
      headers: { Origin: base, Cookie: browserCookie },
    });
  await sql.end();
}
