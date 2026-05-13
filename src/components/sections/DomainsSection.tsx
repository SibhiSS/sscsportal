import { motion } from 'framer-motion';
import {
  Wifi,
  Cpu,
  Bot,
  Brain,
  Shield,
  Building2,
  LucideIcon
} from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';

interface Domain {
  title: string;
  description: string;
  icon: LucideIcon;
}

const domains: Domain[] = [
  {
    title: 'Analog IC Design',
    description: 'Designing high-performance analog circuits including amplifiers, oscillators, and voltage regulators.',
    icon: Cpu,
  },
  {
    title: 'Digital VLSI Design',
    description: 'Implementing complex digital systems using Verilog/VHDL and advanced synthesis tools.',
    icon: Brain,
  },
  {
    title: 'Mixed-Signal Circuits',
    description: 'Bridging the gap between analog and digital worlds with ADCs, DACs, and PLLs.',
    icon: Wifi,
  },
  {
    title: 'RF Design',
    description: 'Exploring radio frequency circuits for wireless communication and high-speed sensing.',
    icon: Bot,
  },
  {
    title: 'Hardware Security',
    description: 'Developing secure circuit architectures to protect hardware from physical and side-channel attacks.',
    icon: Shield,
  },
  {
    title: 'Memory Design',
    description: 'Innovating in SRAM, DRAM, and emerging non-volatile memory technologies.',
    icon: Building2,
  },
];

const DomainsSection = () => {
  return (
    <section id="domains" className="py-24">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-widest uppercase mb-2 block">
            Explore
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            <RevealText text="Our Domains" />
          </h2>
        </motion.div>

        {/* Domain Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {domains.map((domain, index) => (
            <HolographicCard
              key={domain.title}
              className="p-6 h-full flex flex-col items-start hover:border-primary/30 transition-colors"
            >
              <div className="p-3 rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                <domain.icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="font-heading font-bold text-foreground mb-2 text-xl">
                {domain.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {domain.description}
              </p>
            </HolographicCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DomainsSection;
