"use client";
import Link from "next/link";
import { ProfileHistory, type CodingDay } from "./profile-history";
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
const macDownload =
  "https://github.com/mijomajic/typegrid/releases/download/v0.2.0/TypeGrid.dmg";
const install = "curl -fsSL https://typegrid.dev/install.sh | sh";
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
type User = {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  isPublic: boolean;
  onboardingReady: boolean;
  githubLogin: string;
  githubConnected: boolean;
};
type Data = {
  viewer?: User | null;
  isOwner?: boolean;
  detailed?: boolean;
  codingHistory?: CodingDay[];
  user: User | null;
  buckets: Bucket[];
  devices: {
    id: string;
    name: string;
    lastSeen: string | null;
    inputMonitoring?: boolean | null;
  }[];
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
function Logo({ workspace = false }: { workspace?: boolean }) {
  return (
    <Link href={workspace ? "/app" : "/"} className="logo" aria-label={workspace ? "TypeGrid workspace" : "TypeGrid home"}>
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M20 6H44Q48 6 51 9L55 13L45 23L41 19H23L19 23V41L23 45H41L45 41V37H32V27H58V45Q58 49 55 52L52 55Q49 58 45 58H19Q15 58 12 55L9 52Q6 49 6 45V19Q6 15 9 12L12 9Q15 6 20 6Z"
          transform="rotate(-45 32 32)"
          fill="currentColor"
        />
      </svg>
      typegrid{!workspace && <span className="beta">BETA</span>}
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
        <nav aria-label="Website">
          <a href={macDownload}>Download for Mac</a>
          <Link href="/privacy">Privacy</Link>
          <a href={repo} target="_blank" rel="noreferrer">
            GitHub <ExternalLinkIcon />
          </a>
        </nav>
        <Link className="button small" href="/app">
          Open app <ArrowRightIcon />
        </Link>
      </div>
    </header>
  );
}
function AppHeader({ username }: { username?: string }) {
  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        <Logo workspace /><span className="workspace-label">Workspace</span>
      </div>
      <nav aria-label="Workspace account">
        {username ? (
          <Link href="/app/settings">@{username}</Link>
        ) : (
          <a href="/" target="_blank" rel="noreferrer">
            About TypeGrid
          </a>
        )}
        <Link href="/privacy">Privacy</Link>
      </nav>
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
              Every keystroke and click counts. See your rhythm in stats,
              streaks, and a little friendly competition. In your Mac app and
              menu bar.
            </p>
            <div className="hero-install" id="download">
              <span className="mono install-label">
                INSTALL TYPEGRID · MACOS
              </span>
              <p className="install-note">
                Download the app, drag it into Applications, and open TypeGrid.
              </p>
              <p className="install-note">
                Then,{" "}
                <Link href="/app/connect">
                  sign in and choose your profile visibility
                </Link>{" "}
                to connect your Mac.
              </p>
              <p className="install-note">
                macOS 13+ · Apple silicon & Intel · Automatic updates
              </p>
            </div>
            <div className="hero-actions">
              <a href={macDownload} className="button primary">
                <DownloadIcon /> Download for Mac
              </a>
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
              only counts keyboard and mouse-click events — never which key you
              pressed or where you clicked.
            </p>
            <div className="privacy-facts">
              <span>
                <CheckIcon /> No key codes, typed text, or click positions
              </span>
              <span>
                <CheckIcon /> No window titles or browsing history
              </span>
              <span>
                <CheckIcon /> You choose your profile visibility
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
            <p>
              Download. Sign in. Choose your visibility. Watch your stats come
              alive.
            </p>
          </div>
          <div>
            <a href={macDownload} className="button primary"><DownloadIcon /> Download for Mac</a>
            <p className="install-note">
              <Link href="/app/connect">
                Sign in and choose your profile visibility
              </Link>{" "}
              when connecting your Mac.
            </p>
            <p className="mono muted install-note">
              macOS 13+ · Apple Silicon & Intel · No Electron
            </p>
            <Link href="/app/connect" className="text-link">
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
            <span>Clicks today</span>
            <strong>1,284</strong>
            <small>Mouse and trackpad clicks</small>
          </div>
          <div>
            <span>Active mouse</span>
            <strong>38m</strong>
            <small>Pauses after 3 seconds idle</small>
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
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false);
  const refresh = async () => {
    try {
      setData(
        await api(
          page === "u"
            ? "profile/" + username + (preview ? "?view=public" : "")
            : "me",
        ),
      );
      setError("");
    } catch (e) {
      if (page === "u") setData(empty);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (page === "home" || page === "privacy") {
      setLoading(false);
      return;
    }
    refresh();
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [page, username, preview]);
  if (page === "home") return <Home />;
  if (page === "privacy")
    return (
      <>
        <Header />
        <main className="container">
          <Privacy />
        </main>
        <Footer />
      </>
    );
  const viewer = page === "u" ? data.viewer : data.user;
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
  if (!loading && !viewer && page !== "u" && page !== "connect") {
    return (
      <div className="workspace-gateway">
        <AppHeader />
        <main className="workspace-signin">
          <span className="eyebrow">YOUR TYPEGRID WORKSPACE</span>
          <h1>A place for your progress.</h1>
          <p>
            Sign in to see your stats, compare the leaderboard, and manage your
            Macs.
          </p>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <SignIn />
          <a href="/" className="text-link" target="_blank" rel="noreferrer">
            Discover TypeGrid <ArrowRightIcon />
          </a>
        </main>
      </div>
    );
  }
  return (
    <div className="workspace-shell">
      <AppHeader username={viewer?.username} />
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
              href={"/app/" + path}
              className={page === path ? "active" : ""}
            >
              {typeof Icon !== "string" && <Icon />}
              {String(label)}
            </Link>
          ))}
          {viewer && (
            <Link
              href={"/u/" + viewer.username}
              className={page === "u" && data.isOwner ? "active" : ""}
            >
              <GlobeIcon />
              My profile
            </Link>
          )}
          <div className="sidebar-bottom">
            {page !== "u" && (
              <div className="agent-status">
                <i className={online ? "status-dot" : "status-dot offline"} />
                {online ? "Agent connected" : "Agent offline"}
              </div>
            )}
            <Link href="/app/connect">
              <DesktopIcon /> Connect a machine <ArrowRightIcon />
            </Link>
            {viewer && (
              <Link className="account" href={"/u/" + viewer.username}>
                <div className="avatar">{viewer.username.slice(0, 2)}</div>
                <span>
                  @{viewer.username}
                  <small>View your profile</small>
                </span>
              </Link>
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
                    <Link href="/app/leaderboard" className="text-link">
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
                          <Link href="/app/connect" className="button primary">
                            Install agent <ArrowRightIcon />
                          </Link>
                        </div>
                      )}
                      <div className="metrics input-metrics mouse-metrics">
                        {[
                          [
                            "Keystrokes today",
                            fmt(daily.keys),
                            "Key-down events, nothing more",
                          ],
                          [
                            "Clicks today",
                            fmt(daily.clicks),
                            "Mouse and trackpad button presses",
                          ],
                          [
                            "Estimated words",
                            fmt(daily.words),
                            "5 keystrokes ≈ 1 word",
                          ],
                          [
                            "Active mouse",
                            `${Math.floor(daily.mouseActive / 60)}m ${Math.floor(daily.mouseActive % 60)}s`,
                            "Pauses after 3 seconds without mouse activity",
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
              {page === "connect" && <Onboarding data={data} action={action} />}
              {page === "integrations" && (
                <>
                  <PageTitle
                    eyebrow="MORE CONTEXT. SAME PRIVACY."
                    title="Connect your toolkit."
                    text="Your keystrokes and clicks work out of the box. Add the tools that tell more of your story."
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
                  {data.user && <CodingStats />}
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
                      {data.isOwner && (
                        <div className="workspace-toolbar">
                          <span className="tag">
                            {data.user.isPublic
                              ? "Public profile"
                              : "Private · only you can view this"}
                          </span>
                          <div className="profile-actions">
                            <button
                              className="button small"
                              aria-pressed={preview}
                              onClick={() => setPreview(!preview)}
                            >
                              {preview
                                ? "Back to my stats"
                                : "Preview public appearance"}
                            </button>
                            <Link className="button small" href="/app/settings">
                              Edit profile
                            </Link>
                          </div>
                        </div>
                      )}
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
                      <div className="metrics input-metrics">
                        <div>
                          <span>All-time keystrokes</span>
                          <strong>{fmt(stats.keys)}</strong>
                        </div>
                        <div>
                          <span>All-time clicks</span>
                          <strong>{fmt(stats.clicks)}</strong>
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
                      <ProfileHistory
                        buckets={data.buckets}
                        coding={data.codingHistory ?? []}
                        detailed={!!data.detailed}
                      />
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
    </div>
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
      <p className="muted">
        New profiles appear on the leaderboard. You can choose a private profile
        before installing.
      </p>
    </div>
  );
}
function Onboarding({
  data,
  action,
}: {
  data: Data;
  action: (p: string, b?: unknown, method?: string) => Promise<any>;
}) {
  const [code, setCode] = useState("");
  const [manual, setManual] = useState(false);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(navigator.userAgent.includes("TypeGridDesktop"));
  }, []);
  const [isPublic, setPublic] = useState(data.user?.isPublic ?? true);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    const receiveCode = () => {
      const incoming = new URLSearchParams(window.location.hash.slice(1)).get(
        "pair",
      );
      const saved = sessionStorage.getItem("typegrid-pair");
      if (incoming && /^[A-Z]{8}$/.test(incoming)) {
        setApproved(false);
        setCode(incoming);
        sessionStorage.setItem("typegrid-pair", incoming);
        history.replaceState(null, "", window.location.pathname);
      } else if (saved && /^[A-Z]{8}$/.test(saved)) setCode(saved);
    };
    receiveCode();
    window.addEventListener("hashchange", receiveCode);
    return () => window.removeEventListener("hashchange", receiveCode);
  }, []);
  const ready = !!data.user?.onboardingReady;
  const paired = approved || (data.devices.length > 0 && !code && !manual);
  const live = data.devices.some(
    (d) =>
      d.lastSeen &&
      Date.now() - Date.parse(d.lastSeen) < 30000 &&
      d.inputMonitoring,
  );
  const active = !data.user ? 1 : !ready ? 2 : !paired ? 3 : 4;
  return (
    <>
      <PageTitle
        eyebrow={"GET STARTED · STEP " + active + " OF 4"}
        title="Your place on the Grid."
        text="Sign in, choose your visibility, and run one command. We’ll guide you through the rest."
      />
      <div className="steps onboarding-steps">
        <section>
          <b>{data.user ? "✓" : "01"}</b>
          <div>
            <h3>Sign in with GitHub.</h3>
            {data.user ? (
              <p className="accent">Signed in as @{data.user.username}</p>
            ) : (
              <SignIn />
            )}
          </div>
        </section>
        <section aria-disabled={!data.user}>
          <b>{ready ? "✓" : "02"}</b>
          <div>
            <h3>Choose your profile visibility.</h3>
            {!data.user ? (
              <p>Available after GitHub sign-in.</p>
            ) : ready ? (
              <p>
                {data.user.isPublic
                  ? "Public · Your counts appear on the leaderboard."
                  : "Private · Your counts are visible only to you."}{" "}
                <Link href="/app/settings">Change in Settings ↗</Link>
              </p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await action(
                      "profile",
                      {
                        username: data.user!.username,
                        avatar: data.user!.avatar,
                        bio: data.user!.bio,
                        isPublic,
                      },
                      "PATCH",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="onboarding-visibility">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setPublic(e.target.checked)}
                  />
                  Show my profile and counts on the leaderboard
                </label>
                <p>
                  Public by default. Your username, avatar, daily counts and AI
                  totals are public. Detailed activity and connected machines
                  stay private. Uncheck to keep your profile private.
                </p>
                <button className="button primary" disabled={busy}>
                  {busy ? "Saving…" : "Save and continue"}
                </button>
              </form>
            )}
          </div>
        </section>
        <section aria-disabled={!ready}>
          <b>{paired ? "✓" : "03"}</b>
          <div>
            <h3>Install and pair your Mac.</h3>
            {!ready ? (
              <p>Confirm your profile to unlock installation.</p>
            ) : paired ? (
              <div>
                <p>Mac paired. The installer starts TypeGrid automatically.</p>
                <button
                  className="text-link"
                  onClick={() => {
                    setApproved(false);
                    setManual(true);
                  }}
                >
                  Add another Mac
                </button>
              </div>
            ) : (
              <>
                {desktop ? (
                  <>
                    <p>
                      Connect this app to your account. Confirm the pairing code
                      below to start counting on this Mac.
                    </p>
                    <a className="button primary" href="typegrid://pair">
                      Connect this Mac <ArrowRightIcon />
                    </a>
                  </>
                ) : (
                  <>
                    <p>
                      Download TypeGrid, drag it into Applications, and open it.
                      Your stats and leaderboard live in the app, with automatic
                      updates built in.
                    </p>
                    <a className="button primary" href={macDownload}>
                      <DownloadIcon /> Download for Mac
                    </a>
                    <p className="muted">
                      macOS 13+ · Apple Silicon and Intel · Automatic updates
                    </p>
                    <details className="source-install">
                      <summary>Install from source with Terminal</summary>
                      <Command />
                      <p className="muted">
                        Builds locally using Apple Command Line Tools. The
                        installer guides you through pairing.
                      </p>
                    </details>
                  </>
                )}
                {code || manual ? (
                  <form
                    className="pair-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        const result = await action("devices/approve", {
                          code,
                        });
                        if (result) {
                          setApproved(true);
                          setCode("");
                          sessionStorage.removeItem("typegrid-pair");
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Confirm the code matches your Terminal
                      <input
                        required
                        pattern="[A-Za-z]{4}-?[A-Za-z]{4}"
                        minLength={8}
                        maxLength={9}
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.toUpperCase().trim())
                        }
                        placeholder="ABCD-EFGH"
                        autoComplete="off"
                      />
                    </label>
                    <button className="button primary" disabled={busy}>
                      {busy ? "Pairing…" : "Pair this Mac"}
                    </button>
                  </form>
                ) : (
                  <button className="text-link" onClick={() => setManual(true)}>
                    Already have a pairing code?
                  </button>
                )}
              </>
            )}
          </div>
        </section>
        <section aria-disabled={!ready || !paired}>
          <b>{live ? "✓" : "04"}</b>
          <div>
            <h3>Allow counting. Start typing.</h3>
            {!ready || !paired ? (
              <p>Available once your Mac is paired.</p>
            ) : (
              <>
                <p>
                  {live
                    ? "TypeGrid is running with Input Monitoring enabled. Type a few keys to see your first counts."
                    : "In System Settings → Privacy & Security → Input Monitoring, enable TypeGrid.app. The agent retries automatically; keep the installer open until it finishes."}
                </p>
                {!live && (
                  <p className="muted" role="status">
                    Waiting for permission and the agent’s first sync. If macOS
                    asks you to quit and reopen TypeGrid, rerun the same install
                    command.
                  </p>
                )}
                {live && (
                  <Link href="/app/dashboard" className="button primary">
                    Open your dashboard <ArrowRightIcon />
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function Activity({ buckets }: { buckets: Bucket[] }) {
  const [metric, setMetric] = useState<"keystrokes" | "clicks">("keystrokes");
  const counts = Array.from({ length: 24 }, (_, h) =>
    buckets
      .filter((b) => new Date(b.hour).getUTCHours() === h)
      .reduce((n, b) => n + (b[metric] ?? 0), 0),
  );
  const max = Math.max(1, ...counts);
  return (
    <section className="panel activity">
      <div className="split">
        <h3>Activity pulse</h3>
        <label className="mono muted">
          <select
            aria-label="Activity metric"
            value={metric}
            onChange={(e) =>
              setMetric(e.target.value as "keystrokes" | "clicks")
            }
          >
            <option value="keystrokes">Keystrokes</option>
            <option value="clicks">Clicks</option>
          </select>{" "}
          / HOUR · UTC
        </label>
      </div>
      <div className="bar-chart real">
        {counts.map((v, i) => (
          <div
            key={i}
            title={`${i}:00 UTC: ${fmt(v)} ${metric}`}
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
        <Link href="/app/connect" className="text-link">
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
            location.href = "/app";
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
              if (r) location.href = "/app";
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
        text="A stats tool should never need to know what you type or where you click."
      />
      {[
        [
          "What the agent sees",
          "A macOS key-down or mouse-button-down event occurred. The callback increments separate keyboard and click counters without inspecting key codes, characters, click positions, or clicked content. Left, right, and other mouse buttons share one click total; trackpad clicks count too. Movement, dragging, clicks, and scrolling also keep a separate active mouse timer running. It stops three seconds after the last event. Movement and scrolling do not add clicks; button releases are ignored. It never reads typed strings, the clipboard, window titles, file paths, browser URLs, or screenshots.",
        ],
        [
          "What stays on your machine",
          "A compact queue of hourly aggregate counters, your device credential, and preferences. Dev-app classification checks the foreground app’s bundle identifier locally against a small allowlist; only dev/general totals leave your machine. Classification can be disabled.",
        ],
        [
          "What reaches the server",
          "Device ID, UTC hour, cumulative keystrokes and clicks, active typing and active mouse seconds, session count, dev-app count, and estimated peak WPM. Hourly buckets update every five seconds while connected. No individual-event timestamps or sequences are persisted or transmitted.",
        ],
        [
          "What other people can see",
          "New profiles start public. You can choose private during setup or in Settings. Public profiles share your username, avatar, bio, daily totals, levels, achievements and streaks. Hourly patterns, session detail, devices and integration details stay private.",
        ],
        [
          "The honest limits",
          "Aggregate timing can still reveal habits. The server necessarily handles IP addresses for HTTP requests, and our hosting provider may retain operational logs. No advertising analytics are installed. Secure Input may cause macOS to suppress events, so counts are approximate. Keystrokes include shortcuts, modifiers may not count, and held keys may repeat. A double-click counts as two presses. Clicks do not affect estimated words, WPM, typing time, streaks, or keyboard rankings.",
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
