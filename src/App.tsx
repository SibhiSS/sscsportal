import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Index from '@/pages/Index';
import Register from '@/pages/Register';
import Apply from '@/pages/Apply';
import Team from '@/pages/Team';
import NotFound from '@/pages/NotFound';
import Admin from '@/pages/Admin';
import InterviewerDashboard from '@/pages/InterviewerDashboard';
import './App.css';


import ScheduleInterview from '@/pages/ScheduleInterview';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartupPreloader from '@/components/ui/StartupPreloader';

import CustomCursor from '@/components/ui/CustomCursor';

import { Analytics } from '@vercel/analytics/react';

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
            <Router>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/apply" element={<Apply />} />
                <Route path="/schedule" element={<ScheduleInterview />} />
                <Route path="/team" element={<Team />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin" element={<Admin />} />
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
