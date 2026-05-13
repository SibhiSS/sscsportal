# IEEE SSCS - Solid-State Circuits Society

> **Where Code Meets the Future**

## About

IEEE SSCS is the official website for the Solid-State Circuits Society. We advance CPS learning through hands-on development, innovation events, seminars, and hackathons.

**Slogan:** Prototype • Connect • Perform

## Tech Stack

This project is built with:

- **React 18** - UI Framework
- **Vite** - Build Tool
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI Components
- **Framer Motion** - Animations
- **React Router** - Routing

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd ieee-sscs-website

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/
│   ├── sections/       # Landing page sections
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts (Auth)
├── hooks/              # Custom hooks
├── pages/              # Route pages
├── services/           # API services
└── lib/                # Utilities
```

## Features

- ✅ Modern, responsive design
- ✅ Dark mode by default
- ✅ Google OAuth (VIT students only)
- ✅ Member registration form
- ✅ Animated sections
- ✅ Email confirmations via EmailJS

## Environment Variables

Create a `.env` file with:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_SHEETS_API_URL=your_google_sheets_api_url
```

## License

© 2026 IEEE SSCS - Solid-State Circuits Society
