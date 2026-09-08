import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
    executable("typegrid", 'case "$1" in version) echo 0.2.1;; is-paired) exit 1;; pair) exit "${TEST_PAIR_STATUS:-0}";; start) echo STARTED;; esac\n');
    const script = readFileSync(new URL("../public/install.sh", import.meta.url), "utf8")
      .replace('TYPEGRID_BINDIR="$HOME/.local/bin"', 'TYPEGRID_BINDIR="' + bin + '"');
    for (const status of ["0", "1"]) {
      const result = spawnSync("sh", ["-c", script], {encoding:"utf8", env:{...process.env, PATH:bin+":"+process.env.PATH, TEST_PAIR_STATUS:status}});
      assert.equal(result.status, Number(status));
      assert.equal(result.stdout.includes("STARTED"), status === "0");
      assert.match(result.stdout, /already installed/);
    }
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

for (const scenario of ["valid", "bad-checksum", "duplicate-checksum", "symlink", "wrong-root"] as const) {
  test(`source installation validates release before execution: ${scenario}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "typegrid-source-test-"));
    try {
      const bin = join(dir, "bin"); mkdirSync(bin);
      const executable = (name: string, content: string) => writeFileSync(join(bin, name), "#!/bin/sh\n" + content, { mode: 0o755 });
      executable("uname", "echo Darwin\n");
      executable("xcrun", "exit 0\n");
      executable("curl", 'while [ "$#" -gt 0 ]; do case "$1" in https:*) source_name=${1##*/};; -o) shift; destination=$1;; esac; shift; done\ncp "$TEST_ASSETS/$source_name" "$destination"\n');
      const root = scenario === "wrong-root" ? "elsewhere" : "typegrid";
      const scripts = join(dir, root, "agent", "scripts"); mkdirSync(scripts, { recursive: true });
      writeFileSync(join(scripts, "install-app.sh"), '#!/bin/sh\nprintf BUILT > "$TEST_MARKER"\n');
      if (scenario === "symlink") {
        const link = spawnSync("ln", ["-s", "/tmp", join(scripts, "escape")]);
        assert.equal(link.status, 0);
      }
      const archive = join(dir, "typegrid-source.tar.gz");
      const tar = spawnSync("tar", ["-czf", archive, "-C", dir, root], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
      assert.equal(tar.status, 0);
      const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
      const line = `${scenario === "bad-checksum" ? "0".repeat(64) : digest}  typegrid-source.tar.gz\n`;
      writeFileSync(join(dir, "SHA256SUMS"), scenario === "duplicate-checksum" ? line + line : line);
      const marker = join(dir, "built");
      const script = readFileSync(new URL("../public/install.sh", import.meta.url), "utf8")
        .replace('TYPEGRID_BINDIR="$HOME/.local/bin"', 'TYPEGRID_BINDIR="' + bin + '"');
      const result = spawnSync("sh", ["-c", script], { encoding: "utf8", env: {
        ...process.env, PATH: bin + ":" + process.env.PATH, TYPEGRID_NO_PAIR: "1", TEST_ASSETS: dir, TEST_MARKER: marker,
      } });
      assert.equal(result.status === 0, scenario === "valid", result.stderr + result.stdout);
      assert.equal(existsSync(marker), scenario === "valid");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
