import { env } from 'cloudflare:workers';

/**
 * Email delivery needs two secrets: a Resend API key and the sender address.
 * Slack webhooks need nothing beyond the URL stored on the report. Server-only.
 */
export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.REPORT_FROM);
}

export function resendKey(): string {
  return env.RESEND_API_KEY ?? '';
}

export function reportFrom(): string {
  return env.REPORT_FROM ?? '';
}
