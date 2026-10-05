import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AFTER_LOGIN_KEY, AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Index from '@/pages/Index';
import Team from '@/pages/Team';
import Leaderboard from '@/pages/Leaderboard';
import MemberCalendar from '@/pages/Calendar';
import Proposals from '@/pages/Proposals';
import NotFound from '@/pages/NotFound';

import Me from '@/pages/Me';
import './App.css';

import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartupPreloader from '@/components/ui/StartupPreloader';

import CustomCursor from '@/components/ui/CustomCursor';
import LogoSpinner from '@/components/ui/LogoSpinner';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// The admin panel loads only when someone opens it, so visitors (most of them on
// phones) don't download it with the public site.
const ProposalsPage = lazy(() => import('@/admin/pages/ProposalsPage'));
const ProposalDetail = lazy(() => import('@/admin/pages/ProposalDetail'));
const DrivePage = lazy(() => import('@/admin/pages/DrivePage'));
const MeetsPage = lazy(() => import('@/admin/pages/MeetsPage'));
const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const Overview = lazy(() => import('@/admin/pages/Overview'));
const CalendarPage = lazy(() => import('@/admin/pages/CalendarPage'));
const EventsPage = lazy(() => import('@/admin/pages/EventsPage'));
const EventDetail = lazy(() => import('@/admin/pages/EventDetail'));
const VenuesPage = lazy(() => import('@/admin/pages/VenuesPage'));
const MembersPage = lazy(() => import('@/admin/pages/MembersPage'));
const MemberCard = lazy(() => import('@/admin/pages/MemberCard'));
const ApprovalsPage = lazy(() => import('@/admin/pages/ApprovalsPage'));
const SettingsPage = lazy(() => import('@/admin/pages/SettingsPage'));
const WebsitePage = lazy(() => import('@/admin/pages/WebsitePage'));
const TeamPage = lazy(() => import('@/admin/pages/TeamPage'));
const SuperAdminOnly = lazy(() => import('@/admin/SuperAdminOnly'));

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/');

/** The custom cursor belongs to the public site; the admin panel uses the normal one. */
function SiteCursor() {
  const { pathname } = useLocation();
  return isAdminPath(pathname) ? null : <CustomCursor />;
}

/** Google sends everyone back to the home page; this takes them on to where they signed in from (e.g. /admin). */
function ReturnAfterLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!user) return;
    let to: string | null = null;
    try { to = sessionStorage.getItem(AFTER_LOGIN_KEY); sessionStorage.removeItem(AFTER_LOGIN_KEY); } catch { /* storage blocked */ }
    // Same-site paths only.
    if (to && to.startsWith('/') && !to.startsWith('//') && to !== pathname) navigate(to, { replace: true });
    // Only when someone signs in, not on every page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  return null;
}

const returningToAdmin = () => {
  try { return isAdminPath(sessionStorage.getItem(AFTER_LOGIN_KEY) ?? ''); } catch { return false; }
};

function App() {
  // The intro animation is for visitors, not for admins opening the panel (or coming back to it from Google).
  const [showPreloader, setShowPreloader] = useState(() => !isAdminPath(window.location.pathname) && !returningToAdmin());

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
              <ReturnAfterLogin />
              <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/team" element={<Team />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/calendar" element={<MemberCalendar />} />
                <Route path="/proposals" element={<Proposals />} />

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
                  <Route path="proposals" element={<ProposalsPage />} />
                  <Route path="proposals/:id" element={<ProposalDetail />} />
                  <Route path="drive" element={<DrivePage />} />
                  <Route path="meets" element={<MeetsPage />} />
                  <Route path="website" element={<SuperAdminOnly><WebsitePage /></SuperAdminOnly>} />
                  <Route path="team" element={<SuperAdminOnly><TeamPage /></SuperAdminOnly>} />
                  <Route path="settings" element={<SuperAdminOnly><SettingsPage /></SuperAdminOnly>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <Toaster />
            </Router>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthProvider>
  );
}

export default App;
