// The real mail sender, replacing google_script_mail_relay.js.
//
// Everything with actual logic — SigV4 signing, the allowlist, dedupe ids,
// request validation — lives in sigv4.ts / providers.ts / allowlist.ts /
// queue_logic.ts and is covered by *_test.ts files runnable with plain
// `deno test`, no deployment or credentials required. This file is
// deliberately thin: parse the request, check who's allowed to make it,
// call those functions, talk to Postgres. That split exists so the bulk of
// the risk here is verifiable without ever touching a live provider account.
//
// ── Deploying ────────────────────────────────────────────────────────────
//   supabase functions deploy send-email
//
// ── Secrets (supabase secrets set NAME=value) ───────────────────────────────
//   SB_SERVICE_ROLE_KEY   Project Settings → API → service_role key. Never the
//                         anon key — this function writes mail_queue directly,
//                         which RLS otherwise reserves for admins to read only.
//   MAIL_PROVIDER         "resend" | "brevo" | "ses" — optional, defaults to "brevo"
//                         (easiest to configure: no domain strictly required,
//                         just a verified sender + an API key). Switching later
//                         is only ever this one secret plus that provider's key.
//   MAIL_FROM_EMAIL       the verified sending address on a domain you control
//   MAIL_FROM_NAME        optional, defaults to "IEEE SSCS Team"
//   RESEND_API_KEY        when MAIL_PROVIDER=resend
//   BREVO_API_KEY         when MAIL_PROVIDER=brevo
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION   when MAIL_PROVIDER=ses
//   MAIL_ALLOWED_DOMAINS   comma-separated, defaults to vitstudent.ac.in,vit.ac.in
//   MAIL_ALLOWED_ADDRESSES comma-separated, defaults to ieee.sscs.vitchennai@gmail.com
//   MAIL_CRON_SECRET       required only if migration_mail_queue_cron.sql is in
//                          use — must match app.settings.mail_cron_secret in Postgres
//
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically by the
// platform; do not set them.
//
// ── Auth model ───────────────────────────────────────────────────────────
// verify_jwt is OFF for this function (see supabase/config.toml) because the
// pg_cron sweep calls it with no user session at all. Every action checks its
// own caller instead:
//   action "send"    — any authenticated Supabase user (a candidate confirming
//                       their own booking is exactly this: real auth, not the
//                       old shared-secret-in-the-JS-bundle model).
//   action "enqueue"  — an authenticated user who is_any_admin(). Bulk sends
//                       are always an admin action.
//   action "process"  — the pg_cron secret, OR an authenticated admin (a
//                       manual "process queue now" button, if ever added).
// ==============================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isAllowedRecipient, parseList } from './allowlist.ts';
import { sendViaConfiguredProvider, type ProviderEnv } from './providers.ts';
import {
  buildDedupeId,
  validateEnqueueItems,
  DEFAULT_DRAIN_LIMIT,
  DRAIN_DELAY_MS,
  type EnqueueItem,
} from './queue_logic.ts';

// The Supabase Edge Runtime provides this global for work that should
// continue after the response is sent. It is absent under plain `deno test`
// / `deno check`, so it is typed as possibly-undefined and guarded at every
// call site — those environments fall back to a plain awaited call, which is
// exactly what the test files exercise.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

function readEnv(): ProviderEnv & {
  allowedDomains: string[];
  allowedAddresses: string[];
  cronSecret: string | undefined;
} {
  return {
    // Defaults to Brevo — no MAIL_PROVIDER secret needs to be set for the
    // common case, just BREVO_API_KEY and MAIL_FROM_EMAIL. Set MAIL_PROVIDER
    // explicitly to switch to "resend" or "ses".
    provider: Deno.env.get('MAIL_PROVIDER') || 'brevo',
    resendApiKey: Deno.env.get('RESEND_API_KEY'),
    brevoApiKey: Deno.env.get('BREVO_API_KEY'),
    sesAccessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID'),
    sesSecretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY'),
    sesRegion: Deno.env.get('AWS_REGION'),
    fromEmail: Deno.env.get('MAIL_FROM_EMAIL'),
    fromName: Deno.env.get('MAIL_FROM_NAME') || 'IEEE SSCS Team',
    // parseList() always returns an array (empty when the env var is unset),
    // never undefined — so `parseList(...) ?? [defaults]` would never apply the
    // defaults and MAIL_ALLOWED_DOMAINS being unset would silently allow
    // nobody at all (see allowlist_test.ts: "an empty configured list allows
    // nothing"). Check the raw env var's presence instead.
    allowedDomains: Deno.env.get('MAIL_ALLOWED_DOMAINS')
      ? parseList(Deno.env.get('MAIL_ALLOWED_DOMAINS'))
      : ['vitstudent.ac.in', 'vit.ac.in'],
    allowedAddresses: Deno.env.get('MAIL_ALLOWED_ADDRESSES')
      ? parseList(Deno.env.get('MAIL_ALLOWED_ADDRESSES'))
      : ['ieee.sscs.vitchennai@gmail.com'],
    cronSecret: Deno.env.get('MAIL_CRON_SECRET'),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SB_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SB_SERVICE_ROLE_KEY are not configured on this function.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** A client scoped to the caller's own JWT — RLS applies exactly as it would to the browser. */
function callerClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY are not available in this environment.');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Resolves the caller's Supabase user from the Authorization header, or throws 401. */
async function requireUser(req: Request): Promise<{ client: SupabaseClient; email: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new HttpError(401, 'Missing Authorization header.');

  const client = callerClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) {
    throw new HttpError(401, 'Not signed in.');
  }
  return { client, email: data.user.email };
}

/** Same as requireUser, but also requires is_any_admin() to be true for that user. */
async function requireAdmin(req: Request): Promise<{ client: SupabaseClient; email: string }> {
  const { client, email } = await requireUser(req);
  const { data: isAdmin, error } = await client.rpc('is_any_admin');
  if (error || isAdmin !== true) {
    throw new HttpError(403, 'Admin access required.');
  }
  return { client, email };
}

interface MailQueueRow {
  id: string;
  to_email: string;
  subject: string;
  html_body: string;
  attempts: number;
  max_attempts: number;
}

/**
 * Sends one already-claimed row and writes its outcome back. The AFTER UPDATE
 * trigger in migration_mail_queue.sql (mail_queue_apply_side_effect_fn) does
 * the corresponding application update the moment status becomes 'sent' — this
 * function never touches `applications` itself, on purpose: one bounded,
 * server-verified trigger is the only path that flips those columns, from
 * either the synchronous "send" action or the background drain below.
 */
async function sendAndRecord(
  svc: SupabaseClient,
  row: MailQueueRow,
  env: ReturnType<typeof readEnv>,
): Promise<boolean> {
  const result = await sendViaConfiguredProvider(row.to_email, row.subject, row.html_body, env);

  if (result.success) {
    await svc
      .from('mail_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId ?? null })
      .eq('id', row.id);
    return true;
  }

  const nextAttempts = row.attempts + 1;
  await svc
    .from('mail_queue')
    .update({
      status: nextAttempts >= row.max_attempts ? 'failed' : 'pending',
      attempts: nextAttempts,
      last_error: result.error ?? 'unknown error',
    })
    .eq('id', row.id);
  return false;
}

async function drainQueue(
  svc: SupabaseClient,
  env: ReturnType<typeof readEnv>,
  limit: number,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const { data: claimed, error } = await svc.rpc('claim_pending_mail', { p_limit: limit });
  if (error) throw new Error(`claim_pending_mail failed: ${error.message}`);

  const rows = (claimed ?? []) as MailQueueRow[];
  for (let i = 0; i < rows.length; i++) {
    const ok = await sendAndRecord(svc, rows[i], env);
    if (ok) sent++;
    else failed++;
    if (i < rows.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DRAIN_DELAY_MS));
    }
  }

  return { sent, failed };
}

/** Keeps draining until a pass returns nothing, guarding against an unbounded loop with a pass cap. */
async function drainUntilEmpty(svc: SupabaseClient, env: ReturnType<typeof readEnv>): Promise<void> {
  const MAX_PASSES = 40; // 40 * 25 = up to 1000 emails per background run before the cron backstop takes over
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { sent, failed } = await drainQueue(svc, env, DEFAULT_DRAIN_LIMIT);
    if (sent + failed === 0) return;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const env = readEnv();
  const action = body.action;

  try {
    if (action === 'send') {
      const { email: callerEmail } = await requireUser(req);

      const to = String(body.to ?? '');
      const subject = String(body.subject ?? '');
      const html = String(body.html ?? '');
      const dedupeId = typeof body.dedupeId === 'string' ? body.dedupeId : undefined;
      const purpose = body.purpose as EnqueueItem['purpose'] | undefined;
      const targetApplicationId = typeof body.targetApplicationId === 'string' ? body.targetApplicationId : undefined;
      const assignedPosition = typeof body.assignedPosition === 'string' ? body.assignedPosition : undefined;

      const [validationError] = validateEnqueueItems([{ to, subject, html, purpose, targetApplicationId, assignedPosition }]);
      if (validationError) return jsonResponse({ error: validationError.reason }, 400);

      if (!isAllowedRecipient(to, env.allowedDomains, env.allowedAddresses)) {
        return jsonResponse({ success: false, error: 'Recipient is not in the allowed list.' }, 403);
      }

      const svc = serviceClient();
      const finalDedupeId = buildDedupeId(purpose, targetApplicationId, dedupeId);

      const { data: inserted, error: insertError } = await svc
        .from('mail_queue')
        .insert({
          dedupe_id: finalDedupeId,
          to_email: to,
          subject,
          html_body: html,
          purpose: purpose ?? null,
          target_application_id: targetApplicationId ?? null,
          assigned_position: assignedPosition ?? null,
          created_by: callerEmail,
        })
        .select()
        .maybeSingle();

      if (insertError) {
        // A UNIQUE violation on dedupe_id means this exact email was already
        // handled (or is being handled) — that is success from the caller's
        // point of view, not a failure to report.
        if (insertError.code === '23505') {
          const { data: existing } = await svc
            .from('mail_queue')
            .select('status')
            .eq('dedupe_id', finalDedupeId)
            .maybeSingle();
          return jsonResponse({ success: existing?.status === 'sent', status: existing?.status ?? 'duplicate' });
        }
        return jsonResponse({ success: false, error: insertError.message }, 500);
      }

      const ok = await sendAndRecord(svc, inserted as MailQueueRow, env);
      return jsonResponse({ success: ok });
    }

    if (action === 'enqueue') {
      const { email: callerEmail } = await requireAdmin(req);

      const items = (body.emails ?? []) as EnqueueItem[];
      if (!Array.isArray(items) || items.length === 0) {
        return jsonResponse({ error: 'emails must be a non-empty array.' }, 400);
      }

      const validationErrors = validateEnqueueItems(items);
      if (validationErrors.length > 0) {
        return jsonResponse({ error: 'Some emails failed validation.', details: validationErrors }, 400);
      }

      const badRecipients = items
        .map((item, index) => ({ index, to: item.to }))
        .filter(({ to }) => !isAllowedRecipient(to, env.allowedDomains, env.allowedAddresses));
      if (badRecipients.length > 0) {
        return jsonResponse({ error: 'Some recipients are not in the allowed list.', details: badRecipients }, 403);
      }

      const batchLabel = typeof body.batchLabel === 'string' ? body.batchLabel : undefined;
      const rows = items.map((item) => ({
        dedupe_id: buildDedupeId(item.purpose, item.targetApplicationId, item.dedupeId),
        to_email: item.to,
        subject: item.subject,
        html_body: item.html,
        purpose: item.purpose ?? null,
        target_application_id: item.targetApplicationId ?? null,
        assigned_position: item.assignedPosition ?? null,
        batch_label: batchLabel ?? null,
        created_by: callerEmail,
      }));

      const svc = serviceClient();
      const { data: upserted, error } = await svc
        .from('mail_queue')
        .upsert(rows, { onConflict: 'dedupe_id', ignoreDuplicates: true })
        .select('id');

      if (error) return jsonResponse({ success: false, error: error.message }, 500);

      const queued = upserted?.length ?? 0;
      const skippedDuplicates = rows.length - queued;

      const drainPromise = drainUntilEmpty(svc, env);
      if (typeof EdgeRuntime !== 'undefined') {
        EdgeRuntime.waitUntil(drainPromise);
      } else {
        // deno test / local dev: no background-execution extension, so this
        // just runs to completion before responding. Production behaviour
        // (immediate response, drain continues after) only differs in when
        // the HTTP response is sent — the drain logic itself is identical
        // and is what queue_logic_test.ts and providers_test.ts exercise.
        await drainPromise;
      }

      return jsonResponse({ queued, skippedDuplicates, batchLabel: batchLabel ?? null });
    }

    if (action === 'process') {
      const cronHeader = req.headers.get('x-mail-cron-secret');
      const isCron = !!env.cronSecret && cronHeader === env.cronSecret;
      if (!isCron) {
        await requireAdmin(req); // throws 401/403 if not a real admin
      }

      const limit = typeof body.limit === 'number' && body.limit > 0
        ? Math.min(body.limit, 100)
        : DEFAULT_DRAIN_LIMIT;

      const svc = serviceClient();
      const result = await drainQueue(svc, env, limit);
      return jsonResponse(result);
    }

    return jsonResponse({ error: `Unknown action "${String(action)}". Expected "send", "enqueue", or "process".` }, 400);
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error('[send-email] unhandled error:', err);
    return jsonResponse({ error: 'Internal error.' }, 500);
  }
});
