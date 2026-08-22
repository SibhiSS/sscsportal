// One send function per provider, all behind the same shape, so switching
// providers is a MAIL_PROVIDER secret change, not a redeploy of caller code.
//
// `fetchImpl` is threaded through every adapter instead of calling the global
// `fetch` directly, purely so providers_test.ts can inject a fake and check
// exactly what URL/headers/body each adapter sends — without ever making a
// real network call or needing a real API key.

import { signV4 } from './sigv4.ts';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  fromEmail: string;
  fromName: string;
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function safeErrorText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500); // never let a provider's error body blow up a log line
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ── Resend ───────────────────────────────────────────────────────────────────
// https://resend.com/docs/api-reference/emails/send-email

export async function sendViaResend(
  input: MailInput,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    return { success: false, error: `Resend ${res.status}: ${await safeErrorText(res)}` };
  }

  const body = await res.json().catch(() => ({}));
  return { success: true, providerMessageId: body?.id };
}

// ── Brevo ────────────────────────────────────────────────────────────────────
// https://developers.brevo.com/reference/sendtransacemail

export async function sendViaBrevo(
  input: MailInput,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: input.fromName, email: input.fromEmail },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
    }),
  });

  if (!res.ok) {
    return { success: false, error: `Brevo ${res.status}: ${await safeErrorText(res)}` };
  }

  const body = await res.json().catch(() => ({}));
  return { success: true, providerMessageId: body?.messageId };
}

// ── Amazon SES (v2 HTTP API) ─────────────────────────────────────────────────
// https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
//
// Signed with hand-rolled SigV4 (sigv4.ts) rather than the AWS SDK, so this
// Edge Function has no dependency heavier than `fetch` and stays fast to cold
// start. sigv4.ts is verified against AWS's own published test vectors —
// see sigv4_test.ts — independently of this file.

export interface SesCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export async function sendViaSes(
  input: MailInput,
  creds: SesCredentials,
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  const host = `email.${creds.region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';

  const body = JSON.stringify({
    FromEmailAddress: `${input.fromName} <${input.fromEmail}>`,
    Destination: { ToAddresses: [input.to] },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: input.html, Charset: 'UTF-8' } },
      },
    },
  });

  const signed = await signV4({
    method: 'POST',
    path,
    host,
    region: creds.region,
    service: 'ses',
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    body,
    extraHeaders: { 'content-type': 'application/json' },
  });

  const res = await fetchImpl(`https://${host}${path}`, {
    method: 'POST',
    headers: signed.headers,
    body,
  });

  if (!res.ok) {
    return { success: false, error: `SES ${res.status}: ${await safeErrorText(res)}` };
  }

  const responseBody = await res.json().catch(() => ({}));
  return { success: true, providerMessageId: responseBody?.MessageId };
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

export interface ProviderEnv {
  provider: string | undefined;
  resendApiKey: string | undefined;
  brevoApiKey: string | undefined;
  sesAccessKeyId: string | undefined;
  sesSecretAccessKey: string | undefined;
  sesRegion: string | undefined;
  fromEmail: string | undefined;
  fromName: string;
}

/**
 * Picks and calls the configured provider. Fails loudly and specifically when
 * nothing is configured — matching sendEmail()'s existing behaviour when
 * VITE_GOOGLE_SCRIPT_URL is missing, rather than silently pretending to send.
 */
export async function sendViaConfiguredProvider(
  to: string,
  subject: string,
  html: string,
  env: ProviderEnv,
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  if (!env.fromEmail) {
    return { success: false, error: 'MAIL_FROM_EMAIL is not configured.' };
  }
  const input: MailInput = { to, subject, html, fromEmail: env.fromEmail, fromName: env.fromName };

  switch (env.provider) {
    case 'resend':
      if (!env.resendApiKey) return { success: false, error: 'RESEND_API_KEY is not configured.' };
      return sendViaResend(input, env.resendApiKey, fetchImpl);

    case 'brevo':
      if (!env.brevoApiKey) return { success: false, error: 'BREVO_API_KEY is not configured.' };
      return sendViaBrevo(input, env.brevoApiKey, fetchImpl);

    case 'ses':
      if (!env.sesAccessKeyId || !env.sesSecretAccessKey || !env.sesRegion) {
        return { success: false, error: 'AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION are not fully configured.' };
      }
      return sendViaSes(
        input,
        { accessKeyId: env.sesAccessKeyId, secretAccessKey: env.sesSecretAccessKey, region: env.sesRegion },
        fetchImpl,
      );

    default:
      return {
        success: false,
        error: `MAIL_PROVIDER is not set to a known provider (got "${env.provider ?? ''}"). Expected "resend", "brevo", or "ses".`,
      };
  }
}
