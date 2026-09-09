"use client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import {
  goalPresets,
  goalProgress,
  type DailyGoals as Targets,
} from "@/lib/goals";

const fmt = (n: number) => n.toLocaleString("en-US");

export function DailyGoals({
  goals,
  keystrokes,
  clicks,
  onSave,
}: {
  goals: Targets | null;
  keystrokes: number;
  clicks: number;
  onSave: (goals: Targets | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(false);
  const [keysTarget, setKeysTarget] = useState(10000);
  const [clickTarget, setClickTarget] = useState(1500);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const section = useRef<HTMLElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const presetsVisible = !goals || editing;
  const progress = goals ? goalProgress(goals, keystrokes, clicks) : null;

  useEffect(() => {
    const reveal = () => {
      if (window.location.hash !== "#goals") return;
      section.current?.scrollIntoView({ block: "center" });
      section.current?.focus({ preventScroll: true });
      setEditing(true);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  async function save(next: Targets | null) {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onSave(next);
      setEditing(false);
      setCustom(false);
      setNotice(
        next
          ? "Goals saved. Your Mac’s progress ring will update on its next sync."
          : "Daily goals turned off.",
      );
      requestAnimationFrame(() =>
        (next ? editButton.current : section.current)?.focus({
          preventScroll: true,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t save goals. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="goals"
      className={"daily-goals" + (progress?.complete ? " goals-complete" : "")}
      ref={section}
      tabIndex={-1}
      aria-labelledby="goals-heading"
      aria-busy={saving}
    >
      <div className="goals-heading">
        <div
          className="goal-ring"
          role="img"
          aria-label={
            progress
              ? `${progress.percent}% of daily goals complete`
              : "Set a daily goal"
          }
        >
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle className="goal-ring-track" cx="32" cy="32" r="27" />
            <circle
              className="goal-ring-value"
              cx="32"
              cy="32"
              r="27"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - (progress?.percent ?? 0)}
            />
          </svg>
          <span>
            {progress ? (
              progress.complete ? (
                <CheckIcon />
              ) : (
                <>
                  {progress.percent}
                  <small>%</small>
                </>
              )
            ) : (
              <span className="goal-ring-start">↗</span>
            )}
          </span>
        </div>
        <div className="goals-intro">
          <span className="eyebrow">YOUR DAILY GOALS</span>
          <h2 id="goals-heading">
            {!goals
              ? "Give today a little direction."
              : progress?.complete
                ? "You did it. Both goals reached."
                : "A little closer with every input."}
          </h2>
          <p>
            {!goals
              ? "Choose a pace. Today’s activity already counts."
              : progress?.complete
                ? "Nice work. Your counts keep going; your goals reset tomorrow."
                : "Two small targets. One satisfying finish."}
          </p>
        </div>
        {goals && (
          <button
            ref={editButton}
            className="text-link goal-edit"
            disabled={saving}
            aria-expanded={editing}
            onClick={() => {
              setEditing(!editing);
              setCustom(false);
              setError("");
              setNotice("");
            }}
          >
            {editing ? "Done" : "Edit goals"}
          </button>
        )}
      </div>

      {goals && progress && (
        <div className="goal-metrics">
          {[
            {
              label: "Keystrokes",
              value: keystrokes,
              target: goals.keystrokes,
              fraction: progress.keys,
            },
            {
              label: "Clicks",
              value: clicks,
              target: goals.clicks,
              fraction: progress.clicks,
            },
          ].map(({ label, value, target, fraction }) => (
            <div className="goal-metric" key={label}>
              <div>
                <span>
                  {label}
                  {fraction === 1 && <CheckIcon aria-label="Goal reached" />}
                </span>
                <span>
                  <strong>{fmt(value)}</strong>{" "}
                  <span className="muted">/ {fmt(target)}</span>
                </span>
              </div>
              <progress
                max={target}
                value={Math.min(value, target)}
                aria-label={`${label} daily goal`}
              />
              <small>
                {fraction === 1
                  ? "Goal reached"
                  : `${fmt(target - value)} to go`}
              </small>
            </div>
          ))}
        </div>
      )}

      {presetsVisible && (
        <div className="goal-setup">
          <div
            className="goal-presets"
            role="group"
            aria-label="Choose a daily goal preset"
          >
            {goalPresets.map((preset, i) => {
              const selected =
                goals?.keystrokes === preset.keystrokes &&
                goals?.clicks === preset.clicks;
              return (
                <button
                  key={preset.name}
                  className={"goal-preset" + (selected ? " selected" : "")}
                  disabled={saving}
                  aria-pressed={selected}
                  onClick={() =>
                    save({
                      keystrokes: preset.keystrokes,
                      clicks: preset.clicks,
                    })
                  }
                >
                  <span className="goal-preset-top">
                    <span className="goal-steps" aria-hidden="true">
                      {[0, 1, 2].map((n) => (
                        <i key={n} className={n <= i ? "lit" : ""} />
                      ))}
                    </span>
                    <strong>{preset.name}</strong>
                    {selected ? <CheckIcon /> : <ArrowRightIcon />}
                  </span>
                  <span className="goal-preset-numbers">
                    {fmt(preset.keystrokes)} <small>keys</small>
                    <span> · </span>
                    {fmt(preset.clicks)} <small>clicks</small>
                  </span>
                  <span className="goal-preset-description">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="goal-setup-actions">
            <button
              className="text-link"
              disabled={saving}
              aria-expanded={custom}
              onClick={() => {
                setKeysTarget(goals?.keystrokes ?? 10000);
                setClickTarget(goals?.clicks ?? 1500);
                setCustom(!custom);
              }}
            >
              Set your own targets
            </button>
            {goals && (
              <button
                className="text-link muted"
                disabled={saving}
                onClick={() => save(null)}
              >
                Turn off goals
              </button>
            )}
          </div>
          {custom && (
            <form
              className="goal-custom"
              onSubmit={(e) => {
                e.preventDefault();
                void save({ keystrokes: keysTarget, clicks: clickTarget });
              }}
            >
              <label>
                Keystrokes per day
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                  value={keysTarget || ""}
                  onChange={(e) => setKeysTarget(Number(e.target.value))}
                  disabled={saving}
                />
              </label>
              <label>
                Clicks per day
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                  value={clickTarget || ""}
                  onChange={(e) => setClickTarget(Number(e.target.value))}
                  disabled={saving}
                />
              </label>
              <button className="button primary" disabled={saving}>
                {saving ? "Saving…" : "Save goals"}
              </button>
            </form>
          )}
        </div>
      )}
      <div className="goal-footnote">
        <span>Resets at midnight UTC · Just for you</span>
        {saving && <span role="status">Saving your goals…</span>}
      </div>
      {notice && (
        <p className="goal-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="goal-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
