-- Saved segments (the dashboard-wide filter), share links, and scheduled
-- reports / alerts. Same conventions as 0001: nanoid ids, ISO timestamps
-- maintained by triggers, plural names.

CREATE TABLE segments (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  name       TEXT NOT NULL,
  -- One condition: an entity kind (entities.ts), an operator (eq, neq,
  -- contains, not_contains) and the value. Workspace-shared, like dashboards.
  kind       TEXT NOT NULL,
  op         TEXT NOT NULL,
  value      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER touch_segments AFTER UPDATE ON segments
BEGIN
  UPDATE segments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- A share link: a read-only view of one dashboard for one site, reachable at
-- /share/<token> without the deployment's gate. The period can be locked
-- (JSON of the range params) and a segment pinned (the URL form, 'kind:op:value'),
-- which is how a filtered slice is shared without exposing the rest.
CREATE TABLE shares (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL DEFAULT '',
  lock_range   TEXT,
  seg          TEXT,
  revoked_at   TEXT
);

CREATE INDEX shares_dashboard ON shares (dashboard_id);

CREATE TRIGGER touch_shares AFTER UPDATE ON shares
BEGIN
  UPDATE shares SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- Scheduled reports and alerts, delivered by email (Resend) or a Slack
-- incoming webhook. `kind`: weekly / monthly summaries; spike (live visitors
-- at or above `threshold`) and drop (visits in the last 12 hours below it).
CREATE TABLE reports (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('weekly', 'monthly', 'spike', 'drop')),
  channel      TEXT NOT NULL CHECK (channel IN ('email', 'slack')),
  -- An email address, or a Slack incoming-webhook URL.
  target       TEXT NOT NULL,
  threshold    INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1,
  -- The last period (YYYY-MM-DD of its first day) a summary was sent for, or
  -- the last time an alert fired; alerts wait 12 hours before firing again.
  last_period  TEXT,
  last_sent_at TEXT,
  last_error   TEXT
);

CREATE INDEX reports_site ON reports (site_id);

CREATE TRIGGER touch_reports AFTER UPDATE ON reports
BEGIN
  UPDATE reports SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
