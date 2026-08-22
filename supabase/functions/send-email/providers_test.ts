function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + `assertEquals failed:\n  actual:   ${actual}\n  expected: ${expected}`);
  }
}
function assertTrue(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

import { sendViaBrevo, sendViaResend, sendViaSes, sendViaConfiguredProvider, type FetchLike } from './providers.ts';

const INPUT = {
  to: 'candidate@vitstudent.ac.in',
  subject: 'Test Subject',
  html: '<p>hi</p>',
  fromEmail: 'no-reply@example.org',
  fromName: 'IEEE SSCS Team',
};

function fakeFetch(status: number, body: unknown, capture: { url?: string; init?: RequestInit }): FetchLike {
  return async (url: string, init?: RequestInit) => {
    capture.url = url;
    capture.init = init;
    return new Response(JSON.stringify(body), { status });
  };
}

// ── Resend ───────────────────────────────────────────────────────────────────

Deno.test('sendViaResend posts the right URL, auth header, and body shape', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaResend(INPUT, 'test-key', fakeFetch(200, { id: 'msg_123' }, capture));

  assertEquals(result.success, true);
  assertEquals(result.providerMessageId, 'msg_123');
  assertEquals(capture.url, 'https://api.resend.com/emails');

  const headers = capture.init?.headers as Record<string, string>;
  assertEquals(headers.Authorization, 'Bearer test-key');

  const body = JSON.parse(capture.init?.body as string);
  assertEquals(body.from, 'IEEE SSCS Team <no-reply@example.org>');
  assertEquals(body.to[0], 'candidate@vitstudent.ac.in');
  assertEquals(body.subject, 'Test Subject');
  assertEquals(body.html, '<p>hi</p>');
});

Deno.test('sendViaResend surfaces a non-2xx as a failure with the provider name in the message', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaResend(INPUT, 'bad-key', fakeFetch(401, { message: 'invalid key' }, capture));

  assertEquals(result.success, false);
  assertTrue(result.error?.includes('Resend'), 'error should name the provider: ' + result.error);
  assertTrue(result.error?.includes('401'), 'error should include the status: ' + result.error);
});

// ── Brevo ────────────────────────────────────────────────────────────────────

Deno.test('sendViaBrevo posts the right URL, api-key header, and body shape', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaBrevo(INPUT, 'test-key', fakeFetch(201, { messageId: 'brevo-1' }, capture));

  assertEquals(result.success, true);
  assertEquals(result.providerMessageId, 'brevo-1');
  assertEquals(capture.url, 'https://api.brevo.com/v3/smtp/email');

  const headers = capture.init?.headers as Record<string, string>;
  assertEquals(headers['api-key'], 'test-key');

  const body = JSON.parse(capture.init?.body as string);
  assertEquals(body.sender.email, 'no-reply@example.org');
  assertEquals(body.to[0].email, 'candidate@vitstudent.ac.in');
  assertEquals(body.htmlContent, '<p>hi</p>');
});

Deno.test('sendViaBrevo surfaces a non-2xx as a failure', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaBrevo(INPUT, 'bad-key', fakeFetch(400, { message: 'bad request' }, capture));
  assertEquals(result.success, false);
  assertTrue(result.error?.includes('Brevo'), 'error should name the provider: ' + result.error);
});

// ── SES ──────────────────────────────────────────────────────────────────────

Deno.test('sendViaSes posts to the region-scoped endpoint with a signed Authorization header', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaSes(
    INPUT,
    { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret', region: 'ap-south-1' },
    fakeFetch(200, { MessageId: 'ses-1' }, capture),
  );

  assertEquals(result.success, true);
  assertEquals(result.providerMessageId, 'ses-1');
  assertEquals(capture.url, 'https://email.ap-south-1.amazonaws.com/v2/email/outbound-emails');

  const headers = capture.init?.headers as Record<string, string>;
  assertTrue(headers.Authorization?.startsWith('AWS4-HMAC-SHA256'), 'must carry a SigV4 Authorization header');
  assertTrue(headers.Authorization.includes('ap-south-1/ses/aws4_request'), 'signature scope must name the right region and service');

  const body = JSON.parse(capture.init?.body as string);
  assertEquals(body.FromEmailAddress, 'IEEE SSCS Team <no-reply@example.org>');
  assertEquals(body.Destination.ToAddresses[0], 'candidate@vitstudent.ac.in');
  assertEquals(body.Content.Simple.Body.Html.Data, '<p>hi</p>');
});

Deno.test('sendViaSes surfaces a non-2xx as a failure', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaSes(
    INPUT,
    { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret', region: 'us-east-1' },
    fakeFetch(403, { message: 'not authorized' }, capture),
  );
  assertEquals(result.success, false);
  assertTrue(result.error?.includes('SES'), 'error should name the provider: ' + result.error);
});

// ── Dispatch ─────────────────────────────────────────────────────────────────

Deno.test('sendViaConfiguredProvider fails loudly with no provider configured, never fakes success', async () => {
  const result = await sendViaConfiguredProvider('a@vitstudent.ac.in', 's', 'h', {
    provider: undefined,
    resendApiKey: undefined,
    brevoApiKey: undefined,
    sesAccessKeyId: undefined,
    sesSecretAccessKey: undefined,
    sesRegion: undefined,
    fromEmail: 'no-reply@example.org',
    fromName: 'Team',
  });
  assertEquals(result.success, false);
  assertTrue(result.error?.includes('MAIL_PROVIDER'), 'error should name the missing setting: ' + result.error);
});

Deno.test('sendViaConfiguredProvider fails loudly when the chosen provider is missing its key', async () => {
  const result = await sendViaConfiguredProvider('a@vitstudent.ac.in', 's', 'h', {
    provider: 'resend',
    resendApiKey: undefined,
    brevoApiKey: undefined,
    sesAccessKeyId: undefined,
    sesSecretAccessKey: undefined,
    sesRegion: undefined,
    fromEmail: 'no-reply@example.org',
    fromName: 'Team',
  });
  assertEquals(result.success, false);
  assertTrue(result.error?.includes('RESEND_API_KEY'), 'error should name the missing key: ' + result.error);
});

Deno.test('sendViaConfiguredProvider fails loudly when MAIL_FROM_EMAIL is missing, regardless of provider', async () => {
  const result = await sendViaConfiguredProvider('a@vitstudent.ac.in', 's', 'h', {
    provider: 'brevo',
    resendApiKey: undefined,
    brevoApiKey: 'key',
    sesAccessKeyId: undefined,
    sesSecretAccessKey: undefined,
    sesRegion: undefined,
    fromEmail: undefined,
    fromName: 'Team',
  });
  assertEquals(result.success, false);
  assertTrue(result.error?.includes('MAIL_FROM_EMAIL'), 'error should name the missing setting: ' + result.error);
});

Deno.test('sendViaConfiguredProvider routes to the right adapter by MAIL_PROVIDER', async () => {
  const capture: { url?: string; init?: RequestInit } = {};
  const result = await sendViaConfiguredProvider('a@vitstudent.ac.in', 's', 'h', {
    provider: 'brevo',
    resendApiKey: undefined,
    brevoApiKey: 'key',
    sesAccessKeyId: undefined,
    sesSecretAccessKey: undefined,
    sesRegion: undefined,
    fromEmail: 'no-reply@example.org',
    fromName: 'Team',
  }, fakeFetch(201, { messageId: 'x' }, capture));

  assertEquals(result.success, true);
  assertEquals(capture.url, 'https://api.brevo.com/v3/smtp/email');
});
