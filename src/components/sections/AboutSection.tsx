
import { motion } from 'framer-motion';
import { Eye, Target } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';

const AboutSection = () => {
  return (
    <section id="about" className="py-24 bg-card/50">
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
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            <RevealText text="About the Committee" />
          </h2>
          <div className="max-w-3xl mx-auto px-4 mt-8">
            <p className="font-heading text-sm md:text-lg text-muted-foreground border-l-2 border-primary/50 pl-4 py-2 bg-primary/5 rounded-r-lg text-left">
              <span className="text-primary font-bold">IEEE SSCS</span> <span className="mx-2">→</span>
              IEEE Solid-State Circuits Society Student Branch Chapter
            </p>
          </div>
        </motion.div>

        {/* Vision & Mission Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Vision Card */}
          <HolographicCard className="p-8 h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-2xl font-bold text-foreground">
                Our Vision
              </h3>
            </div>
            <p className="text-muted-foreground leading-relaxed text-lg">
              To be the leading global community for solid-state circuit experts, 
              advancing the field through innovation in integrated circuit design, 
              fabrication, and applications for the benefit of humanity.
            </p>
          </HolographicCard>

          {/* Mission Card */}
          <HolographicCard className="p-8 h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-2xl font-bold text-foreground">
                Our Mission
              </h3>
            </div>
            <ul className="text-muted-foreground space-y-4">
              {[
                'Organize technical workshops on IC design',
                'Facilitate research in solid-state circuits',
                'Connect students with industry professionals',
                'Promote participation in global design contests',
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-primary mt-1.5">•</span>
                  <span className="text-lg">{item}</span>
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
