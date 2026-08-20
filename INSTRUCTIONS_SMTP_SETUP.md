# Email Relay Setup (Google Apps Script)

React cannot speak SMTP directly, so we deploy a tiny Web App on Google's servers that
receives a payload and sends the mail from the club Gmail account.

> **Security note.** An Apps Script Web App deployed with "Who has access: Anyone" is a
> publicly reachable HTTP endpoint, and its URL ships inside our compiled JS bundle —
> anyone can read it out of devtools. Without the checks below it is an **open mail
> relay**: arbitrary attackers can send arbitrary HTML from our address, which both
> enables convincing phishing and burns the daily Gmail send quota (~100/day on a
> consumer account, 1500 on Workspace). When that quota is gone, real interview
> reminders and result emails stop going out — and because the client uses
> `mode: 'no-cors'`, it cannot even see the failure.

## Step 1: Script Properties

In the Apps Script project: **Project Settings (⚙️) → Script Properties → Add property**.

| Property | Value |
| --- | --- |
| `MAIL_RELAY_TOKEN` | a long random string you generate |
| `SENDER_NAME` | `IEEE SSCS Team` |

Put the same token in the app's `.env` as `VITE_MAIL_RELAY_TOKEN`, and add it to your
Netlify environment variables. It must match exactly.

## Step 2: The script

Paste this into `Code.gs`:

```javascript
/**
 * Allowed recipient domains and addresses.
 *
 * This is the control that survives token leakage. VITE_MAIL_RELAY_TOKEN is compiled
 * into the public bundle, so a determined attacker can extract it — but even holding
 * the token they can only send to VIT addresses and our own inboxes, never to an
 * arbitrary victim. Keep this list as narrow as the product allows.
 */
var ALLOWED_DOMAINS = ['vitstudent.ac.in', 'vit.ac.in'];
var ALLOWED_ADDRESSES = ['ieee.sscs.vitchennai@gmail.com'];

/**
 * How long a dedupeId is remembered, in seconds (max 21600 for CacheService).
 *
 * The client sends one dedupeId per logical email. If the same id arrives again inside
 * this window we acknowledge it without sending, so a re-POST cannot become a second
 * copy in the candidate's inbox. This matters because the relay sends the mail and
 * *then* answers with a redirect: any client-side failure is reported after delivery,
 * so a retry on the client is always a duplicate, never a recovery.
 */
var DEDUPE_WINDOW_SECONDS = 900;

function isAllowedRecipient(email) {
  if (!email || email.indexOf('@') === -1) return false;
  var addr = email.trim().toLowerCase();
  if (ALLOWED_ADDRESSES.indexOf(addr) !== -1) return true;
  var domain = addr.split('@').pop();
  return ALLOWED_DOMAINS.indexOf(domain) !== -1;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var props = PropertiesService.getScriptProperties();
    var expectedToken = props.getProperty('MAIL_RELAY_TOKEN');
    var data = JSON.parse(e.postData.contents);

    // 1. Reject anything without the shared secret.
    if (!expectedToken || data.token !== expectedToken) {
      console.warn('Rejected relay request: bad or missing token.');
      return jsonOut({ status: 'error', message: 'unauthorized' });
    }

    // 2. Reject recipients outside the allowlist.
    if (!isAllowedRecipient(data.email)) {
      console.warn('Rejected relay request: recipient not allowed.');
      return jsonOut({ status: 'error', message: 'recipient not allowed' });
    }

    // 3. Cheap circuit breaker so a leaked token cannot drain the daily quota in
    //    one burst. MailApp.getRemainingDailyQuota() is the real backstop.
    if (MailApp.getRemainingDailyQuota() < 20) {
      console.warn('Rejected relay request: daily quota nearly exhausted.');
      return jsonOut({ status: 'error', message: 'quota exhausted' });
    }

    // 4. Idempotency. The lock serialises concurrent duplicates; the cache entry is
    //    written *before* sending so a crash mid-send cannot be replayed by a client
    //    retry, and is cleared again only if the send itself threw.
    var cache = CacheService.getScriptCache();
    var dedupeKey = data.dedupeId ? 'mail:' + data.dedupeId : null;

    if (dedupeKey) {
      lock.waitLock(10000);
      if (cache.get(dedupeKey)) {
        console.log('Ignored duplicate send for dedupeId ' + data.dedupeId);
        return jsonOut({ status: 'duplicate', message: 'already sent' });
      }
      cache.put(dedupeKey, '1', DEDUPE_WINDOW_SECONDS);
      lock.releaseLock();
    }

    try {
      GmailApp.sendEmail(data.email, data.subject, data.message, {
        htmlBody: data.message,
        name: props.getProperty('SENDER_NAME') || 'IEEE SSCS Team'
      });
    } catch (sendError) {
      // Nothing was delivered, so let the id be used again.
      if (dedupeKey) cache.remove(dedupeKey);
      throw sendError;
    }

    return jsonOut({ status: 'success' });

  } catch (error) {
    console.error(error.toString());
    return jsonOut({ status: 'error', message: 'send failed' });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Step 3: Deploy

1. **Deploy → New deployment → Select type → Web app**.
2. **Execute as**: `Me`.
3. **Who has access**: `Anyone` — required, since the browser calls it unauthenticated.
   The token and allowlist above are what make this safe, not the access setting.
4. **Deploy**, then **Review permissions → Advanced → Go to … (unsafe) → Allow**.

## Step 4: Wire it up

Copy the Web App URL (`https://script.google.com/macros/s/.../exec`) into `.env` as
`VITE_GOOGLE_SCRIPT_URL`, and add it to your Netlify environment variables.

> Deploying a **new version** issues a new URL. The old one keeps working until you
> archive that deployment — archive old deployments once you have cut over, otherwise
> a previously leaked URL stays live indefinitely.

## Step 5: Keep the CSP in sync

A POST to `/exec` is answered with a `302` to **`script.googleusercontent.com`**, so
*both* hosts must appear in `connect-src` in `netlify.toml` and `vercel.json`:

```
connect-src 'self' … https://script.google.com https://script.googleusercontent.com …
```

Drop the second host and the browser blocks the redirect, `fetch` rejects on every
send, and the app cannot tell a delivered mail from a lost one — the failure mode that
previously mailed every applicant twice.

## Checklist

- [ ] `MAIL_RELAY_TOKEN` set in Script Properties and matching `VITE_MAIL_RELAY_TOKEN`
- [ ] `ALLOWED_DOMAINS` / `ALLOWED_ADDRESSES` reviewed
- [ ] Both `script.google.com` and `script.googleusercontent.com` in `connect-src`
- [ ] Old deployments archived
- [ ] Token rotated if it has ever been committed or shared
