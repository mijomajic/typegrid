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
