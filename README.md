# IEEE SSCS Recruitment Portal
Technical documentation for the official recruitment and administrative platform of the IEEE Solid-State Circuits Society, VIT Chennai.

## Project Overview
The IEEE SSCS Portal is a centralized recruitment engine designed to streamline candidate applications, automate interview scheduling, and facilitate administrative oversight. The platform is engineered for high reliability, institutional security, and process automation.

## Core Capabilities
- **Institutional Authentication**: Google OAuth integration restricted to authorized domains.
- **Academic Validation**: Intelligent parsing and validation for 30+ academic branch codes.
- **Administrative Interface**: Real-time management of candidate pipelines and departmental assignments.
- **Automated Scheduling**: Conflict-aware interview booking system for candidates and panels.
- **Notification Engine**: Professional email communication via Google Apps Script integration.
- **Responsive Architecture**: Performance-optimized UI built for both desktop and mobile environments.

## Technical Architecture
- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Framer Motion, shadcn/ui
- **Database & Auth**: Supabase (PostgreSQL)
- **Automation Service**: Google Apps Script
- **Deployment**: Vercel

## Installation and Setup

### Prerequisites
- Node.js (Version 18.0 or higher)
- npm (Version 9.0 or higher)

### Local Environment Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/SibhiSS/sscsportal.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory with the following keys:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment
This project is configured for seamless deployment on Vercel. Ensure all environment variables are correctly mapped in the Vercel project settings prior to build execution.

## Maintenance
For updates to the email templates or notification logic, modifications should be made within the respective component message variables in the `src` directory. Any changes to the script endpoint must be updated in the `VITE_GOOGLE_SCRIPT_URL` environment variable.

## Copyright
Copyright 2026 IEEE SSCS VIT Chennai. All Rights Reserved.
Developed and maintained by the IEEE SSCS Technical Committee.
