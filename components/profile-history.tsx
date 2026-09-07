"use client";
import { useState } from "react";
import { summarize, type Bucket } from "@/lib/stats";
export type CodingDay = {
  day: string;
  provider: string;
  tokens: number;
  seconds: number;
};
const format = (n: number) => n.toLocaleString();
export function ProfileHistory({
  buckets,
  coding,
  detailed,
}: {
  buckets: Bucket[];
  coding: CodingDay[];
  detailed: boolean;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [group, setGroup] = useState("day"),
    [page, setPage] = useState(0);
  const inRange = (day: string) => (!from || day >= from) && (!to || day <= to);
  const selected = buckets.filter((b) => inRange(b.hour.slice(0, 10)));
  const ai = coding.filter((r) => inRange(r.day));
  const stats = summarize(selected);
  const rows = new Map<
    string,
    {
      period: string;
      keys: number;
      active: number;
      sessions: number;
      peak: number;
      tokens: number;
    }
  >();
  const row = (day: string) => {
    const key = group === "month" ? day.slice(0, 7) : day;
    if (!rows.has(key))
      rows.set(key, {
        period: key,
        keys: 0,
        active: 0,
        sessions: 0,
        peak: 0,
        tokens: 0,
      });
    return rows.get(key)!;
  };
  for (const b of selected) {
    const r = row(b.hour.slice(0, 10));
    r.keys += b.keystrokes;
    r.active += b.activeSeconds;
    r.sessions += b.sessions;
    r.peak = Math.max(r.peak, b.peakWpm);
  }
  for (const b of ai) row(b.day).tokens += b.tokens;
  const history = [...rows.values()].sort((a, b) =>
    b.period.localeCompare(a.period),
  );
  const pages = Math.max(1, Math.ceil(history.length / 31)),
    current = Math.min(page, pages - 1);
  const tokens = ai.reduce((n, r) => n + r.tokens, 0);
  const chart = history.slice(0, 60).reverse();
  const max = Math.max(1, ...chart.map((r) => r.keys));
  const invalid = !!from && !!to && from > to;
  return (
    <section className="panel profile-history">
      <div className="split">
        <div>
          <h3>Activity history</h3>
          <p>All synced history · UTC dates. Choose any date range.</p>
        </div>
        <button
          className="button small"
          onClick={() => {
            setFrom("");
            setTo("");
            setPage(0);
          }}
        >
          All time
        </button>
      </div>
      <div className="history-filters">
        <label>
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Group by
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setPage(0);
            }}
          >
            <option value="day">Day</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
      {invalid ? (
        <p role="alert">The end date must be on or after the start date.</p>
      ) : (
        <>
          <div className="metrics compact">
            <div>
              <span>Keystrokes in range</span>
              <strong>{format(stats.keys)}</strong>
            </div>
            <div>
              <span>AI tokens in range</span>
              <strong>{format(tokens)}</strong>
            </div>
            <div>
              <span>Best day</span>
              <strong>{format(stats.record)}</strong>
            </div>
            <div>
              <span>Active days</span>
              <strong>
                {Object.values(stats.days).filter((n) => n > 0).length}
              </strong>
            </div>
          </div>
          {detailed && (
            <div className="history-private">
              <span>Only you see these details:</span>
              <span>
                {format(Math.round(stats.active / 60))} min active typing
              </span>
              <span>{format(stats.sessions)} sessions</span>
              <span>{stats.peak} peak WPM</span>
              <span>{format(stats.dev)} dev keystrokes</span>
            </div>
          )}
          {coding.length > 0 && (
            <div className="history-private">
              {["codex", "claude", "cursor"]
                .filter((p) => ai.some((r) => r.provider === p))
                .map((p) => {
                  const items = ai.filter((r) => r.provider === p);
                  return (
                    <span key={p}>
                      {p === "codex"
                        ? "Codex"
                        : p === "claude"
                          ? "Claude Code"
                          : "Cursor"}{" "}
                      ·{" "}
                      {p === "cursor"
                        ? detailed
                          ? format(
                              Math.round(
                                items.reduce((n, r) => n + r.seconds, 0) / 60,
                              ),
                            ) + " min session time"
                          : "Session time private"
                        : format(items.reduce((n, r) => n + r.tokens, 0)) +
                          " tokens"}
                      {detailed &&
                        p !== "cursor" &&
                        " · " +
                          format(
                            Math.round(
                              items.reduce((n, r) => n + r.seconds, 0) / 60,
                            ),
                          ) +
                          (p === "codex"
                            ? " min turn time"
                            : " min active time")}
                    </span>
                  );
                })}
            </div>
          )}
          {!history.length ? (
            <p>
              No synced activity in this range. History begins when a machine
              first sends counts.
            </p>
          ) : (
            <>
              <figure className="history-chart">
                <div className="history-bars" aria-label="Keystrokes by period">
                  {chart.map((r) => (
                    <div
                      key={r.period}
                      title={r.period + " · " + format(r.keys) + " keystrokes"}
                      style={{
                        height: Math.max(1, (r.keys / max) * 100) + "%",
                      }}
                    />
                  ))}
                </div>
                <figcaption>
                  {chart[0]?.period} — {chart.at(-1)?.period}
                  {history.length > 60
                    ? " · chart shows latest 60 periods; full history below"
                    : ""}
                </figcaption>
              </figure>
              <div className="history-table-scroll">
                <table>
                  <caption className="sr-only">
                    Complete synced activity history,{" "}
                    {group === "day" ? "daily" : "monthly"} totals
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        {group === "day" ? "Date" : "Month"} · UTC
                      </th>
                      <th scope="col">Keystrokes</th>
                      <th scope="col">Est. words</th>
                      <th scope="col">AI tokens</th>
                      {detailed && (
                        <>
                          <th scope="col">Active min</th>
                          <th scope="col">Sessions</th>
                          <th scope="col">Peak WPM</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .slice(current * 31, (current + 1) * 31)
                      .map((r) => (
                        <tr key={r.period}>
                          <th scope="row">{r.period}</th>
                          <td>{format(r.keys)}</td>
                          <td>{format(Math.floor(r.keys / 5))}</td>
                          <td>{format(r.tokens)}</td>
                          {detailed && (
                            <>
                              <td>{format(Math.round(r.active / 60))}</td>
                              <td>{format(r.sessions)}</td>
                              <td>{r.peak}</td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="split history-pagination">
                <button
                  className="button small"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Newer
                </button>
                <span>
                  Page {current + 1} of {pages} · {history.length} recorded{" "}
                  {group === "day" ? "days" : "months"}
                </span>
                <button
                  className="button small"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  Older
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
