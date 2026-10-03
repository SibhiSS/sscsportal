import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import ScrambleText from '@/components/fx/ScrambleText';
import { MouseEvent } from 'react';

interface Domain {
  id: string;
  title: string;
  description: string;
  color: string;
}

const domains: Domain[] = [
  {
    id: '01',
    title: 'Technical',
    description: 'Specializing in Projects, Research, and Web Development to push the boundaries of SSCS innovation.',
    color: 'from-blue-500/20 to-cyan-500/20'
  },
  {
    id: '02',
    title: 'Management',
    description: 'Handling Finance, Internal Coordination, and Documentation to ensure seamless club operations.',
    color: 'from-emerald-500/20 to-teal-500/20'
  },
  {
    id: '03',
    title: 'Event Operations',
    description: 'Planning and executing world-class events through on-ground operations and strategic execution.',
    color: 'from-indigo-500/20 to-blue-500/20'
  },
  {
    id: '04',
    title: 'Creative',
    description: 'Driving Design, Social Media, and Content creation to build a powerful brand presence.',
    color: 'from-purple-500/20 to-pink-500/20'
  },
  {
    id: '05',
    title: 'Outreach & Partnerships',
    description: 'Managing Industry Relations, Speaker Acquisition, and Sponsorships to expand our ecosystem.',
    color: 'from-amber-500/20 to-orange-500/20'
  },
  {
    id: '06',
    title: 'Human Resources',
    description: 'Focused on Recruitment, Member Engagement, and Conflict Resolution for a thriving community.',
    color: 'from-red-500/20 to-rose-500/20'
  },
];

// The floorplan: wide and narrow blocks staggered row by row, like a die.
//   lg:  [ Tech Tech  Mgmt ]
//        [ Ops  Crea  Crea ]
//        [ Outr Outr  HR   ]
const BLOCK_SPAN: Record<string, string> = {
  '01': 'sm:col-span-2 lg:col-span-2',
  '04': 'sm:col-span-2 lg:col-span-2',
  '05': 'lg:col-span-2',
};

/** Focus areas per domain, taken from each description. */
const FOCUS: Record<string, string[]> = {
  '01': ['Projects', 'Research', 'Web Development'],
  '02': ['Finance', 'Coordination', 'Documentation'],
  '03': ['Planning', 'On-ground Ops', 'Execution'],
  '04': ['Design', 'Social Media', 'Content'],
  '05': ['Industry Relations', 'Speakers', 'Sponsorships'],
  '06': ['Recruitment', 'Engagement', 'Conflict Resolution'],
};

/** Bond pads along one edge of the die outline. */
const PAD_STRIP = (direction: 'h' | 'v') => ({
  backgroundImage: `repeating-linear-gradient(${direction === 'h' ? '90deg' : '180deg'}, rgba(255,255,255,0.12) 0 8px, transparent 8px 26px)`,
});

const DomainCard = ({ domain, index }: { domain: Domain; index: number }) => {
  const isCore = domain.id === '01';
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
      className={`group relative h-full rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:border-primary/50 ${BLOCK_SPAN[domain.id] ?? ''}`}
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
        <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
          <h3 className={`font-heading font-bold text-foreground group-hover:text-primary transition-colors ${isCore ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
            {domain.title}
          </h3>
          <span className="font-mono text-xs font-bold text-white/20 group-hover:text-primary transition-colors">
            {domain.id}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 mt-2">
          <p className={`leading-relaxed text-muted-foreground/80 ${isCore ? 'text-base max-w-md' : 'text-sm'}`}>
            {domain.description}
          </p>
        </div>

        {/* Focus areas, pinned to the bottom of the block */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(FOCUS[domain.id] ?? []).map(f => (
            <span key={f} className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] uppercase tracking-wider text-muted-foreground group-hover:border-primary/20 transition-colors">
              {f}
            </span>
          ))}
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
        className="absolute -inset-y-32 inset-x-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle at 20% 30%, rgba(220, 20, 60, 0.08), transparent 60%)'
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
              <ScrambleText text="Technical Domains" />
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

        {/* The die: a thin outline with bond pads, the domains laid out as its floorplan */}
        <div className="relative max-w-6xl mx-auto rounded-3xl border border-white/10 bg-white/[0.01] p-3 md:p-5">
          <div aria-hidden="true" className="pointer-events-none absolute -top-[5px] left-12 right-12 h-[9px]" style={PAD_STRIP('h')} />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-[5px] left-12 right-12 h-[9px]" style={PAD_STRIP('h')} />
          <div aria-hidden="true" className="pointer-events-none absolute -left-[5px] top-12 bottom-12 w-[9px]" style={PAD_STRIP('v')} />
          <div aria-hidden="true" className="pointer-events-none absolute -right-[5px] top-12 bottom-12 w-[9px]" style={PAD_STRIP('v')} />
          <span aria-hidden="true" className="absolute -top-6 right-6 font-mono text-[10px] tracking-[0.3em] text-white/25 uppercase">
            sscs-vitc · 6 blocks
          </span>

          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain, index) => (
              <DomainCard key={domain.id} domain={domain} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DomainsSection;
