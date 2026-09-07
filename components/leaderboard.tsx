"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { username: string; keystrokes: number; level: number | null };
const periods = [
  ["day", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["all", "All time"],
];
export function Leaderboard() {
  const [metric, setMetric] = useState("keys");
  const [period, setPeriod] = useState("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const refresh = async () => {
      try {
        const res = await fetch(
          `/api/leaderboard?period=${period}&metric=${metric}`,
          { signal: controller.signal },
        );
        if (!res.ok)
          throw new Error("Rankings could not load. Please try again.");
        const data = await res.json();
        if (active) {
          setRows(data.rows);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load rankings.");
      } finally {
        if (active) setBusy(false);
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [metric, period]);
  const unit = metric === "tokens" ? "AI tokens" : "keystrokes";
  return (
    <section className="grid-rankings">
      <h1 className="sr-only">Leaderboard</h1>
      <div className="rankings-controls">
        <div
          role="group"
          aria-label="Leaderboard metric"
          className="rankings-switch"
        >
          {[
            ["keys", "Keystrokes"],
            ["tokens", "AI tokens"],
          ].map(([v, l]) => (
            <button
              key={v}
              aria-pressed={metric === v}
              onClick={() => setMetric(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Leaderboard period"
          className="rankings-periods"
        >
          {periods.map(([v, l]) => (
            <button
              key={v}
              aria-pressed={period === v}
              onClick={() => setPeriod(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {!busy && !error && rows.length > 0 && (
        <section
          className="rankings-stage"
          aria-label="Top three public profiles"
        >
          <div className="stage-grid" aria-hidden="true" />
          {[1, 0, 2].map((index) => {
            const row = rows[index];
            const content = (
              <>
                <div className="rankings-avatar" aria-hidden="true">
                  {row ? row.username.slice(0, 2).toUpperCase() : "+"}
                </div>
                <div className="stage-plinth">
                  <span className="stage-place">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong className="stage-user">
                    {row ? "@" + row.username : "An open spot."}
                  </strong>
                  <span className="stage-score">
                    {row ? row.keystrokes.toLocaleString() : "—"}
                  </span>
                  <span className="stage-unit">
                    {row ? unit : "Make it yours"}
                  </span>
                </div>
              </>
            );
            return row ? (
              <Link
                key={index}
                href={"/u/" + row.username}
                className={`stage-player stage-place-${index + 1}`}
              >
                {content}
              </Link>
            ) : (
              <div
                key={index}
                className={`stage-player stage-place-${index + 1} stage-vacant`}
              >
                {content}
              </div>
            );
          })}
        </section>
      )}
      <div className="rankings-table-wrap" aria-busy={busy}>
        <div className="rankings-table-title">
          <span>
            Leaderboard{" "}
            <small>/ {periods.find(([v]) => v === period)?.[1]}</small>
          </span>
          <span className="rankings-refresh">
            <i /> Refreshes every 15s
          </span>
        </div>
        {error ? (
          <div className="rankings-empty" role="alert">
            {error}
            <button
              className="button small"
              onClick={() => setPeriod(period === "week" ? "day" : "week")}
            >
              Try another period
            </button>
          </div>
        ) : busy ? (
          <div className="rankings-empty" role="status">
            Connecting to the Grid…
          </div>
        ) : rows.length ? (
          <div className="rankings-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">{unit}</th>
                  <th scope="col">
                    {metric === "tokens" ? "Share of top 100" : "Level"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.username}
                    className={i === 0 ? "rankings-first" : ""}
                  >
                    <td>
                      <span className="table-rank">
                        [{String(i + 1).padStart(2, "0")}]
                      </span>
                    </td>
                    <td>
                      <Link href={"/u/" + r.username}>
                        <span className="table-avatar" aria-hidden="true">
                          {r.username.slice(0, 2)}
                        </span>
                        @{r.username}
                        {i === 0 && <span className="leader-tag">LEADING</span>}
                      </Link>
                    </td>
                    <td>{r.keystrokes.toLocaleString()}</td>
                    <td>
                      {metric === "tokens"
                        ? (
                            (r.keystrokes /
                              rows.reduce((s, v) => s + v.keystrokes, 0)) *
                            100
                          ).toFixed(1) + "%"
                        : "LVL " + r.level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rankings-empty">
            <span className="pixel">The next high score is yours.</span>
            <p>
              {metric === "tokens"
                ? "No public AI token totals for this period yet. Connect Claude Code or Codex and complete a coding session."
                : "Make your profile public and start typing to take the first spot."}
            </p>
            <Link
              className="button small"
              href={metric === "tokens" ? "/integrations" : "/settings"}
            >
              {metric === "tokens"
                ? "Connect a coding tool"
                : "Join the leaderboard"}{" "}
              ↗
            </Link>
          </div>
        )}
      </div>
      <footer className="rankings-footer">
        <span>PUBLIC PROFILES ONLY · UTC PERIODS</span>
        <Link href="/settings">Take your place on the Grid ↗</Link>
      </footer>
      {metric === "tokens" && (
        <p className="rankings-note">
          Tokens appear after your coding tool exports usage. Claude exports
          every 10 seconds; Codex timing depends on its exporter. TypeGrid then
          syncs in the background. Cursor session time does not count toward
          token rankings.
        </p>
      )}
    </section>
  );
}
