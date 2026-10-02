# IEEE SSCS VIT Chennai
Public website and club admin panel for the IEEE Solid-State Circuits Society, VIT Chennai.

## Core Capabilities
- **Institutional Authentication**: Google OAuth via Supabase, restricted to VIT domains (@vitstudent.ac.in, @vit.ac.in).
- **Public Site**: Home and Team pages.
- **Admin Panel** (`/admin`): Club management for admins. Members, events, contributions and calendar are in progress.

## Technical Architecture
- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Framer Motion, shadcn/ui
- **Database & Auth**: Supabase (PostgreSQL)
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
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment
This project is configured for seamless deployment on Vercel. Ensure all environment variables are correctly mapped in the Vercel project settings prior to build execution.

## Copyright
Copyright 2026 IEEE SSCS VIT Chennai. All Rights Reserved.
Developed and maintained by the IEEE SSCS Technical Committee.
