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
              <span className="tag">MAC CONNECTION</span>
            </h3>
            <p>
              Connect once. Use your coding tool normally. TypeGrid collects
              tokens and {provider === "claude" ? "active time" : "turn time"}{" "}
              in the background.
            </p>
            <p className="muted">
              Restart {provider === "claude" ? "Claude Code" : "Codex"} once
              after connecting. No tracker terminal needed. Requires TypeGrid
              0.1.4.
            </p>
            <a className="button" href={"typegrid://connect/" + provider}>
              Connect on Mac
            </a>
            <p className="muted">
              Your existing sign-in stays in the coding tool.{" "}
              {provider === "codex"
                ? "Uses the shared Codex configuration; desktop coverage depends on the app’s metrics exporter."
                : "Connects new Claude Code sessions using your user settings."}
            </p>
          </div>
        </section>
      ))}
    </>
  );
}
