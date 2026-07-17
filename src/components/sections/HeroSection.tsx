import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TechGridBackground from '@/components/ui/TechGridBackground';
import GlitchText from '@/components/ui/GlitchText';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const HeroSection = () => {
  const { user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);
  const [canBookSlot, setCanBookSlot] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isRecruitmentOpen, setIsRecruitmentOpen] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      // 1. Fetch recruitment status (HARDCODED CLOSED)
      setIsRecruitmentOpen(false);

      // 2. Fetch user application status
      if (!user) return;
      const { data } = await supabase
        .from('applications')
        .select('id, status')
        .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
        .limit(1);

      if (data && data.length > 0) {
        setHasApplied(true);
        const st = data[0].status;
        if (st === 'shortlisted') {
          setCanBookSlot(true);
        } else if (['selected', 'active_member'].includes(st)) {
          setIsSelected(true);
        }
      }
    };

    checkStatus();
  }, [user]);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-transparent">
      {/* Content Container */}

      {/* 3. Main Content Container (No more 'box' container to avoid coinciding boxes) */}
      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative py-20"
        >
          {/* Logo Background (Abstract Glassy Watermark - Pulsing) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[500px] md:h-[500px] pointer-events-none -z-10 select-none">
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.03, 0.06, 0.03]
              }}
              transition={{ 
                scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 8, repeat: Infinity, ease: "easeInOut" }
              }}
              className="w-full h-full relative"
            >
              <img
                src="/logo.png"
                alt=""
                className="w-full h-full object-contain brightness-200 invert opacity-15"
              />
              {/* Radial Fade to avoid sharp edges - Using inline style for reliability */}
              <div 
                className="absolute inset-0" 
                style={{ 
                  background: 'radial-gradient(circle, transparent 30%, #050505 70%)' 
                }} 
              />
            </motion.div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Slogan with Glass Line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-5 mb-10"
            >
              <div className="h-[1px] w-10 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <span className="text-[11px] md:text-sm text-primary/90 tracking-[0.35em] uppercase font-bold px-4 py-1 rounded-full border border-primary/10 bg-primary/5 backdrop-blur-sm">
                Design • Fabricate • Test
              </span>
              <div className="h-[1px] w-10 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            </motion.div>
 
            {/* Main Title */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-8 font-heading text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                <GlitchText text="IEEE" className="text-primary select-none" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <GlitchText text="SSCS" className="text-foreground select-none" />
              </motion.div>
            </div>
 
            {/* Subtitle / Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-4 mb-12"
            >
              <h2 className="text-xl md:text-3xl font-heading text-foreground/90 font-light tracking-wide italic">
                Innovating the World of Integrated Circuits
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
                Empowering the next generation of analog and digital circuit designers through hands-on technical excellence and industry-bridging research.
              </p>
            </motion.div>

            {/* Glassy CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {canBookSlot ? (
                <Button
                  size="lg"
                  className="px-10 h-14 bg-purple-600 hover:bg-purple-700 text-white font-heading rounded-full shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all hover:scale-105 animate-pulse"
                  asChild
                >
                  <Link to="/schedule">
                    BOOK SLOT
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              ) : isSelected ? (
                <Button
                  size="lg"
                  className="px-10 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-heading rounded-full shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all hover:scale-105"
                  asChild
                >
                  <Link to="/apply">
                    APPLICATION SELECTED
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              ) : hasApplied ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="px-10 h-14 border-primary/40 text-primary hover:bg-primary/10 font-heading rounded-full backdrop-blur-md"
                  asChild
                >
                  <Link to="/apply">
                    VIEW APPLICATION
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              ) : !isRecruitmentOpen ? (
                <Button
                  size="lg"
                  className="px-10 h-14 bg-white/5 border border-white/10 text-muted-foreground font-heading rounded-full cursor-not-allowed"
                  disabled
                >
                  RECRUITMENT CLOSED
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="px-10 h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-heading rounded-full shadow-[0_0_20px_rgba(220,20,60,0.3)] transition-all hover:scale-105"
                  asChild
                >
                  <Link to="/apply">
                    Join IEEE SSCS
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              )}

              <Button
                size="lg"
                variant="outline"
                className="px-10 h-14 border-white/10 text-foreground hover:bg-white/5 backdrop-blur-md rounded-full transition-all hover:border-primary/50"
                onClick={() => scrollToSection('#domains')}
              >
                Explore Domains
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.button
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground hover:text-primary transition-all p-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 group"
        onClick={() => scrollToSection('#about')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 10, 0] }}
        transition={{
          opacity: { delay: 1.5 },
          y: { delay: 1.5, duration: 2, repeat: Infinity }
        }}
      >
        <ChevronDown className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </motion.button>
    </section>
  );
};

export default HeroSection;
