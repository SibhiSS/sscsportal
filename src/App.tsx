import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Index from '@/pages/Index';
import Register from '@/pages/Register';
import Apply from '@/pages/Apply';
import Team from '@/pages/Team';
import NotFound from '@/pages/NotFound';
import Admin from '@/pages/Admin';
import RecruitmentSchedule from '@/pages/RecruitmentSchedule';
import InterviewerDashboard from '@/pages/InterviewerDashboard';
import StatusPage from '@/pages/Status';
import './App.css';


import ScheduleInterview from '@/pages/ScheduleInterview';
import ResultsNotice from '@/pages/ResultsNotice';

// ── PORTAL KILL SWITCH ───────────────────────────────────────────────────────
// While true, every candidate-facing route collapses to the "results are on
// Instagram" notice at "/". Admin and interviewer routes stay reachable — both
// sit behind auth, so they expose nothing publicly, and locking them would lock
// the committee out of the panel that flips this back.
//
// To reopen the portal: set this to false and redeploy.
const SITE_LOCKED = true;

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartupPreloader from '@/components/ui/StartupPreloader';

import CustomCursor from '@/components/ui/CustomCursor';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

function App() {
  const [showPreloader, setShowPreloader] = useState(true);

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
            <CustomCursor />
            <Analytics />
            <SpeedInsights />
            <Router>
              <Routes>
                {SITE_LOCKED ? (
                  <>
                    <Route path="/" element={<ResultsNotice />} />
                    {/* Auth-gated staff routes stay live — they leak nothing publicly */}
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin/schedule" element={<RecruitmentSchedule />} />
                    <Route path="/interviewer" element={<InterviewerDashboard />} />
                    {/* Everything candidate-facing folds back to the notice */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<Index />} />
                    <Route path="/apply" element={<Apply />} />
                    <Route path="/status" element={<StatusPage />} />
                    <Route path="/schedule" element={<ScheduleInterview />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin/schedule" element={<RecruitmentSchedule />} />
                    <Route path="/interviewer" element={<InterviewerDashboard />} />
                    <Route path="*" element={<NotFound />} />
                  </>
                )}
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
