
import { motion } from 'framer-motion';
import { Eye, Target } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';

const AboutSection = () => {
  return (
    <section id="about" className="py-24 relative">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-widest uppercase mb-2 block">
            About Us
          </span>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            <RevealText text="About the Club" />
          </h2>
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <p className="font-heading text-xs md:text-base text-muted-foreground border-l-2 border-primary/50 pl-4 py-2 bg-primary/5 rounded-r-lg text-left">
              <span className="text-primary font-bold">IEEE SSCS</span> <span className="mx-2">→</span>
              IEEE Solid-State Circuits Society Student Branch Chapter
            </p>
          </div>
        </motion.div>

        {/* Vision & Mission Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Vision Card */}
          <HolographicCard className="p-8 h-full">
            <div className="flex flex-col gap-2 mb-6">
              <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">01.</span>
              <h3 className="font-heading text-2xl font-bold text-foreground">
                Our Vision
              </h3>
            </div>
            <p className="text-muted-foreground leading-relaxed text-base">
              To be the leading global community for solid-state circuit experts, 
              advancing the field through innovation in integrated circuit design, 
              fabrication, and applications for the benefit of humanity.
            </p>
          </HolographicCard>

          {/* Mission Card */}
          <HolographicCard className="p-8 h-full">
            <div className="flex flex-col gap-2 mb-6">
              <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">02.</span>
              <h3 className="font-heading text-2xl font-bold text-foreground">
                Our Mission
              </h3>
            </div>
            <ul className="text-muted-foreground space-y-3">
              {[
                'Organize technical workshops on IC design',
                'Facilitate research in solid-state circuits',
                'Connect students with industry professionals',
                'Promote participation in global design contests',
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1.5">•</span>
                  <span className="text-base">{item}</span>
                </li>
              ))}
            </ul>
          </HolographicCard>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
