import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ArrowRight, Eye } from 'lucide-react';
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <TechGridBackground />
      {/* Light gradient overlay for text readability while keeping grid visible */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/80 pointer-events-none -z-10" />

      {/* Translucent Logo Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.15] pointer-events-none">
        <img
          src="/logo.png"
          alt="IEEE SSCS Logo"
          className="w-full h-full object-contain mix-blend-screen"
          style={{
            maskImage: 'radial-gradient(circleAt center, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)'
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Solid-State Circuits Society
          </span>
        </motion.div>

        {/* Main Title - Enhanced Cinematic Intro */}
        <div className="flex flex-wrap justify-center gap-4 mb-6 font-heading text-5xl md:text-7xl lg:text-8xl font-bold perspective-[1000px]">
          <div className="overflow-hidden">
            <motion.div
              initial={{ y: "120%", skewY: 10, opacity: 0 }}
              animate={{ y: 0, skewY: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <GlitchText text="IEEE" className="text-primary" />
            </motion.div>
          </div>

          <div className="overflow-hidden">
            <motion.div
              initial={{ y: "120%", skewY: 10, opacity: 0 }}
              animate={{ y: 0, skewY: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            >
              <GlitchText text="SSCS" className="text-foreground" />
            </motion.div>
          </div>
        </div>

        {/* IEEE Expansion - Typewriter/Fade Reveal */}
        <motion.p
          className="text-sm md:text-base text-primary/80 font-heading mb-4 tracking-wide"
          initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
          animate={{ opacity: 1, clipPath: "inset(0 0 0 0)" }}
          transition={{ duration: 1, ease: "easeInOut", delay: 1 }}
        >
          Solid-State Circuits Society
        </motion.p>

        {/* Tagline */}
        <motion.p
          className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Innovating the World of Integrated Circuits
        </motion.p>

        {/* Slogan */}
        <motion.p
          className="text-sm text-primary/80 tracking-widest uppercase mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Design • Fabricate • Test
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {hasApplied ? (
            <Button
              size="lg"
              className="bg-primary/20 text-primary/50 border border-primary/20 font-heading cursor-not-allowed"
              disabled
            >
              Application Received
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading"
              asChild
            >
              <Link to="/apply">
                Join IEEE SSCS
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          )}

          <Button
            size="lg"
            variant="outline"
            className="border-border text-foreground hover:bg-card hover:border-primary/50"
            onClick={() => scrollToSection('#domains')}
          >
            Explore Domains
          </Button>
        </motion.div>

      </div>

      {/* Scroll Indicator */}
      <motion.button
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground hover:text-primary transition-colors cursor-pointer z-50 p-2"
        onClick={() => scrollToSection('#about')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 1 },
          y: { delay: 1, duration: 2, repeat: Infinity }
        }}
      >
        <ChevronDown className="w-8 h-8 opacity-80" />
      </motion.button>
    </section>
  );
};

export default HeroSection;
