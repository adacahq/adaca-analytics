/**
 * BigQuery SQL for the daily rollups, one query per report family over the
 * GA4 export's `events_*` tables. Pure string building — unit-tested for
 * shape, integration-tested against the public GA4 sample dataset.
 *
 * Numbers differ slightly from the GA UI (which applies thresholding and
 * modelling); the README says so. Derivations:
 *  - sessions        = distinct (user_pseudo_id, ga_session_id)
 *  - engaged session = any event in the session carried session_engaged=1
 *  - users           = distinct user_pseudo_id
 *  - new users       = users who fired first_visit
 *  - engagement time = Σ engagement_time_msec / 1000
 *  - key events      = events whose name is in the site's key-event list
 *  - source/medium   = first non-null `source`/`medium` event param in the
 *                      session, else the user's first-touch traffic_source
 */
import type { ReportKey } from './reports';

export interface BqSite {
  /** Fully qualified `project.dataset` of the export. */
  datasetRef: string;
  timezone: string;
  keyEvents: string[];
}

const BQ_IDENT = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?$/;

function assertRef(ref: string): string {
  if (!BQ_IDENT.test(ref)) throw new Error(`Unsafe BigQuery dataset reference: ${ref}`);
  return ref;
}

function assertDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Bad date: ${d}`);
  return d.replace(/-/g, '');
}

function strList(values: string[]): string {
  const safe = values.filter((v) => /^[A-Za-z0-9_\- .:]+$/.test(v)).map((v) => `'${v}'`);
  return safe.length ? safe.join(', ') : "'__no_key_events__'";
}

/** Resolve a site's dataset to `project.dataset`. */
export function datasetRef(site: { bq_project_id: string | null; bq_dataset: string | null }): string {
  const ds = site.bq_dataset ?? '';
  if (ds.includes('.')) return ds;
  if (!site.bq_project_id) throw new Error('BigQuery site needs a jobs project');
  return `${site.bq_project_id}.${ds}`;
}

const METRICS_FROM_SESS = `
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNT(DISTINCT IF(is_new, user_pseudo_id, NULL)) AS new_users,
  COUNT(*) AS sessions,
  COUNTIF(engaged = 1) AS engaged_sessions,
  SUM(pageviews) AS pageviews,
  SUM(eng_ms) / 1000 AS engagement_seconds,
  SUM(key_events) AS key_events,
  SUM(events) AS event_count`;

function metricsFromEv(keyEvents: string[]): string {
  return `
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNT(DISTINCT IF(event_name = 'first_visit', user_pseudo_id, NULL)) AS new_users,
  COUNT(DISTINCT IF(sid IS NULL, NULL, CONCAT(user_pseudo_id, '.', CAST(sid AS STRING)))) AS sessions,
  COUNT(DISTINCT IF(sid IS NULL OR engaged IS NULL OR engaged <> 1, NULL, CONCAT(user_pseudo_id, '.', CAST(sid AS STRING)))) AS engaged_sessions,
  COUNTIF(event_name = 'page_view') AS pageviews,
  SUM(COALESCE(eng_ms, 0)) / 1000 AS engagement_seconds,
  COUNTIF(event_name IN (${strList(keyEvents)})) AS key_events,
  COUNT(*) AS event_count`;
}

const CHANNEL_CASE = `CASE
      WHEN src IS NULL OR src IN ('', '(direct)', '(not set)') THEN 'Direct'
      WHEN REGEXP_CONTAINS(LOWER(med), r'^(cpc|ppc|paidsearch|paid-search|paid_search)$') THEN 'Paid Search'
      WHEN LOWER(med) = 'organic' THEN 'Organic Search'
      WHEN REGEXP_CONTAINS(LOWER(med), r'^(social|social-network|social-media|sm|social network|social media)$')
        OR REGEXP_CONTAINS(LOWER(src), r'facebook|instagram|linkedin|twitter|t\\.co|pinterest|reddit|tiktok|youtube') THEN 'Organic Social'
      WHEN LOWER(med) = 'email' OR LOWER(src) LIKE '%email%' THEN 'Email'
      WHEN LOWER(med) = 'affiliate' THEN 'Affiliates'
      WHEN LOWER(med) = 'referral' THEN 'Referral'
      WHEN REGEXP_CONTAINS(LOWER(med), r'display|cpm|banner') THEN 'Display'
      WHEN LOWER(med) IN ('cpv', 'cpa', 'cpp', 'content-text') THEN 'Other Advertising'
      ELSE 'Unassigned'
    END`;

/** The shared CTEs: flattened events and one row per session. */
function base(site: BqSite, from: string, to: string): string {
  const ref = assertRef(site.datasetRef);
  const f = assertDate(from);
  const t = assertDate(to);
  return `WITH ev AS (
  SELECT
    event_date, event_name, event_timestamp, user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS sid,
    (SELECT COALESCE(value.int_value, SAFE_CAST(value.string_value AS INT64)) FROM UNNEST(event_params) WHERE key = 'session_engaged') AS engaged,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') AS eng_ms,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') AS page_title,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer') AS page_referrer,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source') AS p_source,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium') AS p_medium,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign') AS p_campaign,
    traffic_source.source AS u_source, traffic_source.medium AS u_medium, traffic_source.name AS u_campaign,
    device.category AS device_category, device.operating_system AS os, device.web_info.browser AS browser, device.language AS language,
    geo.country AS country, geo.city AS city
  FROM \`${ref}.events_*\`
  WHERE (_TABLE_SUFFIX BETWEEN '${f}' AND '${t}' OR _TABLE_SUFFIX BETWEEN 'intraday_${f}' AND 'intraday_${t}')
),
sess AS (
  SELECT
    user_pseudo_id, sid,
    MIN(event_date) AS event_date,
    COALESCE(ARRAY_AGG(p_source IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)], ANY_VALUE(u_source), '(direct)') AS src,
    COALESCE(ARRAY_AGG(p_medium IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)], ANY_VALUE(u_medium), '(none)') AS med,
    COALESCE(ARRAY_AGG(p_campaign IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)], ANY_VALUE(u_campaign), '(not set)') AS camp,
    COALESCE(REGEXP_EXTRACT(ARRAY_AGG(IF(event_name = 'page_view', page_location, NULL) IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)], r'^https?://[^/]+(/[^?#]*)'), '/') AS landing,
    ANY_VALUE(device_category) AS device_category, ANY_VALUE(os) AS os, ANY_VALUE(browser) AS browser, ANY_VALUE(language) AS language,
    ANY_VALUE(country) AS country, ANY_VALUE(city) AS city,
    MAX(engaged) AS engaged,
    SUM(COALESCE(eng_ms, 0)) AS eng_ms,
    COUNTIF(event_name = 'page_view') AS pageviews,
    COUNTIF(event_name IN (${strList(site.keyEvents)})) AS key_events,
    COUNT(*) AS events,
    LOGICAL_OR(event_name = 'first_visit') AS is_new
  FROM ev
  WHERE sid IS NOT NULL
  GROUP BY user_pseudo_id, sid
),
evs AS (
  SELECT ev.*, s.src, s.med, s.camp, s.landing
  FROM ev JOIN sess s USING (user_pseudo_id, sid)
)`;
}

const PAGE_PATH = "COALESCE(REGEXP_EXTRACT(page_location, r'^https?://[^/]+(/[^?#]*)'), '/')";
const REFERRER_HOST = "COALESCE(LOWER(REGEXP_EXTRACT(page_referrer, r'^https?://(?:www\\.)?([^/:?#]+)')), '(direct)')";
const SOURCE_MEDIUM = "CONCAT(src, ' / ', med)";
const COUNTRY = "COALESCE(country, '(not set)')";
const DEVICE = "COALESCE(device_category, '(not set)')";

function sessFamily(k1: string, k2: string): string {
  return `SELECT event_date AS date, ${k1} AS key1, ${k2} AS key2,${METRICS_FROM_SESS}
FROM sess
GROUP BY 1, 2, 3`;
}

/** Event-level family; `from` is `evs` when a key needs the session's source/medium/campaign/landing. */
function evFamily(k1: string, k2: string, keyEvents: string[], where = '', from: 'ev' | 'evs' = 'ev'): string {
  return `SELECT event_date AS date, ${k1} AS key1, ${k2} AS key2,${metricsFromEv(keyEvents)}
FROM ${from}${where ? `\nWHERE ${where}` : ''}
GROUP BY 1, 2, 3`;
}

/** The full query for one family and date window, or null when BigQuery cannot derive the family. */
export function bqSql(site: BqSite, family: ReportKey, from: string, to: string): string | null {
  const tz = site.timezone.replace(/[^A-Za-z0-9_/+-]/g, '');
  const head = base(site, from, to);
  let body: string;
  switch (family) {
    case 'totals':
      body = sessFamily("''", "''");
      break;
    case 'landing':
      body = sessFamily('landing', "''");
      break;
    case 'source':
      body = sessFamily('src', 'med');
      break;
    case 'channel':
      body = sessFamily(CHANNEL_CASE, "''");
      break;
    case 'campaign':
      body = sessFamily('camp', 'src');
      break;
    case 'geo':
      body = sessFamily("COALESCE(country, '(not set)')", "COALESCE(city, '(not set)')");
      break;
    case 'device':
      body = sessFamily("COALESCE(device_category, '(not set)')", "COALESCE(os, '(not set)')");
      break;
    case 'browser':
      body = sessFamily("COALESCE(browser, '(not set)')", "''");
      break;
    case 'language':
      body = sessFamily("COALESCE(language, '(not set)')", "''");
      break;
    case 'user_type':
      body = sessFamily("IF(is_new, 'new', 'returning')", "''");
      break;
    case 'page':
      body = evFamily(PAGE_PATH, "COALESCE(page_title, '')", site.keyEvents, 'page_location IS NOT NULL');
      break;
    case 'referrer':
      body = evFamily(REFERRER_HOST, "''", site.keyEvents, "event_name = 'page_view'");
      break;
    case 'event':
      body = evFamily('event_name', `IF(event_name IN (${strList(site.keyEvents)}), '1', '0')`, site.keyEvents);
      break;
    case 'hour':
      body = evFamily(`FORMAT('%02d', EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp) AT TIME ZONE '${tz}'))`, "''", site.keyEvents);
      break;
    // Pair families (drill-down). Session-level pairs read `sess`; event-level
    // pairs whose key needs session attribution read `evs` (events joined to their session).
    case 'sm_landing':
      body = sessFamily(SOURCE_MEDIUM, 'landing');
      break;
    case 'sm_country':
      body = sessFamily(SOURCE_MEDIUM, COUNTRY);
      break;
    case 'sm_device':
      body = sessFamily(SOURCE_MEDIUM, DEVICE);
      break;
    case 'channel_sm':
      body = sessFamily(CHANNEL_CASE, SOURCE_MEDIUM);
      break;
    case 'channel_landing':
      body = sessFamily(CHANNEL_CASE, 'landing');
      break;
    case 'channel_country':
      body = sessFamily(CHANNEL_CASE, COUNTRY);
      break;
    case 'campaign_landing':
      body = sessFamily('camp', 'landing');
      break;
    case 'landing_country':
      body = sessFamily('landing', COUNTRY);
      break;
    case 'landing_device':
      body = sessFamily('landing', DEVICE);
      break;
    case 'country_device':
      body = sessFamily(COUNTRY, DEVICE);
      break;
    case 'sm_page':
      body = evFamily(SOURCE_MEDIUM, PAGE_PATH, site.keyEvents, 'page_location IS NOT NULL', 'evs');
      break;
    case 'sm_event':
      body = evFamily(SOURCE_MEDIUM, 'event_name', site.keyEvents, '', 'evs');
      break;
    case 'channel_page':
      body = evFamily(CHANNEL_CASE, PAGE_PATH, site.keyEvents, 'page_location IS NOT NULL', 'evs');
      break;
    case 'referrer_page':
      body = evFamily(REFERRER_HOST, PAGE_PATH, site.keyEvents, "event_name = 'page_view'");
      break;
    case 'page_country':
      body = evFamily(PAGE_PATH, COUNTRY, site.keyEvents, 'page_location IS NOT NULL');
      break;
    case 'page_device':
      body = evFamily(PAGE_PATH, DEVICE, site.keyEvents, 'page_location IS NOT NULL');
      break;
    case 'page_event':
      body = evFamily(PAGE_PATH, 'event_name', site.keyEvents, 'page_location IS NOT NULL');
      break;
    case 'screen':
      return null;
    default:
      return null;
  }
  return `${head}\n${body}`;
}

/** Which day tables exist, so a BigQuery-only site can default its backfill window. */
export function bqTablesSql(ref: string): string {
  return `SELECT MIN(table_name) AS first_table, MAX(table_name) AS last_table, COUNT(*) AS n
FROM \`${assertRef(ref)}\`.INFORMATION_SCHEMA.TABLES
WHERE REGEXP_CONTAINS(table_name, r'^events_\\d{8}$')`;
}
