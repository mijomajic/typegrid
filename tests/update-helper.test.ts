import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const helper = new URL("../agent/scripts/apply-update.sh", import.meta.url)
  .pathname;
for (const fail of [false, true])
  test(`update helper ${fail ? "restores the old app if relaunch fails" : "replaces only the app and preserves saved counts"}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "typegrid-update-test-"));
    try {
      const app = join(dir, "TypeGrid.app"),
        staged = join(dir, "Staged.app"),
        update = join(dir, "update");
      for (const folder of [app, staged, update, join(dir, "bin")])
        mkdirSync(folder);
      writeFileSync(join(app, "version"), "old");
      writeFileSync(join(staged, "version"), "new");
      writeFileSync(join(dir, "counts.json"), '{"keystrokes":100,"clicks":35}');
      writeFileSync(
        join(dir, "bin", "open"),
        '#!/bin/sh\nif [ "' +
          String(fail) +
          '" = true ] && [ ! -f "' +
          join(dir, "failed-once") +
          '" ]; then touch "' +
          join(dir, "failed-once") +
          '"; exit 1; fi\nexit 0\n',
        { mode: 0o755 },
      );
      // An impossible PID models the already-exited app; never stop a real process.
      const result = spawnSync(
        "sh",
        [helper, "99999999", app, staged, update],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: join(dir, "bin") + ":" + process.env.PATH,
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        readFileSync(join(app, "version"), "utf8"),
        fail ? "old" : "new",
      );
      assert.equal(
        readFileSync(join(dir, "counts.json"), "utf8"),
        '{"keystrokes":100,"clicks":35}',
      );
      assert.equal(existsSync(app + ".previous-update"), false);
      if (fail)
        assert.equal(readFileSync(join(staged, "version"), "utf8"), "new");
      else assert.equal(existsSync(update), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
