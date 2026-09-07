"use client";
import { useEffect, useState } from "react";
export function CodingStats({ username }: { username?: string }) {
  const [rows, setRows] = useState<
    { provider: string; tokens: number; seconds: number; latest: string }[]
  >([]);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      fetch(
        "/api/coding" +
          (username ? "?username=" + encodeURIComponent(username) : ""),
      )
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (alive) setRows(d.rows);
        })
        .catch(() => {});
    refresh();
    const id = setInterval(refresh, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [username]);
  if (!rows.length) return null;
  return (
    <section className="panel">
      <div className="split">
        <h3>Your AI activity</h3>
        <span className="tag">ALL TIME</span>
      </div>
      <div className="metrics compact">
        {rows.map((r) => (
          <div key={r.provider}>
            <span>
              {r.provider === "claude" ? "Claude Code" : "Codex"} · tokens
            </span>
            <strong>{r.tokens.toLocaleString()}</strong>
            <small>
              {Math.round(r.seconds / 60)} min{" "}
              {r.provider === "claude" ? "active time" : "turn time"} · input +
              output including cache
            </small>
          </div>
        ))}
      </div>
      <p>
        Different tools measure time differently. These are activity stats, not
        hours worked.
      </p>
    </section>
  );
}
export function CodingConnections() {
  const [copied, setCopied] = useState("");
  return (
    <>
      {["claude", "codex"].map((provider) => (
        <section className="integration" key={provider}>
          <div className="integration-icon pixel">
            {provider === "claude" ? "C" : "O"}
          </div>
          <div>
            <h3>
              {provider === "claude" ? "Claude Code" : "Codex"}{" "}
              <span className="tag">LOCAL CONNECTION</span>
            </h3>
            <p>
              Tokens and{" "}
              {provider === "claude" ? "active time" : "turn duration"} from new
              CLI sessions. Your normal tool sign-in stays on your Mac.
            </p>
            <div className="command">
              <code>~/.local/bin/typegrid track {provider}</code>
              <button
                className="button small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      "~/.local/bin/typegrid track " + provider,
                    );
                    setCopied(provider);
                  } catch {
                    setCopied("");
                  }
                }}
              >
                {copied === provider ? "Copied" : "Copy command"}
              </button>
            </div>
            <p className="muted">
              Run this instead of {provider}. Stop using the launcher to
              disconnect. Requires TypeGrid 0.1.3.
            </p>
          </div>
        </section>
      ))}
    </>
  );
}
