CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, github_id text UNIQUE NOT NULL, github_login text NOT NULL,
 username text UNIQUE NOT NULL, avatar text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '',
 is_public boolean NOT NULL DEFAULT false, github_stats jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);

-- Private, optional daily targets. Existing visibility and tracking stay intact.
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_goals jsonb;
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS devices (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL, name text NOT NULL DEFAULT 'Mac', last_seen timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id);
CREATE TABLE IF NOT EXISTS pairing (
 secret_hash text PRIMARY KEY, code text UNIQUE NOT NULL, user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS buckets (
 device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE, hour timestamptz NOT NULL,
 keystrokes integer NOT NULL CHECK(keystrokes BETWEEN 0 AND 360000),
 active_seconds integer NOT NULL CHECK(active_seconds BETWEEN 0 AND 3600),
 sessions integer NOT NULL CHECK(sessions BETWEEN 0 AND 3600),
 dev_keystrokes integer NOT NULL CHECK(dev_keystrokes BETWEEN 0 AND keystrokes),
 peak_wpm integer NOT NULL CHECK(peak_wpm BETWEEN 0 AND 1200),
 PRIMARY KEY(device_id,hour)
);
CREATE INDEX IF NOT EXISTS buckets_hour ON buckets(hour);
CREATE TABLE IF NOT EXISTS rate_limits (
 key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);

ALTER TABLE devices ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS coding_buckets (
 device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 stream_id uuid NOT NULL, hour timestamptz NOT NULL,
 provider text NOT NULL CHECK(provider IN ('claude','codex')),
 tokens bigint NOT NULL CHECK(tokens BETWEEN 0 AND 1000000000),
 work_seconds double precision NOT NULL CHECK(work_seconds BETWEEN 0 AND 864000),
 PRIMARY KEY(device_id,stream_id,hour,provider)
);
CREATE INDEX IF NOT EXISTS coding_hour ON coding_buckets(hour);

ALTER TABLE coding_buckets DROP CONSTRAINT IF EXISTS coding_buckets_provider_check;
ALTER TABLE coding_buckets ADD CONSTRAINT coding_buckets_provider_check CHECK(provider IN ('claude','codex','cursor'));

ALTER TABLE devices ADD COLUMN IF NOT EXISTS coding_providers text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Existing privacy choices stay intact; only future accounts default public.
ALTER TABLE users ALTER COLUMN is_public SET DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_ready boolean NOT NULL DEFAULT true;
ALTER TABLE users ALTER COLUMN onboarding_ready SET DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS input_monitoring boolean;

-- Additive migration: old agents and existing activity keep working.
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0 CHECK(clicks BETWEEN 0 AND 360000);

-- Short-lived, single-use, PKCE-bound desktop sign-ins. Device credentials never grant account sessions.
CREATE TABLE IF NOT EXISTS desktop_logins (
 request_hash text PRIMARY KEY, challenge text NOT NULL,
 user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);

ALTER TABLE buckets ADD COLUMN IF NOT EXISTS mouse_active_seconds double precision NOT NULL DEFAULT 0 CHECK(mouse_active_seconds BETWEEN 0 AND 3600);
