import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Index from '@/pages/Index';
import Team from '@/pages/Team';
import Leaderboard from '@/pages/Leaderboard';
import NotFound from '@/pages/NotFound';
import Me from '@/pages/Me';
import AdminLayout from '@/admin/AdminLayout';
import Overview from '@/admin/pages/Overview';
import CalendarPage from '@/admin/pages/CalendarPage';
import EventsPage from '@/admin/pages/EventsPage';
import EventDetail from '@/admin/pages/EventDetail';
import VenuesPage from '@/admin/pages/VenuesPage';
import MembersPage from '@/admin/pages/MembersPage';
import MemberCard from '@/admin/pages/MemberCard';
import ApprovalsPage from '@/admin/pages/ApprovalsPage';
import SettingsPage from '@/admin/pages/SettingsPage';
import WebsitePage from '@/admin/pages/WebsitePage';
import TeamPage from '@/admin/pages/TeamPage';
import SuperAdminOnly from '@/admin/SuperAdminOnly';
import './App.css';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartupPreloader from '@/components/ui/StartupPreloader';

import CustomCursor from '@/components/ui/CustomCursor';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/');

/** The custom cursor belongs to the public site; the admin panel uses the normal one. */
function SiteCursor() {
  const { pathname } = useLocation();
  return isAdminPath(pathname) ? null : <CustomCursor />;
}

function App() {
  // The intro animation is for visitors, not for admins opening the panel.
  const [showPreloader, setShowPreloader] = useState(() => !isAdminPath(window.location.pathname));

  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        {showPreloader ? (
          <StartupPreloader key="preloader" onComplete={() => setShowPreloader(false)} />
        ) : (
          <motion.div
            key="main-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Analytics />
            <SpeedInsights />
            <Router>
              <SiteCursor />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/team" element={<Team />} />
                <Route path="/leaderboard" element={<Leaderboard />} />

                <Route path="/me" element={<Me />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Overview />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="events" element={<EventsPage />} />
                  <Route path="events/:id" element={<EventDetail />} />
                  <Route path="venues" element={<SuperAdminOnly><VenuesPage /></SuperAdminOnly>} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="members/:id" element={<MemberCard />} />
                  <Route path="approvals" element={<ApprovalsPage />} />
                  <Route path="website" element={<SuperAdminOnly><WebsitePage /></SuperAdminOnly>} />
                  <Route path="team" element={<SuperAdminOnly><TeamPage /></SuperAdminOnly>} />
                  <Route path="settings" element={<SuperAdminOnly><SettingsPage /></SuperAdminOnly>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
            </Router>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthProvider>
  );
}

export default App;
