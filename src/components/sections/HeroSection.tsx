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

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('applications')
        .select('id')
        .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
        .limit(1);

      if (data && data.length > 0) setHasApplied(true);
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050505]">
      {/* 1. Base Tech Grid */}
      <TechGridBackground />

      {/* 2. Glassmorphism Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 120, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* 3. Main Content Container */}
      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto p-12 md:p-20 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] relative overflow-hidden group"
        >
          {/* Decorative Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
          
          {/* Logo Background (Glassy Watermark) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.07] pointer-events-none -z-10">
            <img
              src="/logo.png"
              alt="IEEE SSCS Logo"
              className="w-full h-full object-contain mix-blend-screen"
            />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Slogan with Glass Line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4 mb-8"
            >
              <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-primary/50" />
              <span className="text-xs md:text-sm text-primary/80 tracking-[0.3em] uppercase font-medium">
                Design • Fabricate • Test
              </span>
              <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-primary/50" />
            </motion.div>

            {/* Main Title */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8 font-heading text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                <GlitchText text="IEEE" className="text-primary" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <GlitchText text="SSCS" className="text-foreground" />
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
              {hasApplied ? (
                <Button
                  size="lg"
                  className="px-10 h-14 bg-primary/20 text-primary/50 border border-primary/20 font-heading cursor-not-allowed rounded-full"
                  disabled
                >
                  Application Received
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

export default HeroSection;ion;
