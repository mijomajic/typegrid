import test from "node:test";
import assert from "node:assert/strict";
import {
  desktopStartSchema,
  desktopExchangeSchema,
  desktopChallenge,
} from "../lib/desktop-auth.ts";
test("desktop sign-in requires a strict PKCE proof with no redirect override", () => {
  const verifier = "A".repeat(43);
  const challenge = desktopChallenge(verifier);
  assert.equal(challenge.length, 43);
  assert.equal(desktopStartSchema.safeParse({ challenge }).success, true);
  assert.equal(
    desktopExchangeSchema.safeParse({ request: verifier, verifier }).success,
    true,
  );
  assert.equal(
    desktopStartSchema.safeParse({
      challenge,
      redirect: "https://untrusted.test",
    }).success,
    false,
  );
  for (const value of ["", "A".repeat(42), "A".repeat(44), "../".repeat(15)]) {
    assert.equal(
      desktopExchangeSchema.safeParse({ request: verifier, verifier: value })
        .success,
      false,
    );
  }
  assert.notEqual(desktopChallenge("B".repeat(43)), challenge);
});
