# IEEE SSCS Recruitment Portal 🚀
> **The Official Recruitment & Management Platform for IEEE Solid-State Circuits Society, VIT Chennai.**

![IEEE SSCS Banner](https://sscsportal.vercel.app/ieee-sscs-logo.png)

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.io/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 🌐 Overview
The **IEEE SSCS Portal** is a high-performance recruitment engine designed to manage student applications, automate interview scheduling, and facilitate departmental management. Built with a premium "Silicon Trace" aesthetic, it combines cutting-edge web technologies with robust backend automation.

## ✨ Key Features
- **Authentication**: Secure Google OAuth integration restricted to institutional domains.
- **Dynamic Application**: Intelligent form validation for 30+ academic branches.
- **Admin Dashboard**: Real-time candidate management, status tracking, and department filtering.
- **Interview Scheduler**: Automated booking system with priority conflict detection.
- **Email System**: Professional corporate-themed notifications powered by Google Apps Script.
- **Silicon Trace UI**: Custom-built premium components with high-fidelity animations.

## 🛠️ Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript |
| **Styling** | Tailwind CSS, Framer Motion, shadcn/ui |
| **Backend** | Supabase (PostgreSQL, Realtime, Auth) |
| **Automation** | Google Apps Script (Emailing Service) |
| **Deployment** | Vercel |

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: Version 18.0 or higher.
- **npm**: Version 9.0 or higher.

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/SibhiSS/sscsportal.git

# Navigate to project
cd sscsportal

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and populate it with the following:

```env
# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Automation
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

### 4. Running Locally
```bash
# Start development server
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## 📦 Deployment
The portal is optimized for deployment on **Vercel**. 

1. Connect your GitHub repository to Vercel.
2. Add all environment variables listed above in the Vercel Dashboard.
3. Vercel will automatically detect the Vite configuration and deploy.

## 📄 License
© 2026 IEEE SSCS VIT Chennai. All Rights Reserved.
Built with ❤️ by the IEEE SSCS Technical Team.
