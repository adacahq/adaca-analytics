-- Drill-down: pair families (two dimensions per rollup row) and entity pages.
--
-- sites.drilldown   — whether the 17 pair families are ingested for the site
--                     (on by default; a free-plan deployment can switch it off).
-- ingest_runs.scope — 'all' (singles + pairs) or 'pairs' (add drill-down data
--                     to a site that was backfilled before this migration).
-- rollups_reverse   — "sources for this page" filters on key2 and groups by
--                     key1; the primary key only serves the forward direction.

ALTER TABLE sites ADD COLUMN drilldown INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ingest_runs ADD COLUMN scope TEXT NOT NULL DEFAULT 'all';
CREATE INDEX rollups_reverse ON rollups (site_id, report, key2, date);
