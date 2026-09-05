import { describe, expect, it } from 'vitest';
import { ENTITIES, ENTITY_BY_KIND, entityHref, entityTitle, isEntityKind, splitSourceMedium } from './entities';
import { REPORT_BY_KEY } from './reports';
import { breakdownSql, entitySeriesSql, entityTotalsSql, siteTotalsSql } from './query-sql';

describe('entity registry', () => {
  it('reads every entity from a single family and every breakdown from a real family with a valid link', () => {
    for (const e of ENTITIES) {
      expect(REPORT_BY_KEY[e.family].pair, `${e.kind} family`).toBe(false);
      expect(e.kpis.length).toBeGreaterThan(0);
      expect(e.kpis).toContain(e.lead);
      for (const b of e.breakdowns) {
        const fam = REPORT_BY_KEY[b.family];
        expect(fam, `${e.kind} → ${b.label}`).toBeTruthy();
        expect(fam.gaDimensions.length, `${e.kind} → ${b.label} needs two keys`).toBe(2);
        if (b.linkTo) expect(isEntityKind(b.linkTo), `${e.kind} → ${b.label} links to ${b.linkTo}`).toBe(true);
        if (b.match === 'source' || b.match === 'medium') expect(fam.gaDimensions[b.side === 'key1' ? 0 : 1]).toBe('sessionSourceMedium');
      }
    }
    expect(new Set(ENTITIES.map((e) => e.kind)).size).toBe(ENTITIES.length);
  });

  it('gives traffic entities the same breakdowns matched three ways', () => {
    const labels = (k: 'source' | 'medium' | 'sourceMedium') => ENTITY_BY_KIND[k].breakdowns.map((b) => b.label);
    expect(labels('sourceMedium')).toEqual(['Landing pages', 'Pages', 'Countries', 'Devices', 'Events', 'Channels']);
    expect(labels('source')).toEqual(['Mediums', ...labels('sourceMedium'), 'Campaigns']);
    expect(labels('medium')).toEqual(['Sources', ...labels('sourceMedium')]);
    expect(ENTITY_BY_KIND.source.breakdowns[1].match).toBe('source');
    expect(ENTITY_BY_KIND.medium.breakdowns[1].match).toBe('medium');
  });

  it('splits source / medium and builds hrefs', () => {
    expect(splitSourceMedium('google / organic')).toEqual(['google', 'organic']);
    expect(splitSourceMedium('(direct)')).toEqual(['(direct)', null]);
    expect(entityHref('page', '/', 'range=7d')).toBe('/detail/page/%2F?range=7d');
    expect(entityHref('sourceMedium', 'google / organic')).toBe('/detail/sourceMedium/google%20%2F%20organic');
    expect(entityTitle('page', '')).toBe('(not set)');
    expect(entityTitle('hour', '07')).toBe('07:00');
    expect(isEntityKind('page')).toBe(true);
    expect(isEntityKind('nope')).toBe(false);
  });
});

describe('drill-down SQL', () => {
  const page = ENTITY_BY_KIND.page;
  it('ranks the other side of a pair in both directions and excludes the (other) fold', () => {
    const sources = breakdownSql('s', page.breakdowns[0], '/pricing', '2026-08-01', '2026-08-28', { metric: 'pageviews', limit: 10 });
    expect(sources.sql).toContain('key1 AS name');
    expect(sources.sql).toContain('key2 = ?');
    expect(sources.sql).toContain('key1 <> ?');
    expect(sources.sql).toContain('GROUP BY key1');
    expect(sources.params).toEqual(['s', 'sm_page', '2026-08-01', '2026-08-28', '/pricing', '(other)', 10]);

    const countries = breakdownSql('s', page.breakdowns[3], '/pricing', '2026-08-01', '2026-08-28', { metric: 'pageviews', limit: 5 });
    expect(countries.sql).toContain('key2 AS name');
    expect(countries.sql).toContain('key1 = ?');
    expect(countries.sql).toContain('GROUP BY key2');
    expect(countries.params[1]).toBe('page_country');
  });

  it('matches sources and mediums inside the stored "source / medium" with escaped LIKE patterns', () => {
    const src = breakdownSql('s', ENTITY_BY_KIND.source.breakdowns[1], 'goo_gle', '2026-08-01', '2026-08-28', { metric: 'sessions', limit: 10 });
    expect(src.sql).toContain("key1 LIKE ? ESCAPE '\\'");
    expect(src.params[4]).toBe('goo\\_gle / %');
    const med = breakdownSql('s', ENTITY_BY_KIND.medium.breakdowns[1], 'organic', '2026-08-01', '2026-08-28', { metric: 'sessions', limit: 10 });
    expect(med.params[4]).toBe('% / organic');
  });

  it('reads source / medium totals from the split single family', () => {
    const t = entityTotalsSql('s', ENTITY_BY_KIND.sourceMedium, 'google / organic', '2026-08-01', '2026-08-28');
    expect(t.sql).toContain('key1 = ? AND key2 = ?');
    expect(t.params).toEqual(['s', 'source', '2026-08-01', '2026-08-28', 'google', 'organic']);
    const bare = entityTotalsSql('s', ENTITY_BY_KIND.sourceMedium, '(direct)', '2026-08-01', '2026-08-28');
    expect(bare.sql.endsWith('key1 = ?')).toBe(true);
    const series = entitySeriesSql('s', ENTITY_BY_KIND.country, 'Australia', '2026-08-01', '2026-08-28', 'week');
    expect(series.sql).toContain('GROUP BY 1 ORDER BY 1');
    expect(series.params[1]).toBe('geo');
    expect(siteTotalsSql('s', '2026-08-01', '2026-08-28').sql).toContain("report = 'totals'");
  });
});
