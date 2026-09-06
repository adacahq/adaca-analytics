import { describe, expect, it } from 'vitest';
import { renderEmail, renderSlack, summaryPeriod, summarySubject, type Summary } from './summary-render';

const FIXTURE: Summary = {
  kind: 'weekly',
  siteName: 'www.example.com',
  from: '2026-08-31',
  to: '2026-09-06',
  kpis: [
    { label: 'Visitors', value: '1,234', delta: '+12.0%', tone: 'up' },
    { label: 'Bounce rate', value: '48.0%', delta: '+3.0%', tone: 'down' },
    { label: 'Events', value: '9,000', delta: null, tone: 'flat' },
  ],
  tops: [{ label: 'Top pages', metric: 'Views', rows: [{ key: '/', value: '500' }, { key: '/about <b>', value: '120' }] }],
  url: 'https://analytics.example.com/?from=2026-08-31&to=2026-09-06&compare=prev',
};

describe('report summaries', () => {
  it('covers the last full week (Monday to Sunday) or the last full month', () => {
    expect(summaryPeriod('weekly', '2026-09-07')).toEqual({ from: '2026-08-31', to: '2026-09-06' }); // a Monday
    expect(summaryPeriod('weekly', '2026-09-10')).toEqual({ from: '2026-08-31', to: '2026-09-06' }); // mid-week: still last week
    expect(summaryPeriod('monthly', '2026-09-01')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(summaryPeriod('monthly', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('renders an email that escapes values and carries every number and the link', () => {
    const { html, text } = renderEmail(FIXTURE);
    expect(summarySubject(FIXTURE)).toBe('www.example.com: week of 31 Aug 2026 to 06 Sep 2026');
    expect(html).toContain('1,234');
    expect(html).toContain('+12.0% vs prev');
    expect(html).toContain('/about &lt;b&gt;');
    expect(html).not.toContain('/about <b>');
    expect(html).toContain('href="https://analytics.example.com/?from=2026-08-31&amp;to=2026-09-06&amp;compare=prev"');
    expect(text).toContain('Visitors: 1,234 (+12.0% vs prev)');
    expect(text).toContain('Events: 9,000');
    expect(text).toContain('  /  500');
  });

  it('renders Slack blocks with a header, KPI fields and one section per list', () => {
    const { text, blocks } = renderSlack(FIXTURE);
    expect(text).toContain('Weekly summary for www.example.com');
    expect(blocks[0]).toMatchObject({ type: 'header' });
    expect(blocks[1]).toMatchObject({ type: 'section' });
    expect((blocks[1] as { fields: unknown[] }).fields).toHaveLength(3);
    expect(JSON.stringify(blocks)).toContain('*Top pages*');
    expect(JSON.stringify(blocks.at(-1))).toContain('Open the dashboard');
  });
});
