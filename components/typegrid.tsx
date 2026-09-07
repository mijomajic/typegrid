"use client";
import Link from "next/link";
import { Leaderboard } from "./leaderboard";
import { CodingStats, CodingConnections } from "./coding-stats";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  GitHubLogoIcon,
  CopyIcon,
  CheckIcon,
  ActivityLogIcon,
  DashboardIcon,
  LightningBoltIcon,
  LockClosedIcon,
  GlobeIcon,
  StarIcon,
  GearIcon,
  Link2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  DesktopIcon,
  ExitIcon,
  BarChartIcon,
} from "@radix-ui/react-icons";
import { achievements, summarize, type Bucket } from "@/lib/stats";
const repo = "https://github.com/mijomajic/typegrid";
const install = "curl -fsSL https://typegrid.dev/install.sh | sh";
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
type User = {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  isPublic: boolean;
  githubLogin: string;
  githubConnected: boolean;
};
type Data = {
  user: User | null;
  buckets: Bucket[];
  devices: { id: string; name: string; lastSeen: string | null }[];
  github?: {
    repos: number;
    followers: number;
    contributions: number;
    updatedAt: string;
  } | null;
};
const empty: Data = { user: null, buckets: [], devices: [] };
async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch("/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (r.status === 404 && path.startsWith("profile/")) return empty;
  if (!r.ok)
    throw new Error(d.error || "Something went wrong. Please try again.");
  return d;
}
function Logo() {
  return (
    <Link href="/" className="logo" aria-label="TypeGrid home">
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M5 7h38v8H5zM9 19h30v5H9zM20 28h8v5h-8zM20 37h8v5h-8z"
          fill="currentColor"
        />
      </svg>
      typegrid<span className="beta">BETA</span>
    </Link>
  );
}
function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let id = 0,
      t = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      const w = c.clientWidth,
        h = c.clientHeight,
        d = Math.min(devicePixelRatio, 2);
      if (c.width !== w * d || c.height !== h * d) {
        c.width = w * d;
        c.height = h * d;
      }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (let x = 0; x < w; x += 19)
        for (let y = 0; y < h; y += 19) {
          const wave =
            Math.sin(x * 0.015 + y * 0.009 - t) * Math.cos(y * 0.018 - t * 0.6);
          const center =
            1 -
            Math.min(
              1,
              Math.hypot((x - w * 0.56) / (w * 0.7), (y - h * 0.5) / (h * 0.8)),
            );
          ctx.fillStyle = `rgba(${wave > 0.65 ? "146,245,114" : "121,150,115"},${Math.max(0.05, center * (0.12 + Math.max(0, wave) * 0.5))})`;
          ctx.beginPath();
          ctx.arc(x, y, wave > 0.7 ? 1.5 : 1, 0, Math.PI * 2);
          ctx.fill();
        }
      t += 0.008;
      if (!reduce) id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} className="dotfield" aria-hidden="true" />;
}
function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
function Spinner() {
  return (
    <span className="spinner" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i
          key={i}
          style={{
            transform: `rotate(${i * 45}deg)`,
            animationDelay: `${i * -0.1}s`,
          }}
        />
      ))}
    </span>
  );
}
function Copy({ text = install }: { text?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={"copy" + (copied ? " copied" : "")}
      aria-label={copied ? "Command copied" : "Copy command"}
      title={copied ? "Copied" : "Copy command"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span className="copy-icon" key={copied ? "done" : "copy"}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
      <span className="sr-only" role="status">
        {copied ? "Command copied" : ""}
      </span>
    </button>
  );
}
function Command() {
  return (
    <div className="command">
      <span>$</span>
      <code>{install}</code>
      <Copy />
    </div>
  );
}
function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <nav>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/integrations">Integrations</Link>
          <a href={repo} target="_blank" rel="noreferrer">
            Open source <ExternalLinkIcon />
          </a>
        </nav>
        <Link className="button small" href="/connect">
          Join the Grid <ArrowRightIcon />
        </Link>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer className="container footer">
      <span>© {new Date().getFullYear()} TypeGrid</span>
      <span className="mono">
        <i className="status-dot" /> WE COUNT. WE DON’T READ.
      </span>
      <div>
        <Link href="/privacy">Privacy</Link>
        <a href={repo}>GitHub ↗</a>
      </div>
    </footer>
  );
}
function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="container hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <i className="status-dot" /> BUILT FOR MAC. CONNECTED TO THE GRID.
            </div>
            <h1>
              A little more you.
              <br />
              <span className="pixel">In numbers.</span>
            </h1>
            <p>
              Every keystroke counts. See your rhythm in stats, streaks, and a
              little friendly competition. All from your menu bar.
            </p>
            <div className="hero-install">
              <span className="mono install-label">
                INSTALL TYPEGRID · MACOS
              </span>
              <Command />
              <p className="install-note">
                Paste into Terminal · macOS 13+ · Apple Command Line Tools
                required
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/connect" className="button primary">
                Get TypeGrid for Mac <ArrowRightIcon />
              </Link>
              <a className="button" href={repo}>
                <GitHubLogoIcon /> Star on GitHub
              </a>
            </div>
            <div className="hero-notes">
              <span>Free & open source</span>
              <span>Native macOS agent</span>
              <span>No text collected</span>
            </div>
          </div>
          <div className="matrix-field" aria-hidden="true">
            <DotField />
          </div>
          <span className="hero-coordinate mono" aria-hidden="true">
            [ INPUT → COUNTS ]
          </span>
          <span className="hero-coordinate right mono" aria-hidden="true">
            [ CONTENT → NEVER ]
          </span>
        </section>
        <section className="container demo-wrap">
          <div className="product-window-bar">
            <span className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="mono">typegrid / overview</span>
            <span className="tag">ILLUSTRATIVE PREVIEW</span>
          </div>
          <div className="section-heading">
            <span className="eyebrow">A LITTLE MORE YOU, IN NUMBERS.</span>
            <span className="mono muted">↓ INSIDE THE GRID</span>
          </div>
          <DemoDashboard />
          <div className="demo-caption">
            <LockClosedIcon /> Illustrative preview. Your real dashboard starts
            at zero. No invented activity.
          </div>
        </section>
        <section className="container philosophy">
          <div>
            <span className="eyebrow">PRIVACY IS THE POINT.</span>
            <h2>
              We count.
              <br />
              <span className="muted">We don’t read.</span>
            </h2>
          </div>
          <div>
            <p>
              Not your code. Not your messages. Not your passwords. TypeGrid
              only counts keyboard events — it never asks which key you pressed.
            </p>
            <div className="privacy-facts">
              <span>
                <CheckIcon /> No key codes or typed text
              </span>
              <span>
                <CheckIcon /> No window titles or browsing history
              </span>
              <span>
                <CheckIcon /> Private profiles by default
              </span>
              <span>
                <CheckIcon /> Source you can actually read
              </span>
            </div>
            <Link href="/privacy" className="text-link">
              Read the privacy promise <ArrowRightIcon />
            </Link>
          </div>
        </section>
        <section className="container start-section">
          <div>
            <div className="eyebrow">HELLO, GRID.</div>
            <h2>
              Your next keystroke
              <br />
              could be your first.
            </h2>
            <p>Install. Sign in. Watch your stats come alive.</p>
          </div>
          <div>
            <Command />
            <p className="mono muted install-note">
              macOS 13+ · Apple Silicon & Intel · No Electron
            </p>
            <Link href="/connect" className="text-link">
              Installation guide <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
function DemoDashboard() {
  const bars = Array.from({ length: 60 }, (_, i) =>
    Math.round(
      8 +
        Math.abs(Math.sin(i * 2.8) * Math.cos(i * 0.34)) * 70 +
        (i > 27 && i < 39 ? 25 : 0),
    ),
  );
  return (
    <div className="demo-dashboard">
      <aside>
        <span className="demo-avatar">tg</span>
        <strong>
          Your corner
          <br />
          of the Grid.
        </strong>
        <span className="demo-nav selected">
          <DashboardIcon /> Overview
        </span>
        <span className="demo-nav">
          <BarChartIcon /> Leaderboard
        </span>
        <span className="demo-nav">
          <StarIcon /> Achievements
        </span>
        <div className="demo-side-bottom">
          <i className="status-dot" /> Agent connected
        </div>
      </aside>
      <div className="demo-main">
        <div className="split">
          <div>
            <span className="eyebrow">MONDAY, ON THE GRID</span>
            <h3>Looking like a good day.</h3>
          </div>
          <span className="tag">EXAMPLE DATA</span>
        </div>
        <div className="demo-metrics">
          <div>
            <span>Keystrokes today</span>
            <strong>
              24,891
              <span className="cursor" />
            </strong>
            <small>
              <i className="status-dot" /> Every little input adds up
            </small>
          </div>
          <div>
            <span>Estimated words</span>
            <strong>4,978</strong>
            <small>5 keystrokes ≈ 1 word</small>
          </div>
          <div>
            <span>Active typing</span>
            <strong>1h 42m</strong>
            <small>Your time in motion</small>
          </div>
        </div>
        <div className="split chart-heading">
          <strong>Activity pulse</strong>
          <span className="mono muted">KEYSTROKES / HOUR</span>
        </div>
        <div className="bar-chart">
          {bars.map((h, i) => (
            <div
              key={i}
              style={{ height: h + "%", animationDelay: `${i * 15}ms` }}
            />
          ))}
        </div>
        <div className="chart-axis mono">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
        <div className="demo-bottom">
          <span>
            <LightningBoltIcon /> 7-day streak
          </span>
          <span>
            <StarIcon /> Level 12 · Grid regular
          </span>
          <span className="muted">Keep showing up. It counts.</span>
        </div>
      </div>
    </div>
  );
}
export function TypeGrid({
  page,
  username,
}: {
  page: string;
  username?: string;
}) {
  const [data, setData] = useState<Data>(empty),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const refresh = async () => {
    try {
      setData(await api(page === "u" ? "profile/" + username : "me"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (page === "home") {
      setLoading(false);
      return;
    }
    refresh();
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [page, username]);
  if (page === "home") return <Home />;
  const stats = summarize(data.buckets);
  const today = new Date().toISOString().slice(0, 10);
  const todayBuckets = data.buckets.filter((b) => b.hour.startsWith(today));
  const daily = summarize(todayBuckets);
  const online = data.devices.some(
    (d) => d.lastSeen && Date.now() - Date.parse(d.lastSeen) < 20000,
  );
  async function action(path: string, body?: unknown, method?: string) {
    try {
      setError("");
      const result = await api(path, body, method);
      await refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }
  return (
    <>
      <Header />
      <div className="app-layout container">
        <aside className="sidebar">
          <div className="sidebar-label mono">YOUR WORKSPACE</div>
          {[
            ["dashboard", "Overview", DashboardIcon],
            ["leaderboard", "Leaderboard", BarChartIcon],
            ["achievements", "Achievements", StarIcon],
            ["integrations", "Integrations", Link2Icon],
            ["settings", "Settings", GearIcon],
          ].map(([path, label, Icon]) => (
            <Link
              key={String(path)}
              href={"/" + path}
              className={page === path ? "active" : ""}
            >
              {typeof Icon !== "string" && <Icon />}
              {String(label)}
            </Link>
          ))}
          <div className="sidebar-bottom">
            <div className="agent-status">
              <i className={online ? "status-dot" : "status-dot offline"} />
              {online ? "Agent connected" : "Agent offline"}
            </div>
            <Link href="/connect">
              <DesktopIcon /> Connect a machine <ArrowRightIcon />
            </Link>
            {data.user && (
              <div className="account">
                <div className="avatar">{data.user.username.slice(0, 2)}</div>
                <span>
                  @{data.user.username}
                  <small>Level {stats.level}</small>
                </span>
              </div>
            )}
          </div>
        </aside>
        <main className="workspace">
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {loading ? (
            <div className="workspace-loading" role="status" aria-live="polite">
              <p className="loading-label">
                Loading your workspace <LoadingDots />
              </p>
              <div className="skeleton" aria-hidden="true">
                <div />
                <div />
                <div />
              </div>
            </div>
          ) : (
            <>
              {page === "dashboard" && (
                <>
                  <div className="workspace-toolbar">
                    <span className="mono">
                      WORKSPACE <span className="muted">/</span> OVERVIEW
                    </span>
                    <Link href="/leaderboard" className="text-link">
                      View leaderboard <ArrowRightIcon />
                    </Link>
                  </div>
                  <div className="page-title split">
                    <div>
                      <div className="eyebrow">YOUR DAILY SIGNAL · UTC</div>
                      <h1>
                        {data.user
                          ? `Welcome back, ${data.user.username}.`
                          : "Your corner of the Grid."}
                      </h1>
                      <p>A little progress, one keystroke at a time.</p>
                    </div>
                    <span className="tag">
                      <i
                        className={online ? "status-dot" : "status-dot offline"}
                      />
                      {online ? "LIVE" : "WAITING FOR SIGNAL"}
                    </span>
                  </div>
                  {!data.user ? (
                    <SignIn />
                  ) : (
                    <>
                      {data.devices.length === 0 && (
                        <div className="onboard-banner">
                          <div>
                            <strong>
                              Your stats are ready. Connect your machine.
                            </strong>
                            <p>The native agent brings this page to life.</p>
                          </div>
                          <Link href="/connect" className="button primary">
                            Install agent <ArrowRightIcon />
                          </Link>
                        </div>
                      )}
                      <div className="metrics">
                        {[
                          [
                            "Keystrokes today",
                            fmt(daily.keys),
                            "Key-down events, nothing more",
                          ],
                          [
                            "Estimated words",
                            fmt(daily.words),
                            "5 keystrokes ≈ 1 word",
                          ],
                          [
                            "Active typing",
                            `${Math.floor(daily.active / 60)}m`,
                            "Seconds with keyboard activity",
                          ],
                          [
                            "Current streak",
                            `${stats.streak} ${stats.streak === 1 ? "day" : "days"}`,
                            "Show up. Keep the signal alive.",
                          ],
                        ].map(([label, value, sub]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                            <small>{sub}</small>
                          </div>
                        ))}
                      </div>
                      <div className="dashboard-board">
                        <Activity buckets={todayBuckets} />
                        <div className="two-col">
                          <section className="panel">
                            <div className="split">
                              <h3>Typing activity</h3>
                              <span className="tag">LAST 12 WEEKS</span>
                            </div>
                            <Heatmap days={stats.days} />
                            <div className="heatmap-legend">
                              Less{" "}
                              {[0.15, 0.35, 0.6, 1].map((n) => (
                                <i key={n} style={{ opacity: n }} />
                              ))}{" "}
                              More
                            </div>
                            <p className="muted">
                              Consistency looks good on you.
                            </p>
                          </section>
                          <section className="panel">
                            <div className="split">
                              <h3>Level {stats.level}</h3>
                              <LightningBoltIcon />
                            </div>
                            <div className="level-number pixel">
                              {String(stats.level).padStart(2, "0")}
                            </div>
                            <div className="progress">
                              <span
                                style={{
                                  width: `${Math.min(100, (stats.xp / stats.nextLevel) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="mono muted">
                              {fmt(stats.xp)} / {fmt(stats.nextLevel)} XP
                            </p>
                          </section>
                        </div>
                      </div>
                      <CodingStats />
                      <div className="metrics compact">
                        {[
                          ["Sessions today", daily.sessions],
                          ["Peak WPM (estimated)", stats.peak],
                          ["Best day", fmt(stats.record)],
                          [
                            "Dev app share",
                            stats.keys
                              ? Math.round((stats.dev / stats.keys) * 100) + "%"
                              : "—",
                          ],
                        ].map(([l, v]) => (
                          <div key={l}>
                            <span>{l}</span>
                            <strong>{v}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {page === "leaderboard" && <Leaderboard />}
              {page === "achievements" && (
                <>
                  <PageTitle
                    eyebrow="SMALL WINS. LASTING SIGNAL."
                    title="Earned, one key at a time."
                    text="No grind required. Just keep doing your thing."
                  />
                  {!data.user && <SignIn />}
                  <div className="achievement-grid">
                    {achievements.map((a) => {
                      const value = stats[a.metric],
                        unlocked = value >= a.target;
                      return (
                        <section
                          className={
                            "achievement " + (unlocked ? "unlocked" : "")
                          }
                          key={a.id}
                        >
                          <div className="achievement-icon">
                            {unlocked ? <StarIcon /> : <LockClosedIcon />}
                          </div>
                          <span className="mono muted">
                            {unlocked ? "UNLOCKED" : "IN PROGRESS"}
                          </span>
                          <h3>{a.name}</h3>
                          <p>{a.description}</p>
                          <div className="progress">
                            <span
                              style={{
                                width: `${Math.min(100, (value / a.target) * 100)}%`,
                              }}
                            />
                          </div>
                          <small className="mono">
                            {fmt(Math.min(value, a.target))} / {fmt(a.target)}
                          </small>
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
              {page === "connect" && (
                <>
                  <PageTitle
                    eyebrow="WELCOME TO THE GRID"
                    title="Connect your machine."
                    text="Three small steps. Then your stats start moving."
                  />
                  <div className="steps">
                    <section>
                      <b>01</b>
                      <div>
                        <h3>Make it yours.</h3>
                        <p>Sign in with GitHub. Your profile starts private.</p>
                        {data.user ? (
                          <span className="tag accent">
                            <CheckIcon /> Signed in as @{data.user.username}
                          </span>
                        ) : (
                          <SignIn />
                        )}
                      </div>
                    </section>
                    <section>
                      <b>02</b>
                      <div>
                        <h3>Install the tiny agent.</h3>
                        <p>
                          Native Swift. No Electron. Runs quietly in your menu
                          bar.
                        </p>
                        <Command />
                        <p className="mono muted">
                          macOS 13+ · Requires Apple Command Line Tools for this
                          source release.
                        </p>
                        <a
                          className="text-link"
                          href={repo + "/blob/main/docs/INSTALL.md"}
                        >
                          Inspect the installer & source <ExternalLinkIcon />
                        </a>
                      </div>
                    </section>
                    <section>
                      <b>03</b>
                      <div>
                        <h3>Pair. Allow. You’re on the Grid.</h3>
                        <p>
                          Run <code>typegrid pair</code>, then enter the code
                          shown by the agent below. Approve Input Monitoring in
                          macOS when prompted.
                        </p>
                        {data.user ? (
                          <Pair
                            action={action}
                            onSuccess={() =>
                              setNotice(
                                "Machine connected. Your dashboard will update as you type.",
                              )
                            }
                          />
                        ) : (
                          <p>Sign in to pair your machine.</p>
                        )}
                      </div>
                    </section>
                  </div>
                  <Link href="/dashboard" className="button primary">
                    Open your dashboard <ArrowRightIcon />
                  </Link>
                </>
              )}
              {page === "integrations" && (
                <>
                  <PageTitle
                    eyebrow="MORE CONTEXT. SAME PRIVACY."
                    title="Connect your toolkit."
                    text="Your keystrokes work out of the box. Add the tools that tell more of your story."
                  />
                  <section className="integration">
                    <div className="integration-icon">
                      <GitHubLogoIcon />
                    </div>
                    <div>
                      <h3>
                        GitHub <span className="tag">AVAILABLE</span>
                      </h3>
                      <p>
                        Public repositories, followers, and recent public
                        events. No private repository access.
                      </p>
                      {data.github && (
                        <p className="mono accent">
                          {data.github.repos} repos · {data.github.followers}{" "}
                          followers · {data.github.contributions} recent public
                          events
                        </p>
                      )}
                    </div>
                    {data.user ? (
                      <button
                        className="button"
                        onClick={() =>
                          action("github/sync", {}).then(
                            (r) => r && setNotice("GitHub stats refreshed."),
                          )
                        }
                      >
                        {data.user.githubConnected
                          ? "Refresh stats"
                          : "Connect GitHub"}{" "}
                        <ArrowRightIcon />
                      </button>
                    ) : (
                      <a className="button" href="/api/auth/github">
                        Connect GitHub <ArrowRightIcon />
                      </a>
                    )}
                  </section>
                  <CodingConnections />
                  <p className="muted integration-note">
                    <LockClosedIcon /> We won’t ask for session cookies or read
                    your chat history. Unsupported connections stay unavailable.
                  </p>
                </>
              )}
              {page === "settings" && (
                <>
                  <PageTitle
                    eyebrow="YOUR NODE, YOUR RULES"
                    title="Keep it personal."
                    text="Choose how you appear on the Grid."
                  />
                  {data.user ? (
                    <Settings data={data} action={action} refresh={refresh} />
                  ) : (
                    <SignIn />
                  )}
                </>
              )}
              {page === "u" && (
                <>
                  {data.user ? (
                    <>
                      <div className="profile-head">
                        <div className="avatar large">
                          {data.user.avatar ? (
                            <img src={data.user.avatar} alt="" />
                          ) : (
                            data.user.username.slice(0, 2)
                          )}
                        </div>
                        <div>
                          <span className="eyebrow">
                            GRID MEMBER · LEVEL {stats.level}
                          </span>
                          <h1>@{data.user.username}</h1>
                          <p>{data.user.bio || "Every keystroke counts."}</p>
                        </div>
                      </div>
                      <div className="metrics">
                        <div>
                          <span>All-time keystrokes</span>
                          <strong>{fmt(stats.keys)}</strong>
                        </div>
                        <div>
                          <span>Current streak</span>
                          <strong>{stats.streak} days</strong>
                        </div>
                        <div>
                          <span>Estimated words</span>
                          <strong>{fmt(stats.words)}</strong>
                        </div>
                        <div>
                          <span>Level</span>
                          <strong>{stats.level}</strong>
                        </div>
                      </div>
                      <CodingStats username={username} />
                      <Heatmap days={stats.days} />
                      <div className="badge-row">
                        {achievements
                          .filter((a) => stats[a.metric] >= a.target)
                          .map((a) => (
                            <span className="tag" key={a.id}>
                              <StarIcon />
                              {a.name}
                            </span>
                          ))}
                      </div>
                    </>
                  ) : (
                    <PageTitle
                      title="Profile unavailable."
                      text="This profile is private or doesn’t exist."
                    />
                  )}
                </>
              )}
              {page === "privacy" && <Privacy />}
            </>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-title">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function SignIn() {
  return (
    <div className="signin">
      <a className="button primary" href="/api/auth/github">
        <GitHubLogoIcon /> Continue with GitHub <ArrowRightIcon />
      </a>
      <p className="muted">Free forever. Private by default.</p>
    </div>
  );
}
function Pair({
  action,
  onSuccess,
}: {
  action: (p: string, b?: unknown) => Promise<any>;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="pair-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await action("devices/approve", { code });
        setBusy(false);
        if (r) {
          setCode("");
          onSuccess();
        }
      }}
    >
      <label>
        Pairing code
        <input
          required
          minLength={8}
          maxLength={9}
          placeholder="ABCD-EFGH"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </label>
      <button disabled={busy} className="button primary">
        {busy ? (
          <>
            <Spinner /> Connecting
          </>
        ) : (
          "Connect machine"
        )}
      </button>
    </form>
  );
}
function Activity({ buckets }: { buckets: Bucket[] }) {
  const counts = Array.from({ length: 24 }, (_, h) =>
    buckets
      .filter((b) => new Date(b.hour).getUTCHours() === h)
      .reduce((n, b) => n + b.keystrokes, 0),
  );
  const max = Math.max(1, ...counts);
  return (
    <section className="panel activity">
      <div className="split">
        <h3>Activity pulse</h3>
        <span className="mono muted">KEYSTROKES / HOUR · UTC</span>
      </div>
      <div className="bar-chart real">
        {counts.map((v, i) => (
          <div
            key={i}
            title={`${i}:00 UTC: ${fmt(v)} keystrokes`}
            style={{ height: Math.max(1, (v / max) * 100) + "%" }}
          />
        ))}
      </div>
      <div className="chart-axis mono">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </section>
  );
}
function Heatmap({ days }: { days: Record<string, number> }) {
  return (
    <div
      className="heatmap"
      aria-label="Daily keystroke activity for the last 84 days"
    >
      {Array.from({ length: 84 }, (_, i) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - 83 + i);
        const key = date.toISOString().slice(0, 10),
          v = days[key] || 0;
        return (
          <div
            key={key}
            title={`${key}: ${fmt(v)} keystrokes`}
            style={{
              background: v
                ? `rgba(146,245,114,${Math.min(0.95, 0.2 + v / 20000)})`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
function Settings({
  data,
  action,
  refresh,
}: {
  data: Data;
  action: (p: string, b?: unknown, m?: string) => Promise<any>;
  refresh: () => Promise<void>;
}) {
  const u = data.user!;
  const [username, setUsername] = useState(u.username),
    [bio, setBio] = useState(u.bio),
    [avatar, setAvatar] = useState(u.avatar),
    [isPublic, setPublic] = useState(u.isPublic),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <>
      <form
        className="settings-form"
        noValidate
        onChange={() => {
          setSaved(false);
          setSaveError("");
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setSaved(false);
          setSaveError("");
          try {
            const canonicalUsername = username.trim().toLowerCase();
            await api(
              "profile",
              { username: canonicalUsername, bio, avatar, isPublic },
              "PATCH",
            );
            setUsername(canonicalUsername);
            await refresh();
            setSaved(true);
          } catch (error) {
            setSaveError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Username
          <input
            required
            minLength={3}
            maxLength={24}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <small>
            3–24 letters, numbers, underscores or hyphens. Saved in lowercase.
          </small>
        </label>
        <label>
          Bio
          <textarea
            value={bio}
            maxLength={160}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A few words about your corner of the internet."
          />
        </label>
        <label>
          Avatar URL
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://avatars.githubusercontent.com/u/…"
          />
          <small>
            GitHub avatar URLs only. No third-party tracking images.
          </small>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setPublic(e.target.checked)}
          />
          <span>
            Make my profile public
            <small>
              Show aggregate stats and join the leaderboard. Detailed hourly
              activity stays private.
            </small>
          </span>
        </label>
        <button type="submit" disabled={busy} className="button primary">
          {busy ? (
            <>
              <Spinner /> Saving
            </>
          ) : (
            <>
              {saved ? "Saved" : "Save changes"} <CheckIcon />
            </>
          )}
        </button>
        {saveError && (
          <p className="error" role="alert">
            {saveError}
          </p>
        )}
        {saved && (
          <p role="status">
            Your profile is saved.{" "}
            {u.isPublic
              ? "Your profile is public."
              : "Your profile is private."}
          </p>
        )}
        {u.isPublic && (
          <Link href={"/u/" + u.username} className="text-link">
            View public profile <ArrowRightIcon />
          </Link>
        )}
      </form>
      <section className="panel">
        <h3>Connected machines</h3>
        {data.devices.length ? (
          data.devices.map((d) => (
            <div className="device-row" key={d.id}>
              <DesktopIcon />
              <span>
                {d.name}
                <small>
                  {d.lastSeen
                    ? "Last seen " + new Date(d.lastSeen).toLocaleString()
                    : "Waiting for first sync"}
                </small>
              </span>
              <button
                className="button small"
                onClick={() => action("devices/" + d.id, {}, "DELETE")}
              >
                Revoke
              </button>
            </div>
          ))
        ) : (
          <p className="muted">No machines connected yet.</p>
        )}
        <Link href="/connect" className="text-link">
          Connect a machine <ArrowRightIcon />
        </Link>
      </section>
      <div className="settings-actions">
        <a className="button" href="/api/export">
          <DownloadIcon /> Export my data
        </a>
        <button
          className="button"
          onClick={async () => {
            await action("auth/logout", {});
            location.href = "/";
          }}
        >
          <ExitIcon /> Sign out
        </button>
        <button
          className="button danger"
          onClick={async () => {
            if (
              confirm(
                "Permanently delete your profile, stats, sessions, and device access? This cannot be undone.",
              )
            ) {
              const r = await action("account", {}, "DELETE");
              if (r) location.href = "/";
            }
          }}
        >
          Delete account
        </button>
      </div>
    </>
  );
}
function Privacy() {
  return (
    <article className="privacy-page">
      <PageTitle
        eyebrow="THE TYPEGRID PRIVACY PROMISE"
        title="We count. We don’t read."
        text="A stats tool should never need to know what you type."
      />
      {[
        [
          "What the agent sees",
          "A macOS key-down event occurred. The callback increments a counter without inspecting the event’s key code or character. It never reads typed strings, the clipboard, window titles, file paths, browser URLs, or screenshots.",
        ],
        [
          "What stays on your machine",
          "A compact queue of hourly aggregate counters, your device credential, and preferences. Dev-app classification checks the foreground app’s bundle identifier locally against a small allowlist; only dev/general totals leave your machine. Classification can be disabled.",
        ],
        [
          "What reaches the server",
          "Device ID, UTC hour, cumulative keystrokes, active typing seconds, session count, dev-app count, and estimated peak WPM. Hourly buckets update every five seconds while connected. No individual-event timestamps or sequences are persisted or transmitted.",
        ],
        [
          "What other people can see",
          "Profiles start private. If you opt in, your username, avatar, bio, daily totals, levels, achievements and streaks are public. Hourly patterns, session detail, devices and integration details stay private.",
        ],
        [
          "The honest limits",
          "Aggregate timing can still reveal habits. The server necessarily handles IP addresses for HTTP requests, and our hosting provider may retain operational logs. No advertising analytics are installed. Secure Input may cause macOS to suppress events, so counts are approximate. Keystrokes include shortcuts, modifiers may not count, and held keys may repeat.",
        ],
        [
          "Your controls",
          "Pause or quit the menu-bar agent at any time. Disable app classification with typegrid classify off. Revoke a device, switch your profile to private, export data, or delete your account in Settings. Local unsynced counters expire after 30 days. Server aggregates remain until you delete the account.",
        ],
        [
          "GitHub and AI tools",
          "GitHub sign-in uses the public identity scope. We discard the GitHub token after sign-in; public contribution data can be refreshed separately. Optional Claude Code and Codex connections collect aggregate tokens and work time through the background Mac app. Public profiles include AI totals. We do not ingest AI prompts, transcripts, raw telemetry logs, or account cookies.",
        ],
      ].map(([h, p]) => (
        <section key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </section>
      ))}
      <a className="text-link" href={repo}>
        Audit the source <GitHubLogoIcon />
      </a>
    </article>
  );
}
