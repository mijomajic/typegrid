import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("current installs skip compilation and failed pairing never starts the agent", () => {
  const dir = mkdtempSync(join(tmpdir(), "typegrid-install-test-"));
  try {
    const bin = join(dir, "bin"); mkdirSync(bin);
    const executable = (name: string, content: string) => writeFileSync(join(bin, name), "#!/bin/sh\n" + content, {mode:0o755});
    executable("uname", "echo Darwin\n");
    executable("open", "exit 0\n");
    executable("xcrun", "exit 99\n");
    executable("curl", "exit 99\n");
    executable("typegrid", 'case "$1" in version) echo "${TEST_VERSION:-0.2.3}";; is-paired) exit "${TEST_PAIRED_STATUS:-1}";; pair) echo PAIRED; exit "${TEST_PAIR_STATUS:-0}";; start) echo STARTED;; esac\n');
    const script = readFileSync(new URL("../public/install.sh", import.meta.url), "utf8")
      .replace('TYPEGRID_BINDIR="$HOME/.local/bin"', 'TYPEGRID_BINDIR="' + bin + '"');
    for (const status of ["0", "1"]) {
      const result = spawnSync("sh", ["-c", script], {encoding:"utf8", env:{...process.env, PATH:bin+":"+process.env.PATH, TEST_PAIR_STATUS:status}});
      assert.equal(result.status, Number(status));
      assert.equal(result.stdout.includes("STARTED"), status === "0");
      assert.match(result.stdout, /already installed/);
    }
    for (const version of ["0.2.3", "0.2.10", "1.0.0"]) {
      const result = spawnSync("sh", ["-c", script], { encoding: "utf8", env: { ...process.env, PATH: bin + ":" + process.env.PATH, TEST_VERSION: version, TEST_PAIRED_STATUS: "0" } });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /already installed/);
      assert.match(result.stdout, /STARTED/);
      assert.ok(!result.stdout.includes("PAIRED"), "Existing pairing must not be reset");
    }
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
