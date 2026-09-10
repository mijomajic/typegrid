import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readlinkSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "typegrid-update-test-"));
  const bin = join(dir, "bin"), data = join(dir, "data"), user = join(dir, "user");
  for (const path of [bin, data, user]) mkdirSync(path);
  const executable = (name: string, content: string) => {
    const path = join(bin, name); writeFileSync(path, "#!/bin/sh\nset -eu\n" + content, { mode: 0o755 }); return path;
  };
  const script = (name: string) => readFileSync(new URL("../agent/scripts/" + name, import.meta.url), "utf8")
    .replaceAll("$HOME", "$TYPEGRID_TEST_HOME")
    .replaceAll("/usr/bin/shlock", join(bin, "shlock"))
    .replaceAll("/usr/libexec/PlistBuddy", join(bin, "PlistBuddy"))
    .replaceAll("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister", join(bin, "lsregister"));
  executable("shlock", 'while [ "$#" -gt 0 ]; do case "$1" in -f) shift; file=$1;; esac; shift; done\n[ "${TEST_LOCKED:-0}" != 1 ] || exit 1\necho $$ > "$file"\n');
  executable("codesign", 'echo "SIGN $*" >> "$TEST_LOG"\ncase "$1" in -dv) echo "TeamIdentifier=${TEST_TEAM:-not set}" >&2;; esac\n[ "${TEST_BAD_SIGNATURE:-0}" != 1 ]\n');
  executable("ditto", 'cp -R "$1" "$2"\n');
  executable("PlistBuddy", 'case "$2" in *CFBundleIdentifier*) cat "$3";; *CFBundleShortVersionString*) echo 0.1.10;; esac\n');
  executable("lsregister", 'exit 0\n');
  const env = { ...process.env, PATH: bin + ":" + process.env.PATH, TYPEGRID_TEST_HOME: user, TYPEGRID_DATA_DIR: data, TEST_LOG: join(dir, "operations") };
  const run = (name: string, args: string[] = [], extra: Record<string, string> = {}) => spawnSync("sh", ["-c", script(name), "test-script", ...args], { encoding: "utf8", env: { ...env, ...extra } });
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  return { dir, bin, data, user, env, executable, run, cleanup };
}

test("release version stays aligned between source, installer, package, and Swift", () => {
  const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const version = read("agent/VERSION").trim();
  assert.equal(JSON.parse(read("package.json")).version, version);
  assert.equal(JSON.parse(read("package-lock.json")).version, version);
  assert.match(read("public/install.sh"), new RegExp("^VERSION=" + version.replaceAll(".", "\\.") + "$", "m"));
  assert.ok(read("agent/Sources/GridCore/ReleaseVersion.swift").includes('ReleaseVersion("' + version + '")'));
});

test("updater rejects malformed versions, overlapping runs and signed-to-source downgrade before download", () => {
  const f = fixture();
  try {
    f.executable("curl", 'echo DOWNLOAD >> "$TEST_LOG"; exit 99\n');
    for (const version of ["1.2", "1.2.3\n4.5.6", "1.2.$(id)", "01.2.3", "1.2.3-beta"]) {
      assert.notEqual(f.run("update.sh", [version, "source", join(f.dir, "TypeGrid.app")]).status, 0);
    }
    assert.notEqual(f.run("update.sh", ["0.1.10", "source", join(f.dir, "TypeGrid.app")], { TEST_LOCKED: "1" }).status, 0);
    const app = join(f.dir, "TypeGrid.app"); mkdirSync(app);
    const result = f.run("update.sh", ["0.1.10", "source", app], { TEST_TEAM: "ABCDEFGHIJ" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source downgrade refused/);
    assert.ok(!readFileSync(f.env.TEST_LOG, "utf8").includes("DOWNLOAD"));
  } finally { f.cleanup(); }
});

test("bad checksum stops an update before extracting or stopping the installed app", () => {
  const f = fixture();
  try {
    f.executable("curl", 'while [ "$#" -gt 0 ]; do case "$1" in -o) shift; out=$1;; esac; shift; done\ncase "$out" in *SHA256SUMS) printf "%064d  typegrid-source.tar.gz\\n" 0 > "$out";; *) echo corrupt > "$out";; esac\n');
    f.executable("tar", 'echo EXTRACT >> "$TEST_LOG"; exit 99\n');
    const result = f.run("update.sh", ["0.1.10", "source", join(f.dir, "TypeGrid.app")]);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(f.data, "update-result"), "utf8"), "failed\n");
    assert.ok(!existsSync(join(f.data, "update.lock")));
    assert.ok(!existsSync(f.env.TEST_LOG));
  } finally { f.cleanup(); }
});

test("duplicate checksum entries are rejected even when the digest matches", () => {
  const f = fixture();
  try {
    const sha = createHash("sha256").update("archive\n").digest("hex");
    f.executable("curl", 'while [ "$#" -gt 0 ]; do case "$1" in -o) shift; out=$1;; esac; shift; done\ncase "$out" in *SHA256SUMS) printf "' + sha + '  typegrid-source.tar.gz\\n' + sha + '  typegrid-source.tar.gz\\n" > "$out";; *) echo archive > "$out";; esac\n');
    assert.notEqual(f.run("update.sh", ["0.1.10", "source", join(f.dir, "TypeGrid.app")]).status, 0);
    assert.equal(readFileSync(join(f.data, "update-result"), "utf8"), "failed\n");
  } finally { f.cleanup(); }
});

test("a valid source update verifies its archive, builds, and hands off the existing app location", () => {
  const f = fixture();
  try {
    const source = join(f.dir, "source", "typegrid", "agent", "scripts");
    const staged = join(f.dir, "fixture-app", "TypeGrid.app");
    mkdirSync(source, { recursive: true });
    mkdirSync(join(staged, "Contents", "Resources"), { recursive: true });
    writeFileSync(join(staged, "Contents", "Info.plist"), "dev.typegrid.agent");
    writeFileSync(join(source, "build-app.sh"), '#!/bin/sh\ncp -R "$TEST_STAGED_APP" "$1"\n');
    writeFileSync(join(staged, "Contents", "Resources", "replace-app.sh"), '#!/bin/sh\n[ "$2" = "$TEST_TARGET" ] || exit 1\n[ "$3" = restart ] || exit 1\necho REPLACED >> "$TEST_LOG"\n');
    const archive = join(f.dir, "release.tar.gz");
    assert.equal(spawnSync("tar", ["-czf", archive, "-C", join(f.dir, "source"), "typegrid"], { env: { ...process.env, COPYFILE_DISABLE: "1" } }).status, 0);
    const sha = createHash("sha256").update(readFileSync(archive)).digest("hex");
    f.executable("curl", 'while [ "$#" -gt 0 ]; do case "$1" in -o) shift; out=$1;; esac; shift; done\ncase "$out" in *SHA256SUMS) printf "' + sha + '  typegrid-source.tar.gz\\n" > "$out";; *) cp "$TEST_ARCHIVE" "$out";; esac\n');
    f.executable("xcrun", 'exit 0\n');
    const target = join(f.dir, "installed", "TypeGrid.app");
    const result = f.run("update.sh", ["0.1.10", "source", target], { TEST_STAGED_APP: staged, TEST_ARCHIVE: archive, TEST_TARGET: target });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /typegrid-source.tar.gz: OK/);
    assert.equal(readFileSync(join(f.data, "update-result"), "utf8"), "updated\n");
    assert.match(readFileSync(f.env.TEST_LOG, "utf8"), /REPLACED/);
    assert.ok(!existsSync(join(f.data, "update.lock")));
  } finally { f.cleanup(); }
});

for (const scenario of ["symlink", "wrong-root"] as const) {
  test(`source updater rejects unsafe archives before execution: ${scenario}`, () => {
    const f = fixture();
    try {
      const archiveRoot = scenario === "wrong-root" ? "elsewhere" : "typegrid";
      const source = join(f.dir, archiveRoot, "agent", "scripts"); mkdirSync(source, { recursive: true });
      writeFileSync(join(source, "build-app.sh"), '#!/bin/sh\necho EXECUTED >> "$TEST_LOG"\n');
      if (scenario === "symlink") symlinkSync("/tmp", join(source, "escape"));
      const archive = join(f.dir, "source.tar.gz");
      assert.equal(spawnSync("tar", ["-czf", archive, "-C", f.dir, archiveRoot], { env: { ...process.env, COPYFILE_DISABLE: "1" } }).status, 0);
      const sha = createHash("sha256").update(readFileSync(archive)).digest("hex");
      f.executable("curl", 'while [ "$#" -gt 0 ]; do case "$1" in -o) shift; out=$1;; esac; shift; done\ncase "$out" in *SHA256SUMS) printf "' + sha + '  typegrid-source.tar.gz\\n" > "$out";; *) cp "$TEST_ARCHIVE" "$out";; esac\n');
      f.executable("xcrun", "exit 0\n");
      const result = f.run("update.sh", ["0.2.3", "source", join(f.dir, "TypeGrid.app")], { TEST_ARCHIVE: archive });
      assert.notEqual(result.status, 0);
      assert.ok(!existsSync(f.env.TEST_LOG));
    } finally { f.cleanup(); }
  });
}

for (const fail of [false, true]) {
  test(fail ? "failed relaunch restores the previous app and its CLI" : "replacement keeps the app location, settings and CLI and restarts once", () => {
    const f = fixture();
    try {
      const incoming = join(f.dir, "incoming", "TypeGrid.app"), target = join(f.user, "Applications", "TypeGrid.app");
      for (const [path, label] of [[incoming, "new"], [target, "old"]]) {
        mkdirSync(join(path, "Contents", "MacOS"), { recursive: true });
        writeFileSync(join(path, "Contents", "Info.plist"), "dev.typegrid.agent");
        writeFileSync(join(path, "Contents", "MacOS", "TypeGrid"), '#!/bin/sh\necho "' + label + ' $1" >> "$TEST_LOG"\nif [ "$1" = start ] && [ "' + label + '" = new ] && [ "${TEST_FAIL_START:-0}" = 1 ]; then exit 1; fi\n', { mode: 0o755 });
      }
      mkdirSync(join(f.user, ".local", "bin"), { recursive: true });
      const link = join(f.user, ".local", "bin", "typegrid");
      symlinkSync(join(target, "Contents", "MacOS", "TypeGrid"), link);
      writeFileSync(join(f.data, "config.json"), '{"token":"test-fixture","private":true}');
      const result = f.run("replace-app.sh", [incoming, target], { TEST_FAIL_START: fail ? "1" : "0" });
      assert.equal(result.status, fail ? 1 : 0, result.stdout + result.stderr);
      assert.equal(readlinkSync(link), join(target, "Contents", "MacOS", "TypeGrid"));
      assert.match(readFileSync(link, "utf8"), new RegExp('echo "' + (fail ? "old" : "new")));
      assert.equal(readFileSync(join(f.data, "config.json"), "utf8"), '{"token":"test-fixture","private":true}');
      const log = readFileSync(f.env.TEST_LOG, "utf8");
      assert.equal((log.match(/new start/g) || []).length, 1);
      assert.equal((log.match(/old start/g) || []).length, fail ? 1 : 0);
      assert.ok(!existsSync(join(f.data, "install.lock")));
    } finally { f.cleanup(); }
  });
}
