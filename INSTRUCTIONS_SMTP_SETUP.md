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

Paste the entire contents of [`google_script_automation.js`](google_script_automation.js) into `Code.gs`
as a single file. It contains both jobs the Apps Script project does — the `automationCheck`
cron (interview reminders) and the `doPost` mail relay (booking links, "Notify Shortlisted",
result emails). Keeping them in one tracked file is deliberate: `doPost` used to live only
as a snippet in this doc, outside source control, and it was lost the last time the cron
logic got trimmed down because nothing caught the deletion. Don't split them back into
separate untracked files in the Apps Script editor.

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
