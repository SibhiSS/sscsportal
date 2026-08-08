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

function isAllowedRecipient(email) {
  if (!email || email.indexOf('@') === -1) return false;
  var addr = email.trim().toLowerCase();
  if (ALLOWED_ADDRESSES.indexOf(addr) !== -1) return true;
  var domain = addr.split('@').pop();
  return ALLOWED_DOMAINS.indexOf(domain) !== -1;
}

function doPost(e) {
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

    GmailApp.sendEmail(data.email, data.subject, data.message, {
      htmlBody: data.message,
      name: props.getProperty('SENDER_NAME') || 'IEEE SSCS Team'
    });

    return jsonOut({ status: 'success' });

  } catch (error) {
    console.error(error.toString());
    return jsonOut({ status: 'error', message: 'send failed' });
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

## Checklist

- [ ] `MAIL_RELAY_TOKEN` set in Script Properties and matching `VITE_MAIL_RELAY_TOKEN`
- [ ] `ALLOWED_DOMAINS` / `ALLOWED_ADDRESSES` reviewed
- [ ] Old deployments archived
- [ ] Token rotated if it has ever been committed or shared
