import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RECRUITMENT_CLOSED } from '@/config/recruitment';
import { useRecruitmentCta } from '@/hooks/useRecruitmentCta';

const PERKS = ['Hands-on AI projects', 'Mentors and industry talks', 'Hackathons and competitions'];

const JoinSection = () => {
  const cta = useRecruitmentCta();
  const cls = 'inline-flex h-12 items-center gap-3 rounded-[3px] bg-primary px-8 font-body text-[15px] font-medium text-white shadow-[0_10px_24px_-10px_hsl(var(--primary)/0.8)] transition-colors hover:bg-primary/90 aria-disabled:pointer-events-none aria-disabled:opacity-50';
  const icon = <ArrowRight className="h-5 w-5" strokeWidth={1.75} />;

  return (
    <section id="join" className="px-6 py-16 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-[1246px] overflow-hidden rounded-md bg-[#0B1726] px-8 py-14 text-center md:px-16"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-[90px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
        <p className="relative font-mono text-[11px] tracking-[0.3em] text-primary">
          {RECRUITMENT_CLOSED ? 'NEXT INTAKE SOON' : 'NOW RECRUITING'}
        </p>
        <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-[34px] font-extrabold uppercase leading-[1.02] tracking-tight text-white md:text-[46px]">
          Be part of what <span className="text-primary">AI builds next.</span>
        </h2>
        <ul className="relative mx-auto mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px] text-white/70">
          {PERKS.map(p => <li key={p} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{p}</li>)}
        </ul>
        <div className="relative mt-9 flex justify-center">
          {cta.kind === 'link' && <a href={cta.href} target="_blank" rel="noopener noreferrer" className={cls}>{cta.label}{icon}</a>}
          {cta.kind === 'router' && <Link to={cta.to} className={cls}>{cta.label}{icon}</Link>}
          {cta.kind === 'disabled' && <span aria-disabled="true" className={cls}>{cta.label}</span>}
        </div>
        <p className="relative mt-5 text-[13px] text-white/50">
          {RECRUITMENT_CLOSED ? 'This cycle has closed. Results and the next intake are announced on Instagram.' : 'Applications are reviewed on a rolling basis.'}
        </p>
      </motion.div>
    </section>
  );
};

export default JoinSection;
