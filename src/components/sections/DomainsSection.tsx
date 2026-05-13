import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Wifi,
  Cpu,
  Shield,
  Activity,
  Box,
  Microchip,
  LucideIcon,
  ArrowUpRight
} from 'lucide-react';
import RevealText from '@/components/ui/RevealText';
import { MouseEvent } from 'react';

interface Domain {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const domains: Domain[] = [
  {
    id: '01',
    title: 'Analog IC Design',
    description: 'High-performance analog circuits including amplifiers, oscillators, and precision voltage regulators.',
    icon: Cpu,
    color: 'from-red-500/20 to-orange-500/20'
  },
  {
    id: '02',
    title: 'Digital VLSI Design',
    description: 'Complex digital systems using Verilog/VHDL with advanced synthesis and physical design flows.',
    icon: Microchip,
    color: 'from-blue-500/20 to-cyan-500/20'
  },
  {
    id: '03',
    title: 'Mixed-Signal Circuits',
    description: 'Bridging the gap between analog and digital worlds with ADCs, DACs, and high-speed PLLs.',
    icon: Activity,
    color: 'from-purple-500/20 to-pink-500/20'
  },
  {
    id: '04',
    title: 'RF Design',
    description: 'Radio frequency circuits for wireless communication, radar, and ultra-high-speed sensing.',
    icon: Wifi,
    color: 'from-amber-500/20 to-red-500/20'
  },
  {
    id: '05',
    title: 'Hardware Security',
    description: 'Secure circuit architectures to protect against physical attacks and side-channel leakage.',
    icon: Shield,
    color: 'from-emerald-500/20 to-teal-500/20'
  },
  {
    id: '06',
    title: 'Memory Design',
    description: 'Innovation in SRAM, DRAM, and next-generation non-volatile memory technologies.',
    icon: Box,
    color: 'from-indigo-500/20 to-blue-500/20'
  },
];

const DomainCard = ({ domain, index }: { domain: Domain; index: number }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const onMouseMove = (e: MouseEvent) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      viewport={{ once: true }}
      onMouseMove={onMouseMove}
      className="group relative h-full rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:border-primary/50"
    >
      {/* Spotlight Effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useSpring(
            useTransform(
              [mouseX, mouseY],
              ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, rgba(220, 20, 60, 0.1), transparent 40%)`
            ),
            { stiffness: 50, damping: 20 }
          ),
        }}
      />

      <div className="relative flex h-full flex-col">
        {/* Card Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className={`rounded-xl bg-gradient-to-br ${domain.color} p-3 ring-1 ring-white/10 group-hover:ring-primary/50 transition-all duration-500`}>
            <domain.icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <span className="font-mono text-xs font-bold text-white/20 group-hover:text-primary transition-colors">
            {domain.id}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="mb-3 font-heading text-xl font-bold tracking-tight text-white group-hover:text-primary transition-colors">
            {domain.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground/80">
            {domain.description}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center gap-2 overflow-hidden text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 opacity-0 transition-all duration-300 group-hover:opacity-100">
          <span className="translate-x-[-20px] transition-transform duration-300 group-hover:translate-x-0">
            View Research
          </span>
          <ArrowUpRight className="h-3 w-3 translate-y-[10px] transition-transform duration-300 group-hover:translate-y-0" />
        </div>
      </div>

      {/* Decorative Corner */}
      <div className="absolute right-0 top-0 h-16 w-16 overflow-hidden rounded-tr-2xl opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute -right-8 -top-8 h-16 w-16 rotate-45 bg-primary/20 blur-xl" />
      </div>
    </motion.div>
  );
};

const DomainsSection = () => {
  return (
    <section id="domains" className="relative py-32">
      {/* Smooth Background Glow (No clipping) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle at 20% 0%, rgba(220, 20, 60, 0.08), transparent 50%)'
        }}
      />
      
      <div className="container relative mx-auto px-6">
        <div className="mb-20 flex flex-col items-center md:flex-row md:justify-between md:items-end max-w-6xl mx-auto">
          <div className="max-w-2xl text-center md:text-left">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary"
            >
              Expertise
            </motion.span>
            <h2 className="mt-4 font-heading text-4xl md:text-5xl font-bold tracking-tight text-white">
              <RevealText text="Technical Domains" />
            </h2>
            <p className="mt-6 text-sm md:text-base text-muted-foreground max-w-lg">
              Pushing the boundaries of semiconductor innovation through rigorous research and practical application across the entire stack.
            </p>
          </div>
          
          <div className="mt-8 hidden h-[1px] flex-1 bg-white/5 mx-12 md:block" />
          
          <div className="mt-8 md:mt-0 flex gap-4">
             <div className="h-2 w-2 rounded-full bg-primary/50" />
             <div className="h-2 w-2 rounded-full bg-white/10" />
             <div className="h-2 w-2 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {domains.map((domain, index) => (
            <DomainCard key={domain.id} domain={domain} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default DomainsSection;
