# Setting up Email Notifications with EmailJS

To allow the admin dashboard to send acceptance emails from `nova.cpsc@gmail.com`, you need to configure **EmailJS**. This is a free service that lets you send emails directly from the frontend without a backend server.

## Step 1: Create an EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/) and Sign Up for a free account.

## Step 2: Connect your Gmail
1. In the EmailJS Dashboard, go to **Email Services** (on the left).
2. Click **Add New Service**.
3. Select **Gmail**.
4. Click **Connect Account** and sign in with `nova.cpsc@gmail.com`.
5. Make sure the toggle "Send test email to verify" is checked if you want to verify it works.
6. Click **Create Service**.
7. **Copy the Service ID** (e.g., `service_xyz123`) - you will need this later.

## Step 3: Create the Email Template
1. Go to **Email Templates** (on the left).
2. Click **Create New Template**.
3. **Subject Line**: `Congratulations! You're in - NOVA CPS`
4. **Content**: Design your email. You can use variables using `{{variable_name}}`.
   
   Example Content:
   ```html
   Hi {{to_name}},

   Congratulations! We are thrilled to inform you that you have been selected to join the {{department}} team at NOVA CPS.

   We were impressed by your application and believe you will be a great addition to our community.

   Next Steps:
   [Add your onboarding instructions, WhatsApp group links, or meeting details here]

   Welcome aboard!
   
   Best regards,
   NOVA CPS Team
   ```
5. **Auto-Reply**: (Optional) You can leave this blank or default.
6. Click **Save**.
7. **Copy the Template ID** (e.g., `template_abc456`) - you will need this later.

## Step 4: Get your Public Key
1. Go to your **Account Settings** (click your name/avatar in top right -> Account).
2. Look for **Public Key** (it starts with `user_` or just a random string).
3. **Copy the Public Key**.

## Step 5: Update the Code
1. Open the file `src/pages/Admin.tsx` in this project.
2. At the top of the file, find the configuration section:
   ```typescript
   // EMAILJS CONFIGURATION
   const EMAILJS_SERVICE_ID = "service_id"; 
   const EMAILJS_TEMPLATE_ID = "template_id"; 
   const EMAILJS_PUBLIC_KEY = "public_key";
   ```
3. Replace the placeholder strings with the IDs you copied in Steps 2, 3, and 4.

## Checklist
- [ ] Service ID replaced in code
- [ ] Template ID replaced in code
- [ ] Public Key replaced in code
- [ ] Template variables (`{{to_name}}`, `{{to_email}}`, `{{department}}`) match what is used in `Admin.tsx`.

That's it! When you click "Publish Results" in the Admin Dashboard, emails will be sent via `nova.cpsc@gmail.com`.
