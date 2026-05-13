# How to send Emails using Google Apps Script (Free SMTP Proxy)

Since we cannot use SMTP directly from React, we will create a tiny "Web App" on Google's servers that receives our data and sends the email using your Gmail account.

## Step 1: Create the Script
1. Go to [script.google.com](https://script.google.com/).
2. Click **"New Project"**.
3. Name it "Nova CPS Mailer".
4. Delete any code in `Code.gs` and paste the following:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const recipient = data.email;
    const subject = data.subject;
    const body = data.message;
    
    // Advanced: You can use HtmlService for pretty emails
    // const htmlBody = data.htmlBody; 

    GmailApp.sendEmail(recipient, subject, body, {
      htmlBody: body, // Use the message as HTML
      name: "NOVA CPS Team"
    });

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Step 2: Deploy as Web App
1. Click the blue **Deploy** button (top right) -> **New deployment**.
2. Click the specific **gear icon** (Select type) next to "Select type" and choose **Web app**.
3. **Description**: "Mailer v1".
4. **Execute as**: `Me` (your gmail).
5. **Who has access**: **Anyone** (This is crucial so your React app can call it).
6. Click **Deploy**.
7. You will be asked to **Authorize Access**.
   - Click "Review permissions".
   - Choose your account.
   - You might see "Google hasn't verified this app" (since you just wrote it). Click **Advanced** -> **Go to Nova CPS Mailer (unsafe)**.
   - Click **Allow**.

## Step 3: Copy the URL
1. Copy the **Web App URL** provided (it looks like `https://script.google.com/macros/s/.../exec`).
2. Go back to your VS Code project.
3. Open `src/pages/Admin.tsx`.
4. Replace the value of `GOOGLE_SCRIPT_URL` with this new URL.
