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

Paste the entire contents of [`google_script_mail_relay.js`](google_script_mail_relay.js)
into the **mail relay project's** `Code.gs`.

> **There are two Apps Script projects and they are not interchangeable.** Both define a
> `doPost`, and each is wired to a different URL:
>
> | File | Project | URL | Handles |
> | --- | --- | --- | --- |
> | `google_script_mail_relay.js` | mail relay | `VITE_GOOGLE_SCRIPT_URL` | admin-triggered email |
> | `google_script_automation.js` | automation | `VITE_GOOGLE_SHEETS_API_URL` | registration intake + reminder cron |
>
> Pasting the relay into the automation project replaces the registration handler, and
> `/register` answers `unauthorized` to every applicant. Keep them apart.

Both files are tracked in git. The relay used to exist only as a snippet in this document
— untracked — which is how it went missing for two days in Aug 2026 without anything
catching it. Edit the file, then deploy; don't hand-edit the live project.

## Step 3: Deploy

1. **Deploy → New deployment → Select type → Web app**.
2. **Execute as**: `Me`.
3. **Who has access**: `Anyone` — required, since the browser calls it unauthenticated.
   The token and allowlist above are what make this safe, not the access setting.
4. **Deploy**, then **Review permissions → Advanced → Go to … (unsafe) → Allow**.

> **Redeploying after an edit.** A `Version N` web app deployment is a frozen snapshot —
> pasting new code into the editor does **not** change what the live URL serves. Use
> **Deploy → Manage deployments → ✏️ → Version: "New version" → Deploy**. The URL stays
> the same, so no `.env` change. Skipping this step is why a redeploy once appeared to
> do nothing for two days straight.

## Step 3b: Authorize both mail services

The relay calls `GmailApp` and falls back to `MailApp`. These need **different** OAuth
scopes over the same daily quota — `https://mail.google.com/` and `script.send_mail`
respectively — and a project can end up holding one but not the other. When that happens
`GmailApp` throws on every send while `MailApp` would have worked fine.

A successful send reports which one carried it:

```json
{"status":"success","sentVia":"MailApp","remainingQuota":91}
```

`sentVia: "MailApp"` means `GmailApp` is refusing and the fallback saved you. That is
survivable, but grant the broader scope when you can — run any function once from the
editor and accept the consent screen.

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
