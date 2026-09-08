"use client";
import { useEffect, useState } from "react";
type CodingRow = {
  provider: string;
  tokens: number;
  seconds: number;
  latest: string;
};
type Connection = { provider: string; online: boolean };
function useCoding(username?: string) {
  const [data, setData] = useState<{
    rows: CodingRow[];
    connections: Connection[];
  }>({ rows: [], connections: [] });
  const [state, setState] = useState("loading");
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          "/api/coding" +
            (username ? "?username=" + encodeURIComponent(username) : ""),
        );
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (alive) {
          setData(next);
          setState("ready");
        }
      } catch {
        if (alive) setState("error");
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [username]);
  return { ...data, state };
}
export function CodingStats({ username }: { username?: string }) {
  const { rows, connections, state } = useCoding(username);
  if (username && !rows.length) return null;
  return (
    <section className="panel coding-activity">
      <div className="split">
        <h3>{username ? "AI activity" : "Your AI activity"}</h3>
        <span className="tag">ALL TIME</span>
      </div>
      {!username && connections.length > 0 && (
        <div className="coding-status-list">
          {Array.from(new Set(connections.map((c) => c.provider))).map(
            (provider) => (
              <span className="tag" key={provider}>
                <i
                  className={
                    connections.some((c) => c.provider === provider && c.online)
                      ? "status-dot"
                      : "status-dot offline"
                  }
                />
                {provider === "codex"
                  ? "Codex"
                  : provider === "claude"
                    ? "Claude Code"
                    : "Cursor"}{" "}
                ·{" "}
                {connections.some((c) => c.provider === provider && c.online)
                  ? "Connected"
                  : "Agent offline"}
              </span>
            ),
          )}
        </div>
      )}
      {state === "error" && (
        <p role="status">
          AI activity could not refresh. Retrying automatically.
        </p>
      )}
      {!rows.length && (
        <p>
          {state === "loading"
            ? "Loading AI activity…"
            : connections.length
              ? "Your tools are set up. Token totals and time will appear after metrics arrive. Restart your coding tool once after connecting."
              : "Connect Codex or Claude Code to see token totals and time here."}{" "}
          {!connections.length && (
            <a className="text-link" href="/app/integrations">
              Manage integrations ↗
            </a>
          )}
        </p>
      )}
      <div className="metrics compact">
        {rows.map((r) => (
          <div key={r.provider}>
            <span>
              {r.provider === "cursor"
                ? "Cursor · session time"
                : (r.provider === "claude" ? "Claude Code" : "Codex") +
                  " · tokens"}
            </span>
            <strong>
              {r.provider === "cursor"
                ? Math.round(r.seconds / 60) + "m"
                : r.tokens.toLocaleString()}
            </strong>
            <small>
              {r.provider === "cursor"
                ? "Completed sessions · includes idle time"
                : `${Math.round(r.seconds / 60)} min ${r.provider === "claude" ? "active time" : "turn time"} · input + output including cache`}
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
function ProviderMark({ provider }: { provider: string }) {
  return (
    <span className={"provider-mark provider-" + provider}>
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        {provider === "claude" ? (
          <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M16 4v7" transform={`rotate(${i * 30} 16 16)`} />
            ))}
          </g>
        ) : provider === "codex" ? (
          <g
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m11 9-7 7 7 7m10-14 7 7-7 7M18 7l-4 18" />
          </g>
        ) : (
          <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="m6 7 21 9-10 3-4 9Z" fill="currentColor" />
            <path d="m14 15 8 9" stroke="#151517" />
          </g>
        )}
      </svg>
    </span>
  );
}
export function CodingConnections() {
  const { connections, state } = useCoding();
  const providers = [
    {
      id: "claude",
      name: "Claude Code",
      description: "Your coding sessions, in numbers.",
      metrics: "Tokens · Active time",
    },
    {
      id: "codex",
      name: "Codex",
      description: "Every turn adds to your story.",
      metrics: "Tokens · Turn time",
    },
    {
      id: "cursor",
      name: "Cursor",
      description: "See the time you spend building.",
      metrics: "Session time",
    },
  ];
  return (
    <div className="provider-grid">
      {providers.map((p) => {
        const connected = connections.some((c) => c.provider === p.id);
        const online = connections.some((c) => c.provider === p.id && c.online);
        return (
          <section className="provider-card" key={p.id}>
            <div className="provider-top">
              <ProviderMark provider={p.id} />
              <div>
                <h3>{p.name}</h3>
                <span>macOS</span>
              </div>
              {connected && state !== "error" ? (
                <span className="tag" role="status">
                  <i className={online ? "status-dot" : "status-dot offline"} />
                  {online ? "Connected" : "Agent offline"}
                </span>
              ) : (
                <a
                  className="button small"
                  href={"typegrid://connect/" + p.id}
                  aria-label={"Connect " + p.name}
                >
                  {state === "loading"
                    ? "Checking…"
                    : state === "error"
                      ? "Retry setup"
                      : "Connect"}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
            <p>{p.description}</p>
            <div className="provider-metrics">
              <i />
              {p.metrics}
            </div>
            <details>
              <summary>
                Setup details <span>+</span>
              </summary>
              <p>
                Connect once, then restart {p.name}. TypeGrid runs in the
                background with your existing sign-in. Requires the latest Mac
                agent.
              </p>
              {p.id === "cursor" ? (
                <p>
                  Uses Cursor’s session-end hook. Personal token totals aren’t
                  available through this connection. Session time includes idle
                  time.
                </p>
              ) : p.id === "codex" ? (
                <p>
                  Uses Codex’s shared metrics settings. Desktop exports depend
                  on the installed app version.
                </p>
              ) : null}
            </details>
          </section>
        );
      })}
    </div>
  );
}
