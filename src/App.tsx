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
import { RECRUITMENT_CLOSED } from '@/config/recruitment';

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
                <Route path="/" element={<Index />} />
                <Route path="/team" element={<Team />} />

                {/* Recruitment routes — closed off while RECRUITMENT_CLOSED */}
                {RECRUITMENT_CLOSED ? (
                  <>
                    <Route path="/apply" element={<Navigate to="/" replace />} />
                    <Route path="/status" element={<Navigate to="/" replace />} />
                    <Route path="/schedule" element={<Navigate to="/" replace />} />
                    <Route path="/register" element={<Navigate to="/" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/apply" element={<Apply />} />
                    <Route path="/status" element={<StatusPage />} />
                    <Route path="/schedule" element={<ScheduleInterview />} />
                    <Route path="/register" element={<Register />} />
                  </>
                )}

                {/* Staff routes — auth-gated, unaffected by the recruitment switch */}
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/schedule" element={<RecruitmentSchedule />} />
                <Route path="/interviewer" element={<InterviewerDashboard />} />
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
