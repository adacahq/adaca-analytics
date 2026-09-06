import { emailConfigured, reportFrom, resendKey } from './env';

/**
 * Delivery: email through Resend's HTTP API (the one provider; a Worker
 * cannot speak SMTP), and Slack through an incoming webhook. Both throw with
 * a readable message, which the scheduler stores on the report.
 */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!emailConfigured()) throw new Error('Email is not set up: set the RESEND_API_KEY and REPORT_FROM secrets');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: reportFrom(), to: [to], subject, html, text }),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      msg = body.message ?? body.error ?? msg;
    } catch {
      // keep the status text
    }
    throw new Error(`Resend: ${msg}`);
  }
}

export function isSlackWebhook(url: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+$/.test(url.trim());
}

export async function sendSlack(webhook: string, text: string, blocks?: unknown[]): Promise<void> {
  if (!isSlackWebhook(webhook)) throw new Error('Not a Slack incoming-webhook URL');
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(blocks ? { text, blocks } : { text }),
  });
  if (!res.ok) throw new Error(`Slack: ${res.status} ${(await res.text()).slice(0, 200)}`);
}
