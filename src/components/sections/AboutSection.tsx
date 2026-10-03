import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HolographicCard from '@/components/ui/HolographicCard';
import ScrambleText from '@/components/fx/ScrambleText';
import WordReveal from '@/components/fx/WordReveal';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import { fetchWebsiteEvents } from '@/lib/club';

const MANIFESTO =
  'We are the IEEE Solid-State Circuits Society student chapter at VIT Chennai. We learn circuits by building them: ' +
  'workshops, competitions and late nights in the lab, from a first op-amp to a first chip.';

const MISSION = [
  'Organize technical workshops on IC design',
  'Facilitate research in solid-state circuits',
  'Connect students with industry professionals',
  'Promote participation in global design contests',
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay },
});

/** Live numbers from public data: the leaderboard and published events. */
function useClubStats() {
  const { rows, loading } = useLeaderboard();
  const [events, setEvents] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetchWebsiteEvents().then(e => { if (active) setEvents(e.length); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const members = loading ? null : rows.length || null;
  const points = loading ? null : rows.reduce((sum, r) => sum + r.total_points, 0) || null;
  return { members, points, events: events || null };
}

const Stat = ({ value, label }: { value: number | null; label: string }) => (
  <div>
    <div className="font-heading text-3xl md:text-4xl font-bold text-foreground tabular-nums">
      {value === null ? '—' : value.toLocaleString('en-IN')}
    </div>
    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">{label}</div>
  </div>
);

const AboutSection = () => {
  const stats = useClubStats();

  return (
    <section id="about" className="py-24 relative">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div className="text-center mb-16" {...fadeUp()}>
          <span className="text-xs text-primary tracking-widest uppercase mb-2 block">
            About Us
          </span>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            <ScrambleText text="About the Club" />
          </h2>
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <p className="font-heading text-xs md:text-base text-muted-foreground border-l-2 border-primary/50 pl-4 py-2 bg-primary/5 rounded-r-lg text-left">
              <span className="text-primary font-bold">IEEE SSCS</span> <span className="mx-2">→</span>
              IEEE Solid-State Circuits Society Student Branch Chapter
            </p>
          </div>
        </motion.div>

        {/* Bento grid */}
        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {/* Manifesto */}
          <motion.div className="md:col-span-2" {...fadeUp()}>
            <HolographicCard className="p-8 md:p-10 h-full flex flex-col justify-center">
              <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-5">Who we are</span>
              <WordReveal
                text={MANIFESTO}
                className="font-heading text-xl md:text-2xl leading-relaxed text-foreground"
              />
            </HolographicCard>
          </motion.div>

          {/* Live numbers */}
          <motion.div {...fadeUp(0.1)}>
            <HolographicCard className="p-8 h-full flex flex-col justify-between gap-6">
              <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">By the numbers</span>
              <Stat value={stats.members} label="Members ranked" />
              <Stat value={stats.points} label="Points earned" />
              <Stat value={stats.events} label="Events run" />
            </HolographicCard>
          </motion.div>

          {/* Vision */}
          <motion.div {...fadeUp(0.1)}>
            <HolographicCard className="p-8 h-full">
              <div className="flex flex-col gap-2 mb-6">
                <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">01.</span>
                <h3 className="font-heading text-2xl font-bold text-foreground">Our Vision</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-base">
                To be the leading global community for solid-state circuit experts,
                advancing the field through innovation in integrated circuit design,
                fabrication, and applications for the benefit of humanity.
              </p>
            </HolographicCard>
          </motion.div>

          {/* Mission */}
          <motion.div {...fadeUp(0.2)}>
            <HolographicCard className="p-8 h-full">
              <div className="flex flex-col gap-2 mb-6">
                <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">02.</span>
                <h3 className="font-heading text-2xl font-bold text-foreground">Our Mission</h3>
              </div>
              <ul className="text-muted-foreground space-y-3">
                {MISSION.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-primary mt-1.5">•</span>
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </HolographicCard>
          </motion.div>

          {/* The team */}
          <motion.div {...fadeUp(0.3)}>
            <HolographicCard className="h-full overflow-hidden p-0 flex flex-col">
              <div className="relative flex-1 min-h-[220px]">
                <img
                  src="/team-photo.jpg"
                  alt="IEEE SSCS VIT Chennai members at Kamaraj Auditorium"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-[50%_60%]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              </div>
              <div className="px-6 py-4 border-t border-white/5">
                <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">03.</span>
                <p className="font-heading text-lg font-bold text-foreground">The people</p>
              </div>
            </HolographicCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
